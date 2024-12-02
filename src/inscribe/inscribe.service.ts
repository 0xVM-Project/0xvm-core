import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'bitcoinjs-lib';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastConfig } from 'src/entities/last-config.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { IndexerService } from 'src/indexer/indexer.service';
import { HashMappingService } from 'src/router/protocol/hash-mapping/hash-mapping.service';
import { BTCTransaction } from 'src/utils/btc-transaction';
import { createCommit, createReveal, relay } from 'src/utils/inscribe';
import { XvmService } from 'src/xvm/xvm.service';
import { In, Repository } from 'typeorm';
import { FeeRate, UnisatResponse } from './inscribe.interface';

@Injectable()
export class InscribeService {
  private readonly logger = new Logger(InscribeService.name);
  private readonly bTCTransaction: BTCTransaction;
  private readonly feeRate: number;
  private lastFeeRateLog: number = 0;

  constructor(
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    @InjectRepository(LastConfig)
    private readonly lastConfig: Repository<LastConfig>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
    private readonly httpService: HttpService,
    private readonly indexerService: IndexerService,
    private readonly xvmService: XvmService,
    private readonly hashMappingService: HashMappingService,
    @InjectRepository(HashMapping)
    private readonly hashMapping: Repository<HashMapping>,
  ) {
    const operatorPrivateKey = this.defaultConf.xvm.operatorPrivateKey;
    this.feeRate = this.defaultConf.wallet.btcFeeRate;

    if (operatorPrivateKey && operatorPrivateKey.startsWith('0x')) {
      this.bTCTransaction = new BTCTransaction(
        operatorPrivateKey.slice(2),
        (this.defaultConf.xvm.xvmNetwork as 'mainnet' | 'testnet') ?? 'testnet',
      );
    }
  }

  async create(preBroadcastTx: PreBroadcastTx, feeRate: number) {
    const content = preBroadcastTx?.content;

    if (content) {
      const receiverAddress = this.defaultConf.wallet.fundingAddress;
      const { payPrivateKey, payAddress, amount } = await createCommit(
        content,
        receiverAddress,
        feeRate,
      );

      const inscribeId = crypto.randomUUID();

      try {
        await this.preBroadcastTx.update(
          { id: preBroadcastTx.id },
          {
            status: 2,
            inscribeId,
            privateKey: payPrivateKey,
            content,
            receiverAddress,
            feeRate,
            amount,
            temporaryAddress: payAddress,
          },
        );
      } catch (error) {
        this.logger.error('update preBroadcastTx failed');
        throw error;
      }

      const newPreBroadcastTx = await this.preBroadcastTx.findOne({
        where: { id: preBroadcastTx.id },
      });
      await this.transfer(newPreBroadcastTx);
    }
  }

  async transfer(preBroadcastTx: PreBroadcastTx) {
    const isUtxoAvailable = await this.checkUtxoAvailable();

    if (!isUtxoAvailable) {
      this.logger.log('The Btc balance is insufficient.');
      return;
    }

    const transferResult = await this.bTCTransaction.transfer(
      preBroadcastTx.temporaryAddress,
      preBroadcastTx.amount,
      preBroadcastTx.feeRate,
      this.feeRate,
    );

    if (transferResult) {
      try {
        await this.preBroadcastTx.update(
          { id: preBroadcastTx.id },
          {
            status: 3,
            commitTx: transferResult,
            commitTxHash: Transaction.fromHex(transferResult).getId(),
          },
        );
      } catch (error) {
        this.logger.error('update preBroadcastTx failed');
        throw error;
      }

      const newPreBroadcastTx = await this.preBroadcastTx.findOne({
        where: { id: preBroadcastTx.id },
      });
      await this.commit(newPreBroadcastTx);
    }
  }

