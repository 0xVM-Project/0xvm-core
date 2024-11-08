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
import { createCommit, createReveal, relay } from 'src/utils/inscribe';
import { In, Repository } from 'typeorm';
import { FeeRate, UnisatResponse } from './inscribe.interface';

@Injectable()
export class InscribeService {
  private readonly logger = new Logger(InscribeService.name);
  private readonly bTCTransaction: BTCTransaction;

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

    if (operatorPrivateKey && operatorPrivateKey.startsWith('0x')) {
      this.bTCTransaction = new BTCTransaction(
        operatorPrivateKey.slice(2),
        (this.defaultConf.xvm.xvmNetwork as 'mainnet' | 'testnet') ?? 'testnet',
      );
    }
  }

  async create(preBroadcastTx: PreBroadcastTx, feeRate: number) {
    this.logger.debug('create preBroadcastTx:');
    this.logger.debug(preBroadcastTx);
    const preBroadcastTxList = await this.preBroadcastTxItem.find({
      where: { preExecutionId: preBroadcastTx.id },
    });
    this.logger.debug('preBroadcastTxList:');
    this.logger.debug(JSON.stringify(preBroadcastTxList));

    if (preBroadcastTxList && preBroadcastTxList.length > 0) {
      const content = this.routerService.from('0f0001').encodeInscription(
        preBroadcastTxList?.map((_preBroadcastTxItem) => ({
          action: _preBroadcastTxItem?.action,
          data: _preBroadcastTxItem?.data,
        })),
      );
      this.logger.debug('content:');
      this.logger.debug(JSON.stringify(content));

      if (content) {
        const receiverAddress = this.defaultConf.xvm.sysBtcAddress;
        const { payPrivateKey, payAddress, amount } = await createCommit(
          content,
          receiverAddress,
          feeRate,
        );
        this.logger.debug('receiverAddress:');
        this.logger.debug(receiverAddress);

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
              feeRate: feeRate,
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
    }
  }

  async transfer(preBroadcastTx: PreBroadcastTx) {
    this.logger.debug('transfer preBroadcastTx:');
    this.logger.debug(preBroadcastTx);
    const transferResult = await this.bTCTransaction.transfer(
      preBroadcastTx.temporaryAddress,
      preBroadcastTx.amount,
      preBroadcastTx.feeRate,
    );
    this.logger.debug('transferResult:');
    this.logger.debug(transferResult);

    if (transferResult && transferResult) {
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
    this.logger.debug('commit preBroadcastTx:');
    this.logger.debug(preBroadcastTx);
    const revealResult = await createReveal(
      preBroadcastTx.privateKey,
      preBroadcastTx.content,
      preBroadcastTx.receiverAddress,
      preBroadcastTx.feeRate,
      0,
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
          },
        );
        await this.preBroadcastTx.update(
          { previous: preBroadcastTx.xvmBlockHash },
          { previous: revealResult.txHash },
        );
        this.lastConfig.update(
          {},
          {
            lastTxHash: revealResult.txHash,
          },
        );
        await this.preBroadcastTxItem.update(
          { action: 0, type: 2, data: preBroadcastTx.xvmBlockHash },
          { data: revealResult.txHash },
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
    const feeSummary = await firstValueFrom(
      this.httpService.get<UnisatResponse<FeeRate>>(
        'https://wallet-api-testnet.unisat.io/v5/default/fee-summary',
        {
          headers: {
            'Content-Type': 'application/json',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
          },
        },
      ),
    );
    this.logger.debug('feeSummary.data:');
    this.logger.debug(JSON.stringify(feeSummary.data));

    if (
      feeSummary &&
      feeSummary?.data &&
      feeSummary?.data?.code === 0 &&
      feeSummary?.data?.msg === 'ok'
    ) {
      let feeRate = feeSummary?.data?.data?.list?.find(
        (_item) => _item?.title === 'Avg',
      )?.feeRate;

      this.logger.debug('feeRate:');
      this.logger.debug(JSON.stringify(feeRate));
      feeRate = 10;

      if (feeRate && feeRate > 0 && feeRate <= 10) {
        const pendingTx = await this.preBroadcastTx.findOne({
          where: {
            status: 3,
          },
          order: {
            id: 'ASC',
          },
        });
        this.logger.debug('pendingTx:');
        this.logger.debug(JSON.stringify(pendingTx));

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
          this.logger.debug('readyTx:');
          this.logger.debug(JSON.stringify(readyTx));

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
            this.logger.debug('initialTx:');
            this.logger.debug(initialTx);

            if (initialTx) {
              await this.create(initialTx, feeRate);
            }
          }
        }
      }
    }
  }
}
