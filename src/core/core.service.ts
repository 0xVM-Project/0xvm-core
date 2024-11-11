import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import defaultConfig from 'src/config/default.config';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { IndexerService } from 'src/indexer/indexer.service';
import { PreExecutionService } from 'src/pre-execution/pre-execution.service';
import { RouterService } from 'src/router/router.service';
import { isSequential } from 'src/utils/arr';
import { sleep } from 'src/utils/times';
import { XvmService } from 'src/xvm/xvm.service';
import { In, LessThan, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository, MoreThan } from 'typeorm';
import { SequencerService } from './sequencer/sequencer.service';
import { Inscription } from 'src/ord/inscription.service';
import { CommandsV1Type } from 'src/router/interface/protocol.interface';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { LastConfig } from 'src/entities/last-config.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';

@Injectable()
export class CoreService {
    private readonly logger = new Logger(CoreService.name)
    private readonly firstInscriptionBlockHeight: number
    private readonly retryCount: number = 6
    private latestBlockHeightForBtc: number
    private latestBlockHeightForXvm: number
    private diffBlock: number
    private isExecutionRunning:boolean;
    private syncStatus: { isSuccess: boolean, latestBtcBlockHeight: number }

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        @InjectRepository(BlockHashSnapshot) private readonly blockHashSnapshotRepository: Repository<BlockHashSnapshot>,
        @InjectRepository(LastConfig) private readonly lastConfig: Repository<LastConfig>,
        @InjectRepository(PreBroadcastTxItem)
        private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly btcrpcService: BtcrpcService,
        private readonly preExecutionService: PreExecutionService,
        @InjectRepository(BtcHistoryTx, 'sqlite') private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly sequencerService: SequencerService,
        @InjectRepository(PreBroadcastTx)
        private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
        this.indexerService.getLatestBlockNumberForBtc()
            .then(latestBlockHeight => this.latestBlockHeightForBtc = latestBlockHeight)
            .catch(error => { throw error })
        this.syncStatus = {
            isSuccess: false,
            latestBtcBlockHeight: this.firstInscriptionBlockHeight
        }
        this.isExecutionRunning = false
    }

    get getSyncStatus(): { isSuccess: boolean, latestBtcBlockHeight: number } {
        return this.syncStatus
    }

    async sync() {
        let latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        // sync Sequencer
        const latestHistoryTx = await this.btcHistoryTxRepository.findOne({
            where: {},
            order: { blockHeight: 'DESC' },
        })
        let processBlockHeight = latestHistoryTx ? latestHistoryTx.blockHeight + 1 : this.defaultConf.xvm.firstInscriptionBlockHeight
        const schedule = {
            startTime: Math.floor((Date.now()) / 1000),
            startBlockHeight: processBlockHeight,
            endBlockHeight: latestBlockHeightForBtc,
            processBlockHeight: processBlockHeight,
            estimatedRemainingSeconds: 0
        }
        while (true) {
            if (processBlockHeight > latestBlockHeightForBtc) {
                const { result: latestBlockBy0xvm } = await this.xvmService.getLatestBlock()
                const latestBlockTimestampBy0xvm = parseInt(latestBlockBy0xvm.timestamp.slice(2), 16)
                const latestBlockHeightBy0xvm = parseInt(latestBlockBy0xvm.number.slice(2), 16)
                if (latestBlockHeightBy0xvm == 0) {
                    break
                }
                const latestHistoryTx = await this.btcHistoryTxRepository.findOne({
                    where: {},
                    order: { sort: 'DESC' },
                })
                if (!latestHistoryTx) {
                    throw new Error(`The {{btcHistoryTxRepository}} table data is abnormal and the data is empty`)
                }
                if (latestBlockTimestampBy0xvm == latestHistoryTx.blockTimestamp) {
                    break
                } else {
                    this.logger.log(`0xvm still has transactions to be broadcasted, wait 30 seconds to continue checking`)
                    // sleep 30s
                    await sleep(30000)
                    latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
                    continue
                }
            }
            // let savedRow = 0
            const savedRow = await this.sequencerService.syncSequencer(processBlockHeight)
            if (latestBlockHeightForBtc - processBlockHeight == 1) {
                latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
            }
            schedule.processBlockHeight = processBlockHeight
            schedule.endBlockHeight = latestBlockHeightForBtc
            schedule.estimatedRemainingSeconds = Math.floor((schedule.processBlockHeight - schedule.startBlockHeight) / ((Math.floor(Date.now() / 1000)) - schedule.startTime) * (schedule.endBlockHeight - schedule.processBlockHeight))
            let timeleft = `${Math.floor(schedule.estimatedRemainingSeconds / 3600)}:${Math.floor((schedule.estimatedRemainingSeconds % 3600) / 60)}:${schedule.estimatedRemainingSeconds % 60}`
            this.logger.log(`Sync saved ${processBlockHeight}/${latestBlockHeightForBtc} Inscription-Nums: ${savedRow} Time-left ${timeleft}`)
            processBlockHeight += 1
        }
        this.syncStatus.latestBtcBlockHeight = latestBlockHeightForBtc

        // Execution of synchronised transactions
        let nextSort = 0
        let history: BtcHistoryTx[] = []
        const { result: latestBlockBy0xvm } = await this.xvmService.getLatestBlock()
        const latestBlockTimestampBy0xvm = parseInt(latestBlockBy0xvm.timestamp.slice(2), 16)
        // Synchronous execution start time
        const syncExecutionStartTime = latestBlockTimestampBy0xvm
        while (true) {
            this.logger.log(`Start executing synchronized historical transactions`)
            this.xvmService.initNonce()
            history = await this.btcHistoryTxRepository.find({
                where: { blockTimestamp: MoreThan(syncExecutionStartTime), sort: MoreThan(nextSort) },
                order: { sort: 'ASC' },
                take: 100
            })
            if (!history || history.length == 0) {
                this.logger.log(`↪ Execution of synchronised transactions success. ↩`)
                break
            }
            nextSort = history[history.length - 1].sort
            // execution inscription
            for (let index = 0; index < history.length; index++) {
                const record = history[index]
                const isPrecompute = record.sort.toString().slice(-1) == '1' ? true : false
                const inscription: Inscription = {
                    blockHeight: record.blockHeight,
                    inscriptionId: `${record.hash}i0`,
                    contentType: 'text/plain',
                    contentLength: record.content.length,
                    content: record.content,
                    hash: record.hash
                }
                const hashList = await this.routerService.from(inscription.content).executeTransaction(inscription)
                this.logger.log(`Sync tx execution ${hashList.length} for ${record.blockHeight}`)
                // normal tx mine block
                if (!isPrecompute) {
                    // Update the status to ensure whether a block needs to be produced
                    let isMineBlock = false
                    if (index + 1 < history.length) {
                        isMineBlock = record.blockHeight != history[index + 1].blockHeight
                    } else {
                        const nextRecord = await this.btcHistoryTxRepository.findOne({
                            where: { sort: MoreThan(record.sort) },
                            order: { sort: 'ASC' }
                        })
                        isMineBlock = nextRecord ? record.blockHeight != nextRecord.blockHeight : true
                    }
                    // mine block
                    if (isMineBlock) {
                        const normalMineBlockHash = await this.xvmService.minterBlock(record.blockTimestamp)
                        this.logger.log(`Normal Inscription Generate Block ${record.blockHeight} is ${normalMineBlockHash}`)
                    }
                }
                await this.btcHistoryTxRepository.update(
                    { sort: record.sort },
                    { isExecuted: true }
                )
            }
        }
        this.logger.log(`↪ Synchronizing historical transactions completed ↩`)
        this.syncStatus.isSuccess = true
    }

    async run() {
        // 1. sync history tx
        await this.sync()
    }

    async execution() {
        this.logger.debug("execution")
        const syncStatus = this.getSyncStatus;

        if(!this.isExecutionRunning && syncStatus.isSuccess){
            this.isExecutionRunning = true;
            let lastBtcBlockHeight = syncStatus.latestBtcBlockHeight;
            const lastConfig = await this.lastConfig.find({
                take: 1,
                order: {
                  id: 'ASC',
                },
            });

            if(lastConfig && lastConfig?.length > 0){
                const _lastBtcBlockHeight = lastConfig?.[0]?.lastBtcBlockHeight;

                if(_lastBtcBlockHeight){
                    lastBtcBlockHeight = _lastBtcBlockHeight;
                }
            }else{
                await this.lastConfig.save(this.lastConfig.create());
            }
             
            const btcLatestBlockNumber = await this.indexerService.getLatestBlockNumberForBtc();

            if(btcLatestBlockNumber){
                if(btcLatestBlockNumber > lastBtcBlockHeight){
                    let retryTotal = 0

                    while (true) {
                        try {
                            if (retryTotal > 6) {
                                this.logger.warn(`normalExecution run retry failed several times, please manually process`)
                                this.isExecutionRunning = false;
                                break
                            }else{
                                const unPackagedTx = await this.preBroadcastTx.exists({where:{status:0}})

                                if(unPackagedTx){
                                    await this.preExecution(true);
                                    await this.normalExecution(btcLatestBlockNumber+1);
                                }else{
                                    await this.normalExecution(btcLatestBlockNumber+1);
                                    await this.preExecution();
                                }

                                await this.lastConfig.update({},{lastBtcBlockHeight:btcLatestBlockNumber+1})
                                this.isExecutionRunning = false;
                                break
                            }
                        } catch (error) {
                            retryTotal += 1
                            this.logger.error(error instanceof Error ? error.stack : error)
                            this.logger.log(`normalExecution run try retrying ${retryTotal}`)
                            await sleep(2000 + 2000 * retryTotal)
                        }
                    }
                }else{
                    let retryTotal = 0

                    while (true) {
                        try {
                            if (retryTotal > 6) {
                                this.logger.warn(`preExecution run retry failed several times, please manually process`)
                                this.isExecutionRunning = false;
                                break
                            }else{
                                await this.preExecution();
                                this.isExecutionRunning = false;
                                break
                            }
                        } catch (error) {
                            retryTotal += 1
                            this.logger.error(error instanceof Error ? error.stack : error)
                            this.logger.log(`preExecution run try retrying ${retryTotal}`)
                            await sleep(2000 + 2000 * retryTotal)
                        }
                    }
                }
            }
        }
    }

    async normalExecution(btcLatestBlockNumber:number) {
        this.logger.debug("normalExecution")
        this.xvmService.initNonce()
        const { inscriptionList } = await this.indexerService.fetchNormalInscription0xvmByBlock(btcLatestBlockNumber);
        const hashList: string[] = [];
        let lastTxHash: string = '';

        if(inscriptionList && inscriptionList?.length > 0){
            for (let index = 0; index < inscriptionList.length; index++) {
                const inscription = inscriptionList[index]
                const protocol = this.routerService.from(inscription.content)
                const _hashList = await protocol.executeTransaction(inscription)
    
                if(_hashList && _hashList?.length > 0){
                    hashList.push(..._hashList)
                    lastTxHash = inscription.hash
                    const decodeInscriptionList = protocol.decodeInscription(inscription.content) as CommandsV1Type[]
    
                    if(decodeInscriptionList && decodeInscriptionList?.length > 0){
                        await this.preBroadcastTxItem.save(
                            this.preBroadcastTxItem.create(
                                decodeInscriptionList.map((_decodeInscriptionItem) => ({
                                    action: _decodeInscriptionItem.action,
                                    data: _decodeInscriptionItem.data??"",
                                    xvmBlockHeight: btcLatestBlockNumber
                              })),
                            ),
                          );
                    }
                }
            }

            try {
                if(lastTxHash){
                    await this.lastConfig.update({},{lastTxHash})
                }
            } catch (error) {
                this.logger.error("add lastTxHsh failed")
                throw error
            }
        }
    }
    
    async preExecution(onlyReward?:boolean) {
        this.logger.debug("preExecution")
        this.xvmService.initNonce()
        if(onlyReward){
            await this.preExecutionService.reward(); 
        }else{
            await this.preExecutionService.execute(); 
        }
    }
}
