import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { CommandsV1Type } from 'src/router/interface/protocol.interface';
import { IProtocol } from 'src/router/router.interface';
import { RouterService } from 'src/router/router.service';
import { Repository } from 'typeorm';

@Injectable()
export class PreExecutionService {
  private readonly logger = new Logger(PreExecutionService.name);

  constructor(
    @InjectRepository(PendingTx)
    private readonly pendingTx: Repository<PendingTx>,
    @InjectRepository(LastTxHash)
    private readonly lastTxHash: Repository<LastTxHash>,
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    private readonly routerService: RouterService,
  ) {}

  async execute() {
    const preTransactionList = await this.pendingTx.find({
      where: { status: 1 },
    });

    if (preTransactionList && preTransactionList?.length > 0) {
      let decodeInscriptionList: CommandsV1Type[] = [];
      let protocol: IProtocol<any, any>;

      for (const preTransaction of preTransactionList) {
        const content = preTransaction?.content ?? '';

        if (content) {
          // todo: divide version
          protocol = this.routerService.from(content);
          decodeInscriptionList.concat(protocol.decodeInscription(content));
        }
      }

      if (decodeInscriptionList && decodeInscriptionList?.length > 0) {
        const lastTxHash = await this.lastTxHash.findOne({});

        if (lastTxHash && lastTxHash?.hash) {
          const content = protocol.encodeInscription(
            [{ action: InscriptionActionEnum.prev, data: lastTxHash.hash }]
              .concat(decodeInscriptionList)
              // todo: mineBlock data = blockHeight + timestamp
              .concat([{ action: InscriptionActionEnum.mineBlock, data: '' }]),
          );
          const inscription = {
            inscriptionId:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            contentType: '',
            contentLength: 0,
            content,
          };
          const hashList = await this.routerService
            .from(content)
            .executeTransaction(inscription);

          try {
            if (hashList && hashList?.length > 0) {
              const saveData = this.preBroadcastTx.create({
                previous: lastTxHash?.hash,
                xvmBlockHash: hashList[hashList?.length - 1] ?? '',
              });

              await this.lastTxHash.save(saveData);
            }
          } catch (error) {
            this.logger.error('add lastTxHsh failed');
            throw error;
          }
        }
      }
    }
  }
}
