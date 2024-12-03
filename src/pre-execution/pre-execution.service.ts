import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import defaultConfig from 'src/config/default.config';
import { LastConfig } from 'src/entities/last-config.entity';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import { ExecutionModeEnum } from 'src/router/interface/protocol.interface';
import { IProtocol } from 'src/router/router.interface';
import { RouterService } from 'src/router/router.service';
import { XvmService } from 'src/xvm/xvm.service';
import { In, LessThan, Repository } from 'typeorm';

@Injectable()
export class PreExecutionService {
  private readonly logger = new Logger(PreExecutionService.name);

  constructor(
    @InjectRepository(PendingTx)
    private readonly pendingTx: Repository<PendingTx>,
    @InjectRepository(PreBroadcastTxItem)
    private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    @InjectRepository(LastConfig)
    private readonly lastConfig: Repository<LastConfig>,
    private readonly routerService: RouterService,
    private readonly xvmService: XvmService,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
  ) {}

  async execute(timestamp: number) {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      // get pre-executed transactions from db
      const pendingTxList = await this.pendingTx.find({
        where: { status: 1, createTime: LessThan(new Date(timestamp)) },
      });

      if (pendingTxList && pendingTxList?.length > 0) {
        const protocol: IProtocol<any, any> = this.routerService.from('0f0001');
        let logIndex = 0;

        pendingTxList?.map(async (pendingTx, _index) => {
          const _id = pendingTx?.id ?? 0;
          let _list =
            protocol.decodeInscription(pendingTx?.content ?? '') ?? [];
          const _logIndex = _list?.length ?? 0;

          if (_index === 0) {
            _list = [
              {
                action: InscriptionActionEnum.prev,
                data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]?.concat(_list);
          }

          if (_index === pendingTxList?.length - 1) {
            _list = _list?.concat([
              {
                action: InscriptionActionEnum.mineBlock,
                data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]);
          }

          const executeResult = await protocol.preExecuteTransaction(
            _id,
            _list,
            logIndex,
          );
          this.logger.debug(`executeResult: ${executeResult}`);

          try {
            await this.pendingTx.update(
              {
                id: _id,
              },
              {
                status: executeResult ? 2 : 3,
              },
            );
          } catch (error) {
            this.logger.error('update pendingTx failed');
            throw error;
          }

          logIndex += _logIndex;
        });
      }
    }
  }

  async chunk(currentBtcBlockHeight: number, timestamp: number) {
    // get latest xvm block height
    const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();

    if (!isNaN(xvmLatestBlockNumber)) {
      const xvmCurrentBlockNumber = xvmLatestBlockNumber + 1;
      const pendingTxList = await this.pendingTx.find({
        where: { status: 2, createTime: LessThan(new Date(timestamp)) },
      });

      if (pendingTxList && pendingTxList?.length > 0) {
        const protocol: IProtocol<any, any> = this.routerService.from('0f0001');
        const minterBlockData = `0x${xvmCurrentBlockNumber.toString(16).padStart(10, '0')}${Math.floor(Date.now() / 1000).toString(16)}`;
        const minterBlockHash = await protocol.mineBlock(
          minterBlockData,
          '',
          ExecutionModeEnum.PreExecution,
        );

        if (minterBlockHash) {
          try {
            await this.pendingTx.update(
              {
                id: In(
                  pendingTxList?.map(
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
                  pendingTxList?.map(
                    (_preTransactionItem) => _preTransactionItem?.id,
                  ),
                ),
                type: 2,
                action: 6,
              },
              {
                data: minterBlockData,
              },
            );

            await this.preBroadcastTxItem.update(
              {
                pendingTxId: In(
                  pendingTxList?.map(
                    (_preTransactionItem) => _preTransactionItem?.id,
                  ),
                ),
                type: 2,
              },
              {
                status: 2,
              },
            );

            await this.lastConfig.update(
              {},
              { lastBtcBlockHeight: currentBtcBlockHeight },
            );
          } catch (error) {
            this.logger.error('update chunk data failed');
            throw error;
          }
        }
      }
    }
  }

  async package(isEnforce?: boolean) {
    const preTransactionItemList = await this.preBroadcastTxItem.find({
      where: { status: 2, type: 2, preExecutionId: 0 },
    });

    if (preTransactionItemList && preTransactionItemList?.length > 0) {
      let list = preTransactionItemList;

      while (list && list?.length > 0) {
        let availableString = '';
        let availableList = [];
        let availableIdList = [];
        let enablePackage = false;
        const protocol: IProtocol<any, any> = this.routerService.from('0f0001');

        for (const item of list) {
          availableList.push({
            action: item?.action,
            data: item?.data,
          });
          availableIdList.push(item?.id);
          const content = protocol.encodeInscription(availableList);

          if (content) {
            // when the length of all unpacked transactions does not exceed the upper limit
            if (
              availableString.length >=
                this.defaultConf.wallet.InscribeMaxSize ||
              (availableString + content).length >=
                this.defaultConf.wallet.InscribeMaxSize
            ) {
              enablePackage = true;
              break;
            } else {
              availableString += content;
            }
          }
        }

        if (isEnforce) {
          enablePackage = true;
        }

        if (enablePackage) {
          try {
            const preBroadcastTx = await this.preBroadcastTx.save(
              this.preBroadcastTx.create({
                content: availableString,
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
