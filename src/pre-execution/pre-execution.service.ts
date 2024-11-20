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
        const protocol: IProtocol<any, any> = this.routerService.from('0f0001');
        const decodeInscriptionList: { id: number; data: CommandsV1Type[] }[] =
          [];

        for (const preTransaction of preTransactionList) {
          const _id = preTransaction?.id ?? 0;
          const _content = preTransaction?.content ?? '';

          if (_id && _content) {
            decodeInscriptionList.push({
              id: _id,
              data: protocol.decodeInscription(_content),
            });
          }
        }

        // execute all preTransactionList
        if (decodeInscriptionList && decodeInscriptionList?.length > 0) {
          const actionPre = {
            action: InscriptionActionEnum.prev,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
          };
          const content = protocol.encodeInscription(
            [actionPre].concat(
              decodeInscriptionList.reduce(
                (acc, cur) => acc.concat(cur?.data),
                [],
              ),
            ),
          );

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
              const preBroadcastTxItemList: {
                id: number;
                data: CommandsV1Type;
              }[] = [];

              decodeInscriptionList.forEach((_decodeInscriptionItem) => {
                _decodeInscriptionItem.data?.forEach((_item) => {
                  preBroadcastTxItemList.push({
                    id: _decodeInscriptionItem.id,
                    data: _item,
                  });
                });
              });

              if (
                preBroadcastTxItemList &&
                preBroadcastTxItemList?.length > 0
              ) {
                try {
                  // save executed transaction items
                  await this.preBroadcastTxItem.save(
                    this.preBroadcastTxItem.create(
                      preBroadcastTxItemList.map((_item) => ({
                        pendingTxId: _item?.id,
                        action: _item?.data?.action,
                        data: _item?.data?.data ?? '',
                        type: 2,
                        // set current btc block height as xvmBlockHeight for hashMapping
                        xvmBlockHeight: xvmCurrentBlockNumber,
                      })),
                    ),
                  );

                  // set pre execution transactions to completed status
                  await this.pendingTx.update(
                    {
                      id: In(
                        decodeInscriptionList?.map(
                          (_preTransactionItem) => _preTransactionItem?.id,
                        ),
                      ),
                    },
                    {
                      status: 2,
                    },
                  );
                } catch (error) {
                  this.logger.error('add preBroadcastTxItem failed');
                  throw error;
                }
              }
            } else {
              // when pre-execution failed, set transactions to failed status
              try {
                await this.pendingTx.update(
                  {
                    id: In(
                      preTransactionList?.map(
                        (_preTransactionItem) => _preTransactionItem?.id,
                      ),
                    ),
                  },
                  {
                    status: 3,
                  },
                );
              } catch (error) {
                this.logger.error('update pendingTx failed');
                throw error;
              }
            }
          }
        }
      }
    }
  }

  async chunk(isEnforce?: boolean) {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const xvmCurrentBlockNumber = xvmLatestBlockNumber + 1;
      const preTransactionList = await this.pendingTx.find({
        where: { status: 2 },
      });

      if (preTransactionList && preTransactionList?.length > 0) {
        let availablePreTransactionList: PendingTx[] = [];
        let decodeInscriptionString = '';
        let isInscriptionEnd = false;

        for (const preTransaction of preTransactionList) {
          const content = preTransaction?.content ?? '';

          if (
            content &&
            decodeInscriptionString.length < this.maxInscriptionSize
          ) {
            // when the length of all unpacked transactions does not exceed the upper limit
            decodeInscriptionString += content;
            availablePreTransactionList.push(preTransaction);

            if (decodeInscriptionString.length >= this.maxInscriptionSize) {
              // if the limit is exceeded by adding the next one, set the current transaction to the should-pack status
              // the actual execution here will exceed the size of the upper limit of one transaction length, but it doesn't matter.
              isInscriptionEnd = true;
              break;
            }
          }
        }

        if (isEnforce) {
          isInscriptionEnd = true;
        }

        if (
          decodeInscriptionString &&
          availablePreTransactionList &&
          availablePreTransactionList?.length > 0 &&
          isInscriptionEnd
        ) {
          const availablePreTransactionItems =
            await this.preBroadcastTxItem.find({
              where: {
                pendingTxId: In(
                  availablePreTransactionList?.map((_item) => _item?.id),
                ),
                type: 2,
              },
            });

          if (
            availablePreTransactionItems &&
            availablePreTransactionItems?.length > 0
          ) {
            const protocol: IProtocol<any, any> =
              this.routerService.from('0f0001');
            const minterBlockHash = await protocol.mineBlock(
              `0x${xvmCurrentBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
            );

            if (minterBlockHash) {
              const toRewards = this.defaultConf.xvm.sysXvmAddress;
              const rewardHash = await this.xvmService
                .rewardsTransfer(toRewards)
                .catch((error) => {
                  throw new Error(
                    `inscription rewards fail. sysAddress: ${this.xvmService.sysAddress} to: ${toRewards} \n ${error?.stack}`,
                  );
                });

              if (rewardHash) {
                await this.hashMappingService.bindHash({
                  xFromAddress: toRewards,
                  xToAddress: toRewards,
                  btcHash: `0x${xvmCurrentBlockNumber.toString().padStart(64, '0')}`,
                  xvmHash: rewardHash,
                  logIndex: availablePreTransactionItems?.length,
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

                  try {
                    const preBroadcastTx = await this.preBroadcastTx.save(
                      this.preBroadcastTx.create({
                        content: '',
                        commitTx: '',
                        status: 1,
                        xvmBlockHash: rewardHash,
                        previous: lastTxHash ?? '',
                      }),
                    );
                    await this.preBroadcastTxItem.update(
                      {
                        id: In(
                          availablePreTransactionItems?.map(
                            (_item) => _item?.id,
                          ),
                        ),
                        type: 2,
                      },
                      { preExecutionId: preBroadcastTx?.id },
                    );
                    await this.lastConfig.update(
                      {},
                      { lastTxHash: rewardHash },
                    );
                    await this.pendingTx.update(
                      {
                        id: In(
                          availablePreTransactionList?.map(
                            (_preTransactionItem) => _preTransactionItem?.id,
                          ),
                        ),
                      },
                      {
                        status: 4,
                      },
                    );
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
  }
}