  async commit(preBroadcastTx: PreBroadcastTx) {
    const revealResult = await createReveal(
      preBroadcastTx.privateKey,
      preBroadcastTx.content,
      preBroadcastTx.receiverAddress,
      preBroadcastTx.feeRate,
      preBroadcastTx.commitTx,
    );

    if (revealResult.success) {
      try {
        await relay(preBroadcastTx.commitTx);
        await relay(revealResult.signedTx);

        const lastConfig = await this.lastConfig.find({
          take: 1,
          order: {
            id: 'ASC',
          },
        });

        await this.preBroadcastTx.update(
          { id: preBroadcastTx.id },
          {
            revealHash: revealResult.txHash,
            status: 4,
            previous: lastConfig?.[0]?.lastTxHash ?? '',
          },
        );

        this.lastConfig.update(
          {},
          {
            lastTxHash: revealResult.txHash,
          },
        );

        const preBroadcastTxItemList = await this.preBroadcastTxItem.find({
          where: { id: preBroadcastTx.id },
        });

        if (preBroadcastTxItemList && preBroadcastTxItemList?.length > 0) {
          await this.hashMapping.update(
            {
              btcHash: In(
                preBroadcastTxItemList?.map((_preBroadcastTxItem) =>
                  _preBroadcastTxItem?.xvmBlockHeight
                    ?.toString()
                    .padStart(64, '0'),
                ),
              ),
            },
            {
              btcHash: revealResult.txHash,
            },
          );

          const toRewards = this.defaultConf.xvm.sysXvmAddress;
          const rewardResponse =
            await this.xvmService.rewardsTransfer(toRewards);

          if ('result' in rewardResponse) {
            const rewardHash = rewardResponse.result;

            if (rewardHash) {
              await this.hashMappingService.bindHash({
                xFromAddress: toRewards,
                xToAddress: toRewards,
                btcHash: revealResult.txHash,
                xvmHash: rewardHash,
                logIndex:
                  preBroadcastTxItemList?.filter(
                    (_item) =>
                      _item?.action &&
                      _item?.action !== InscriptionActionEnum.mineBlock,
                  )?.length ?? 0,
              });
              this.logger.log(
                `inscribe Send Inscription Rewards[546*(10^8)] success, hash: ${rewardHash}`,
              );
            }
          } else {
            this.logger.warn(
              `inscribe rewards failed. Caused by: ${JSON.stringify(rewardResponse?.error)}`,
            );
          }
        }
      } catch (e) {
        throw new Error(
          'Commit inscribe param error, failed to relay tx: ' + e,
        );
      }
    }
  }

  async run() {
    const feeRate = await this.getFeeRate();

    if (!feeRate) {
      return;
    }

    const pendingTx = await this.preBroadcastTx.findOne({
      where: {
        status: 3,
      },
      order: {
        id: 'ASC',
      },
    });

    if (pendingTx) {
      await this.commit(pendingTx);
    } else {
      const readyTx = await this.preBroadcastTx.findOne({
        where: {
          status: 2,
        },
        order: {
          id: 'ASC',
        },
      });

      if (readyTx) {
        await this.transfer(readyTx);
      } else {
        const initialTx = await this.preBroadcastTx.findOne({
          where: {
            status: 1,
          },
          order: {
            id: 'ASC',
          },
        });

        if (initialTx) {
          await this.create(initialTx, feeRate);
        }
      }
    }
  }

  async getFeeRate() {
    const feeSummary = await firstValueFrom(
      this.httpService.get<UnisatResponse<FeeRate>>(
        'https://wallet-api-testnet4.unisat.io/v5/default/fee-summary',
        {
          headers: {
            'Content-Type': 'application/json',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
          },
        },
      ),
    );

    if (
      feeSummary &&
      feeSummary?.data &&
      feeSummary?.data?.code === 0 &&
      feeSummary?.data?.msg === 'ok'
    ) {
      let feeRate = feeSummary?.data?.data?.list?.find(
        (_item) => _item?.title === 'Avg',
      )?.feeRate;

      if (Date.now() - this.lastFeeRateLog > 10 * 60 * 1000) {
        this.lastFeeRateLog = Date.now();
        this.logger.log(
          `current feeRate: ${feeRate}, expected feeRate: ${this.feeRate}${feeRate <= this.feeRate ? '' : ', not eligible, skip'}`,
        );
      }

      if (feeRate && feeRate > 0 && feeRate < this.feeRate) {
        return feeRate;
      }
    }

    return 0;
  }

  async checkUtxoAvailable() {
    const utxoResponse = await this.bTCTransaction.getUTXOs();

    if (utxoResponse) {
      const utxos = utxoResponse?.data;

      if (utxos && utxos?.length > 0) {
        const btcLatestBlockNumber =
          await this.indexerService.getLatestBlockNumberForBtc();

        return Boolean(
          !isNaN(btcLatestBlockNumber) &&
            utxos?.every(
              (utxo) => utxo?.height && utxo?.height <= btcLatestBlockNumber,
            ),
        );
      }
    }

    return false;
  }
}
