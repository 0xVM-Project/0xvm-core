import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'bitcoinjs-lib';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { RouterService } from 'src/router/router.service';
import { BTCTransaction } from 'src/utils/btc-transaction';
import { createCommit, createReveal, relay } from 'src/utils/inscribe';
import { Repository } from 'typeorm';
import {
  CommitRequest,
  CreateRequest,
  CreateResponse,
  FeeRate,
  UnisatResponse,
} from './inscribe.interface';

@Injectable()
export class InscribeService {
  private readonly logger = new Logger(InscribeService.name);

  constructor(
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    @InjectRepository(LastTxHash)
    private readonly lastTxHash: Repository<LastTxHash>,
    @InjectRepository(HashMapping)
    private readonly hashMappingRepository: Repository<HashMapping>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
    private readonly httpService: HttpService,
    private readonly routerService: RouterService,
  ) {}

  async create(request: CreateRequest, id: number): Promise<CreateResponse> {
    const { payPrivateKey, payAddress, amount } = await createCommit(
      request.content,
      request.receiverAddress,
      request.feeRate,
      request.depositAmount,
    );

    const inscribe_id = crypto.randomUUID();

    await this.preBroadcastTx.update(
      { id },
      {
        inscribeId: inscribe_id,
        privateKey: payPrivateKey,
        content: request.content,
        receiverAddress: request.receiverAddress,
        feeRate: request.feeRate,
        depositAmount: request.depositAmount,
        commitTx: '',
      },
    );

    return {
      id: inscribe_id,
      address: payAddress,
      amount: amount,
    };
  }

  async commit(request: CommitRequest) {
    const preBroadcastTx = await this.preBroadcastTx.findOne({
      where: [{ id: request.id }],
    });

    if (!preBroadcastTx) {
      throw new Error('Commit inscribe param error, invalid id: ' + request.id);
    }

    const revealResult = await createReveal(
      preBroadcastTx.privateKey,
      preBroadcastTx.content,
      preBroadcastTx.receiverAddress,
      preBroadcastTx.feeRate,
      preBroadcastTx.depositAmount,
      request.tx,
    );

    // update db
    if (revealResult.success) {
      try {
        await relay(request.tx);
        await relay(revealResult.signedTx);
        await this.preBroadcastTx.update(
          { id: request.id },
          {
            commitTx: request.tx,
            commitTxHash: Transaction.fromHex(request.tx).getId(),
            revealHash: revealResult.txHash,
            status: 4,
          },
        );
        this.lastTxHash.update(
          {},
          {
            hash: revealResult.txHash,
          },
        );
        this.hashMappingRepository.update(
          { xvmHash: preBroadcastTx.xvmBlockHash },
          { btcHash: revealResult.txHash },
        );
      } catch (e) {
        throw new Error(
          'Commit inscribe param error, failed to relay tx: ' + e,
        );
      }
    }

    return true;
  }

  async preCommit() {
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

    if (
      feeSummary &&
      feeSummary?.data &&
      feeSummary?.data?.code === 0 &&
      feeSummary?.data?.msg === 'ok'
    ) {
      const feeRate = feeSummary?.data?.data?.list?.find(
        (_item) => _item?.title === 'Avg',
      )?.feeRate;

      if (feeRate && feeRate > 0 && feeRate <= 500) {
        const pendingTx = await this.preBroadcastTx.findOne({
          where: {
            status: 3,
          },
          order: {
            id: 'ASC',
          },
        });

        if (pendingTx) {
          const txHash = await this.commit({
            id: pendingTx?.id,
            tx: pendingTx?.commitTx,
          });
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
            const bTCTransaction = new BTCTransaction(
              this.defaultConf.xvm.operatorPrivateKey,
            );
            const transferResult = await bTCTransaction.transfer(
              readyTx.receiverAddress,
              readyTx.depositAmount,
              feeRate,
            );
            if (transferResult && transferResult?.txid) {
              try {
                await this.preBroadcastTx.update(
                  { id: readyTx?.id },
                  { status: 3 },
                );
              } catch (error) {
                this.logger.error('update preBroadcastTx failed');
                throw error;
              }

              const txHash = await this.commit({
                id: readyTx?.id,
                tx: transferResult?.txid,
              });
            }
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
              const lastTxHash = await this.lastTxHash.findOne({});
              const firstPreBroadcastTxItem =
                await this.preBroadcastTxItem.findOne({
                  where: { preExecutionId: initialTx.id, action: 0 },
                  order: { id: 'ASC' },
                });

              try {
                await this.preBroadcastTxItem.save({
                  ...firstPreBroadcastTxItem,
                  data: lastTxHash.hash,
                });
              } catch (error) {
                this.logger.error('update preBroadcastTxItem failed');
                throw error;
              }

              const preBroadcastTxList = await this.preBroadcastTxItem.find({
                where: { preExecutionId: initialTx.id },
              });

              if (preBroadcastTxList && preBroadcastTxList.length > 0) {
                const content = this.routerService
                  .from('0f0001')
                  .encodeInscription(
                    preBroadcastTxList?.map((_preBroadcastTxItem) => ({
                      action: _preBroadcastTxItem?.action,
                      data: _preBroadcastTxItem?.data,
                    })),
                  );

                if (content) {
                  await this.preBroadcastTx.update(
                    { id: initialTx?.id },
                    { content, previous: lastTxHash.hash },
                  );
                  const txData = await this.create(
                    {
                      content,
                      receiverAddress: this.defaultConf.xvm.sysBtcAddress,
                      feeRate,
                    },
                    initialTx?.id,
                  );

                  if (txData) {
                    try {
                      await this.preBroadcastTx.update(
                        { id: initialTx?.id },
                        { status: 2 },
                      );
                    } catch (error) {
                      this.logger.error('update preBroadcastTx failed');
                      throw error;
                    }

                    const bTCTransaction = new BTCTransaction(
                      this.defaultConf.xvm.operatorPrivateKey,
                    );
                    const transferResult = await bTCTransaction.transfer(
                      txData.address,
                      txData.amount,
                      feeRate,
                    );
                    if (transferResult && transferResult?.txid) {
                      try {
                        await this.preBroadcastTx.update(
                          { id: initialTx?.id },
                          { status: 3 },
                        );
                      } catch (error) {
                        this.logger.error('update preBroadcastTx failed');
                        throw error;
                      }

                      const txHash = await this.commit({
                        id: initialTx?.id,
                        tx: transferResult?.txid,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  }
}
