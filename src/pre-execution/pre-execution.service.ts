import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { CommandsV1Type } from 'src/router/interface/protocol.interface';
import { IProtocol } from 'src/router/router.interface';
import { RouterService } from 'src/router/router.service';
import { XvmService } from 'src/xvm/xvm.service';
import { In, Repository } from 'typeorm';

@Injectable()
export class PreExecutionService {
  private readonly logger = new Logger(PreExecutionService.name);
  private readonly maxInscriptionSize = 100;

  constructor(
    @InjectRepository(PendingTx)
    private readonly pendingTx: Repository<PendingTx>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    private readonly routerService: RouterService,
    private readonly xvmService: XvmService,
  ) {}

  async execute() {
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const preTransactionList = await this.pendingTx.find({
        where: { status: 1 },
      });

      if (preTransactionList && preTransactionList?.length > 0) {
        let decodeInscriptionList: CommandsV1Type[] = [];
        let availablePreTransactionList: PendingTx[] = [];
        let decodeInscriptionString = '';
        let protocol: IProtocol<any, any>;
        let isInscriptionEnd = false;
        let preBroadcastTxId = 0;

        try {
          const packagePreBroadcastTx = await this.preBroadcastTx.findOne({
            where: { status: 0 },
          });

          if (packagePreBroadcastTx) {
            preBroadcastTxId = packagePreBroadcastTx?.id;
            const preBroadcastTxItemList = await this.preBroadcastTxItem.find({
              where: { preExecutionId: preBroadcastTxId },
            });

            if (preBroadcastTxItemList && preBroadcastTxItemList?.length > 0) {
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
              // over one preTransaction
              decodeInscriptionString += content;
              protocol = this.routerService.from(content);
              decodeInscriptionList = decodeInscriptionList.concat(
                protocol.decodeInscription(content),
              );
              availablePreTransactionList.push(preTransaction);

              if (decodeInscriptionString.length >= this.maxInscriptionSize) {
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
                  data: `0x${xvmLatestBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
                },
              ]);
            const content = protocol.encodeInscription(txList);

            if (content) {
              const inscription = {
                inscriptionId: xvmLatestBlockNumber
                  .toString()
                  .padStart(66, '0'),
                contentType: '',
                contentLength: 0,
                content,
                hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
              };
              const hashList = await protocol.executeTransaction(
                inscription,
                isInscriptionEnd,
              );

              if (hashList && hashList?.length > 0) {
                try {
                  const result = await this.preBroadcastTxItem.save(
                    this.preBroadcastTxItem.create(
                      txList.map((_tx) => ({
                        preExecutionId: preBroadcastTxId,
                        action: _tx.action,
                        data: _tx.data ?? '',
                        type: 2,
                        xvmBlockHeight: xvmLatestBlockNumber,
                      })),
                    ),
                  );

                  if (result && result?.length > 0) {
                    if (isInscriptionEnd) {
                      await this.preBroadcastTx.update(
                        { id: preBroadcastTxId },
                        {
                          status: 1,
                          xvmBlockHash: hashList[hashList.length - 1],
                        },
                      );
                    }

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
}
