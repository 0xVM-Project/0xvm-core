import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { CommandsV1Type } from 'src/router/interface/protocol.interface';
import { IProtocol } from 'src/router/router.interface';
import { RouterService } from 'src/router/router.service';
import { In, Repository } from 'typeorm';

@Injectable()
export class PreExecutionService {
  private readonly logger = new Logger(PreExecutionService.name);

  constructor(
    @InjectRepository(PendingTx)
    private readonly pendingTx: Repository<PendingTx>,
    @InjectRepository(LastTxHash)
    private readonly lastTxHash: Repository<LastTxHash>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    private readonly routerService: RouterService,
  ) {}

  async execute(finalBlockHeightForXvm: number) {
    const preTransactionList = await this.pendingTx.find({
      where: { status: 1 },
    });

    if (preTransactionList && preTransactionList?.length > 0) {
      let decodeInscriptionList: CommandsV1Type[] = [];
      let availablePreTransactionList: PendingTx[] = [];
      let decodeInscriptionString = '';
      let protocol: IProtocol<any, any>;

      for (const preTransaction of preTransactionList) {
        const content = preTransaction?.content ?? '';

        if (content) {
          // todo: divide version
          decodeInscriptionString += content;

          if (decodeInscriptionString.length < 40000) {
            protocol = this.routerService.from(content);
            decodeInscriptionList.concat(protocol.decodeInscription(content));
            availablePreTransactionList.push(preTransaction);
          } else {
            break;
          }
        }
      }

      if (
        decodeInscriptionList &&
        decodeInscriptionList?.length > 0 &&
        availablePreTransactionList &&
        availablePreTransactionList?.length > 0
      ) {
        let preBroadcastTxId = 0;

        try {
          const preBroadcastTx = await this.preBroadcastTx.save(
            this.preBroadcastTx.create(),
          );

          if (preBroadcastTx && preBroadcastTx?.id) {
            preBroadcastTxId = preBroadcastTx.id;
          }
        } catch (error) {
          this.logger.error('add preBroadcastTx failed');
          throw error;
        }

        if (preBroadcastTxId) {
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
                data: `0x${finalBlockHeightForXvm.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`,
              },
            ]);

          const content = protocol.encodeInscription(txList);
          const inscription = {
            inscriptionId:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            contentType: '',
            contentLength: 0,
            content,
            hash: '0000000000000000000000000000000000000000000000000000000000000000'
          };
          const hashList = await protocol.executeTransaction(inscription);

          if (hashList && hashList?.length > 0) {
            try {
              const result = await this.preBroadcastTxItem.save(
                this.preBroadcastTxItem.create(
                  txList.map((_tx) => ({
                    preExecutionId: preBroadcastTxId,
                    action: _tx.action,
                    data: _tx.data,
                  })),
                ),
              );

              if (result && result?.length > 0) {
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
