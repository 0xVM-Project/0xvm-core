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
import { RouterService } from 'src/router/router.service';
import { BTCTransaction } from 'src/utils/btc-transaction';
import {
  checkIsChunked,
  createCommit,
  createReveal,
  relay,
} from 'src/utils/inscribe';
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
    @InjectRepository(HashMapping)
    private readonly hashMappingRepository: Repository<HashMapping>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
    private readonly httpService: HttpService,
    private readonly routerService: RouterService,
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
    const preBroadcastTxList = await this.preBroadcastTxItem.find({
      where: { preExecutionId: preBroadcastTx.id },
    });

    if (preBroadcastTxList && preBroadcastTxList.length > 0) {
      const content = this.routerService.from('0f0001').encodeInscription(
        preBroadcastTxList?.map((_preBroadcastTxItem) => ({
          action: _preBroadcastTxItem?.action,
          data: _preBroadcastTxItem?.data,
        })),
      );

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
              content: content,
              receiverAddress,
              feeRate,
              amount,
              temporaryAddress: payAddress,
            },
          );
        } catch (error) {
          console.error('update preBroadcastTx failed');
          throw error;
        }

        const newPreBroadcastTx = await this.preBroadcastTx.findOne({
          where: { id: preBroadcastTx.id },
        });
        await this.transfer(newPreBroadcastTx);
      }
    } else {
      await this.preBroadcastTx.update(
        { id: preBroadcastTx?.id },
        { status: 0 },
      );
    }
  }

  async transfer(preBroadcastTx: PreBroadcastTx) {
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
        console.error('update preBroadcastTx failed');
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
        await this.preBroadcastTx.update(
          { id: preBroadcastTx.id },
          {
            revealHash: revealResult.txHash,
            status: 4,
            previous: revealResult.txHash,
          },
        );
        this.lastConfig.update(
          {},
          {
            lastTxHash: revealResult.txHash,
          },
        );

        const preBroadcastTxList = await this.preBroadcastTxItem.find({
          where: { id: preBroadcastTx.id },
        });

        if (preBroadcastTxList && preBroadcastTxList?.length > 0) {
          const xvmBlockHeightList = [];

          preBroadcastTxList.forEach((_preBroadcastTxItem) => {
            if (
              !xvmBlockHeightList.includes(_preBroadcastTxItem?.xvmBlockHeight)
            ) {
              xvmBlockHeightList.push(
                `0x${_preBroadcastTxItem?.xvmBlockHeight
                  ?.toString()
                  .padStart(64, '0')}`,
              );
            }
          });

          if (xvmBlockHeightList && xvmBlockHeightList?.length > 0) {
            await this.hashMappingRepository.update(
              { btcHash: In(xvmBlockHeightList) },
              { btcHash: revealResult.txHash },
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
    this.logger.debug(`pendingTx: ${JSON.stringify(pendingTx)}`)

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
      this.logger.debug(`readyTx: ${JSON.stringify(readyTx)}`)

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
        this.logger.debug(`initialTx: ${JSON.stringify(initialTx)}`)

        if (initialTx) {
          const completedTx = await this.preBroadcastTx.findOne({
            where: {
              status: 4,
            },
            order: {
              id: 'DESC',
            },
          });
          this.logger.debug(`completedTx: ${JSON.stringify(completedTx)}`)

          if (!completedTx) {
            await this.create(initialTx, feeRate);
          } else if (completedTx && completedTx?.revealHash) {
            const isChunked = await checkIsChunked(completedTx?.revealHash);

            if (isChunked) {
              await this.create(initialTx, feeRate);
            }
          }
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
}
