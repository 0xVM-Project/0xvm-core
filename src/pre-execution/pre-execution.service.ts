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
          const actionMineBlock = {
            action: InscriptionActionEnum.mineBlock,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
          };
          const content = protocol.encodeInscription(
            [actionPre]
              .concat(
                decodeInscriptionList.reduce(
                  (acc, cur) => acc.concat(cur?.data),
                  [],
                ),
              )
              .concat([actionMineBlock]),
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
            const hashList = await protocol.executeTransaction(inscription, "pre");

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
                preBroadcastTxItemList?.unshift({
                  id: preBroadcastTxItemList?.[0]?.id,
                  data: actionPre,
                });
                preBroadcastTxItemList?.push({
                  id: preBroadcastTxItemList?.[
                    preBroadcastTxItemList?.length - 1
                  ]?.id,
                  data: actionMineBlock,
                });

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

  async chunk() {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const xvmCurrentBlockNumber = xvmLatestBlockNumber + 1;
      const preTransactionList = await this.pendingTx.find({
        where: { status: 2 },
      });

      if (preTransactionList && preTransactionList?.length > 0) {
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
            logIndex: preTransactionList?.length,
          });
          this.logger.log(
            `[${xvmCurrentBlockNumber}] Send Inscription Rewards[546*(10^8)] success, hash: ${rewardHash}`,
          );

          const protocol: IProtocol<any, any> =
            this.routerService.from('0f0001');
          const minterBlockHash = await protocol.mineBlock(
            `0x${xvmCurrentBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
          );

          if (minterBlockHash) {
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
                  status: 4,
                },
              );

              await this.preBroadcastTxItem.update(
                {
                  pendingTxId: In(
                    preTransactionList?.map(
                      (_preTransactionItem) => _preTransactionItem?.id,
                    ),
                  ),
                  type: 2,
                  action: 6,
                },
                {
                  data: `0x${xvmCurrentBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
                },
              );
            } catch (error) {
              this.logger.error('update chunk data failed');
              throw error;
            }
          }
        }
      }
    }
  }

  async package(isEnforce?: boolean) {
    const preTransactionItemList = await this.preBroadcastTxItem.find({
      where: { preExecutionId: 0, type: 2 },
    });

    if (preTransactionItemList && preTransactionItemList?.length > 0) {
      const pendingTransactionList = await this.pendingTx.find({
        where: {
          status: 4,
          id: In(
            preTransactionItemList?.map(
              (_preTransactionItem) => _preTransactionItem?.pendingTxId,
            ),
          ),
        },
      });

      if (pendingTransactionList && pendingTransactionList?.length > 0) {
        let list = preTransactionItemList?.filter((_item) =>
          pendingTransactionList
            ?.map((_i) => _i.id)
            .includes(_item?.pendingTxId),
        );

        while (list && list?.length > 0) {
          let availableString = '';
          let availableList = [];
          let availableIdList = [];
          let enablePackage = false;
          const protocol: IProtocol<any, any> =
            this.routerService.from('0f0001');

          for (const item of list) {
            availableList.push({
              action: item?.action,
              data: item?.data,
            });
            availableIdList.push(item?.id);
            const content = protocol.encodeInscription(availableList);

            if (content && availableString.length < this.maxInscriptionSize) {
              // when the length of all unpacked transactions does not exceed the upper limit
              availableString += content;

              if (availableString.length >= this.maxInscriptionSize) {
                // if the limit is exceeded by adding the next one, set the current transaction to the should-pack status
                // the actual execution here will exceed the size of the upper limit of one transaction length, but it doesn't matter.
                enablePackage = true;
                break;
              }
            }
          }

          if (isEnforce) {
            enablePackage = true;
          }

          if (availableString && availableList && availableList?.length > 0) {
            if (enablePackage) {
              try {
                const preBroadcastTx = await this.preBroadcastTx.save(
                  this.preBroadcastTx.create({
                    content: '',
                    commitTx: '',
                    status: 1,
                  }),
                );

                if (preBroadcastTx) {
                  await this.preBroadcastTxItem.update(
                    {
                      id: In(availableIdList),
                      type: 2,
                    },
                    { preExecutionId: preBroadcastTx?.id },
                  );
                }
              } catch (error) {
                this.logger.error('update package data failed');
                throw error;
              }
            }

            list = list.filter((_item) => !availableIdList?.includes(_item.id));
          }
        }
      }
    }
  }
}
