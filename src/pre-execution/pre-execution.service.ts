import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import defaultConfig from 'src/config/default.config';
import { LastConfig } from 'src/entities/last-config.entity';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { CommandsV1Type } from 'src/router/interface/protocol.interface';
import { HashMappingService } from 'src/router/protocol/hash-mapping/hash-mapping.service';
import { IProtocol } from 'src/router/router.interface';
import { RouterService } from 'src/router/router.service';
import { XvmService } from 'src/xvm/xvm.service';
import { In, Repository } from 'typeorm';

@Injectable()
export class PreExecutionService {
  private readonly logger = new Logger(PreExecutionService.name);
  private readonly maxInscriptionSize = 500;

  constructor(
    @InjectRepository(PendingTx)
    private readonly pendingTx: Repository<PendingTx>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    @InjectRepository(LastConfig)
    private readonly lastConfig: Repository<LastConfig>,
    private readonly hashMappingService: HashMappingService,
    private readonly routerService: RouterService,
    private readonly xvmService: XvmService,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
  ) {}

  async execute() {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const xvmCurrentBlockNumber = xvmLatestBlockNumber + 1;
      // get pre-executed transactions from db
      const preTransactionList = await this.pendingTx.find({
        where: { status: 1 },
      });

      if (preTransactionList && preTransactionList?.length > 0) {
        let decodeInscriptionList: CommandsV1Type[] = [];
        let availablePreTransactionList: PendingTx[] = [];
        let decodeInscriptionString = '';
        let isInscriptionEnd = false;
        let preBroadcastTxId = 0;
        const protocol: IProtocol<any, any> = this.routerService.from('0f0001');

        try {
          // get unpacked transaction
          const packagePreBroadcastTx = await this.preBroadcastTx.findOne({
            where: { status: 0 },
            order: {
              id: 'ASC',
            },
          });

          if (packagePreBroadcastTx) {
            preBroadcastTxId = packagePreBroadcastTx?.id;
            const preBroadcastTxItemList = await this.preBroadcastTxItem.find({
              where: { preExecutionId: preBroadcastTxId },
            });

            if (preBroadcastTxItemList && preBroadcastTxItemList?.length > 0) {
              // if there are unpacked transactions then add up the lengths of all the transaction items
              decodeInscriptionString = protocol.encodeInscription(
                preBroadcastTxItemList,
              );
            }
          } else {
            const preBroadcastTx = await this.preBroadcastTx.save(
              this.preBroadcastTx.create({ content: '', commitTx: '' }),
            );

            if (preBroadcastTx && preBroadcastTx?.id) {
              preBroadcastTxId = preBroadcastTx.id;
            }
          }
        } catch (error) {
          this.logger.error('add preBroadcastTx failed');
          throw error;
        }

        if (preBroadcastTxId) {
          for (const preTransaction of preTransactionList) {
            const content = preTransaction?.content ?? '';

            if (
              content &&
              decodeInscriptionString.length < this.maxInscriptionSize
            ) {
              // when the length of all unpacked transactions does not exceed the upper limit
              decodeInscriptionString += content;
              decodeInscriptionList = decodeInscriptionList.concat(
                protocol.decodeInscription(content),
              );
              // should be update db data
              availablePreTransactionList.push(preTransaction);

              if (decodeInscriptionString.length >= this.maxInscriptionSize) {
                // if the limit is exceeded by adding the next one, set the current transaction to the should-pack status
                // the actual execution here will exceed the size of the upper limit of one transaction length, but it doesn't matter.
                isInscriptionEnd = true;
                break;
              }
            }
          }

          if (
            decodeInscriptionString &&
            decodeInscriptionList &&
            decodeInscriptionList?.length > 0 &&
            availablePreTransactionList &&
            availablePreTransactionList?.length > 0
          ) {
            const txList = [
              {
                action: InscriptionActionEnum.prev,
                data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
              .concat(decodeInscriptionList)
              .concat([
                {
                  action: InscriptionActionEnum.mineBlock,
                  data: `0x${xvmCurrentBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
                },
              ]);
            const content = protocol.encodeInscription(txList);

            if (content) {
              const inscription = {
                blockHeight: -1,
                inscriptionId: xvmCurrentBlockNumber
                  .toString()
                  .padStart(64, '0')
                  .padEnd(66, '0'),
                contentType: '',
                contentLength: 0,
                content,
                hash: xvmCurrentBlockNumber.toString().padStart(64, '0'),
              };
              // assemble the transaction parameters and then execute
              const hashList = await protocol.executeTransaction(inscription);

              if (hashList && hashList?.length > 0) {
                try {
                  // save executed transaction items
                  const result = await this.preBroadcastTxItem.save(
                    this.preBroadcastTxItem.create(
                      txList.map((_tx) => ({
                        preExecutionId: preBroadcastTxId,
                        action: _tx.action,
                        data: _tx.data ?? '',
                        type: 2,
                        // set current btc block height as xvmBlockHeight for hashMapping
                        xvmBlockHeight: xvmCurrentBlockNumber,
                      })),
                    ),
                  );

                  if (result && result?.length > 0) {
                    if (isInscriptionEnd) {
                      // if current transactions should be packaged
                      const toRewards = this.defaultConf.xvm.sysXvmAddress;
                      // inscription reward
                      const rewardHash = await this.xvmService
                        .rewardsTransfer(toRewards)
                        .catch((error) => {
                          throw new Error(
                            `inscription rewards fail. sysAddress: ${this.xvmService.sysAddress} to: ${toRewards} inscriptionId: ${inscription.inscriptionId}\n ${error?.stack}`,
                          );
                        });

                      if (rewardHash) {
                        const _preBroadcastTxList =
                          await this.preBroadcastTxItem.find({
                            where: { preExecutionId: preBroadcastTxId },
                          });
                        await this.hashMappingService.bindHash({
                          xFromAddress: toRewards,
                          xToAddress: toRewards,
                          btcHash: `0x${xvmCurrentBlockNumber.toString().padStart(64, '0')}`,
                          xvmHash: rewardHash,
                          logIndex: _preBroadcastTxList?.length ?? 0,
                        });
                      }

                      const lastConfig = await this.lastConfig.find({
                        take: 1,
                        order: {
                          id: 'ASC',
                        },
                      });

                      if (lastConfig && lastConfig?.length > 0) {
                        const lastTxHash = lastConfig?.[0]?.lastTxHash ?? '';
                        const firstPreBroadcastTxItem =
                          await this.preBroadcastTxItem.findOne({
                            where: {
                              preExecutionId: preBroadcastTxId,
                              action: 0,
                            },
                            order: { id: 'ASC' },
                          });

                        // update transaction item where action=0
                        await this.preBroadcastTxItem.update(
                          { id: firstPreBroadcastTxItem.id },
                          {
                            data: lastTxHash ?? '',
                          },
                        );

                        // set rewardHash as xvmBlockHash(inscription hash)
                        await this.preBroadcastTx.update(
                          { id: preBroadcastTxId },
                          {
                            status: 1,
                            xvmBlockHash: rewardHash,
                            previous: lastTxHash ?? '',
                          },
                        );

                        // set rewardHash as lastTxHash or previous
                        await this.lastConfig.update(
                          {},
                          { lastTxHash: rewardHash },
                        );
                      }
                    }

                    // set pre execution transactions to completed status
                    await this.pendingTx.update(
                      {
                        id: In(
                          availablePreTransactionList?.map(
                            (_preTransactionItem) => _preTransactionItem?.id,
                          ),
                        ),
                      },
                      {
                        status: 2,
                      },
                    );
                  }
                } catch (error) {
                  this.logger.error('add preBroadcastTxItem failed');
                  throw error;
                }
              }
            }
          }
        }
      }
    }
  }

  async reward() {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const xvmCurrentBlockNumber = xvmLatestBlockNumber + 1;
      let preBroadcastTxId = 0;
      const preBroadcastTx = await this.preBroadcastTx.findOne({
        where: { status: 0 },
        order: {
          id: 'ASC',
        },
      });

      if (preBroadcastTx) {
        preBroadcastTxId = preBroadcastTx.id;

        if (preBroadcastTxId) {
          const toRewards = this.defaultConf.xvm.sysXvmAddress;
          const rewardHash = await this.xvmService
            .rewardsTransfer(toRewards)
            .catch((error) => {
              throw new Error(
                `inscription rewards fail. sysAddress: ${this.xvmService.sysAddress} to: ${toRewards} \n ${error?.stack}`,
              );
            });

          if (rewardHash) {
            const _preBroadcastTxList = await this.preBroadcastTxItem.find({
              where: { preExecutionId: preBroadcastTxId },
            });
            await this.hashMappingService.bindHash({
              xFromAddress: toRewards,
              xToAddress: toRewards,
              btcHash: `0x${xvmCurrentBlockNumber.toString().padStart(64, '0')}`,
              xvmHash: rewardHash,
              logIndex: _preBroadcastTxList?.length,
            });
            this.logger.log(
              `[${xvmCurrentBlockNumber}] Send Inscription Rewards[546*(10^8)] success, hash: ${rewardHash}`,
            );

            const lastConfig = await this.lastConfig.find({
              take: 1,
              order: {
                id: 'ASC',
              },
            });

            if (lastConfig && lastConfig?.length > 0) {
              const lastTxHash = lastConfig?.[0]?.lastTxHash ?? '';
              const firstPreBroadcastTxItem =
                await this.preBroadcastTxItem.findOne({
                  where: {
                    preExecutionId: preBroadcastTxId,
                    action: 0,
                  },
                  order: { id: 'ASC' },
                });

              try {
                await this.preBroadcastTxItem.update(
                  { id: firstPreBroadcastTxItem.id },
                  {
                    data: lastTxHash ?? '',
                  },
                );

                await this.preBroadcastTx.update(
                  { id: preBroadcastTxId },
                  {
                    status: 1,
                    xvmBlockHash: rewardHash,
                    previous: lastTxHash ?? '',
                  },
                );

                await this.lastConfig.update({}, { lastTxHash: rewardHash });
              } catch (error) {
                this.logger.error('update preBroadcastTx failed');
                throw error;
              }
            }
          }
        }
      }
    }
  }
}
