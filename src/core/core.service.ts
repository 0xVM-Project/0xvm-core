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
import { PendingTx } from 'src/entities/pending-tx.entity';

@Injectable()
export class CoreService {
    private readonly logger = new Logger(CoreService.name)
    private readonly firstInscriptionBlockHeight: number
    private readonly retryCount: number = 6
    private latestBlockHeightForBtc: number
    private latestBlockHeightForXvm: number
    private diffBlock: number
    private syncStatus: { isSuccess: boolean, latestBtcBlockHeight: number }
    private messageQueue: { type: string, timestamp: number }[]
    public isExecutionTaskStop: boolean;

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        @InjectRepository(LastConfig) private readonly lastConfig: Repository<LastConfig>,
        @InjectRepository(PreBroadcastTxItem)
        private readonly preBroadcastTxItem: Repository<PreBroadcastTxItem>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly preExecutionService: PreExecutionService,
        @InjectRepository(BtcHistoryTx, 'sqlite') private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly sequencerService: SequencerService,
        @InjectRepository(PendingTx)
        private readonly pendingTx: Repository<PendingTx>,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
        this.indexerService.getLatestBlockNumberForBtc()
            .then(latestBlockHeight => this.latestBlockHeightForBtc = latestBlockHeight)
            .catch(error => { throw error })
        this.syncStatus = {
            isSuccess: false,
            latestBtcBlockHeight: this.firstInscriptionBlockHeight
        }
        this.isExecutionTaskStop=false;
        this.messageQueue=[];
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
                if (latestBlockTimestampBy0xvm <= latestHistoryTx.blockTimestamp) {
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
        await this.consumerMQ()
    }

    async consumerMQ() {
        while (!this.isExecutionTaskStop) {
            this.logger.debug(`this.messageQueue: ${JSON.stringify(this.messageQueue)}`)
            while(this.messageQueue?.length > 0){
                const mq = this.messageQueue.shift();

                if(mq && mq?.timestamp){
                    if(mq?.type === "execute"){
                        try {
                            await this.preExecutionService.execute(mq?.timestamp);
                        } catch (error) {
                            this.logger.error(`execute failed: ${JSON.stringify(error)}`)
                        }
                    }

                    if(mq?.type === "chunk"){
                        await this.execution(mq?.timestamp)
                    }
                }

                await sleep(1000)
            }

            await sleep(5000)
        }
    }

    /**
     * execution of transactions, including normal and pre-executed transactions
     */
    async execution(timestamp: number) {
        const syncStatus = this.getSyncStatus;

        // sync completed and not executing
        if(syncStatus.isSuccess){
            let lastBtcBlockHeight = syncStatus.latestBtcBlockHeight;
            const lastConfig = await this.lastConfig.find({
                take: 1,
                order: {
                  id: 'ASC',
                },
            });

            // if the lastBtcBlockHeight has already been set, use it, otherwise use syncStatus.latestBtcBlockHeight
            if(lastConfig && lastConfig?.length > 0){
                const _lastBtcBlockHeight = lastConfig?.[0]?.lastBtcBlockHeight;

                if(_lastBtcBlockHeight){
                    lastBtcBlockHeight = _lastBtcBlockHeight;
                }
            }else{
                await this.lastConfig.save(this.lastConfig.create());
            }
             
            // get latest online btc block height
            const btcLatestBlockNumber = await this.indexerService.getLatestBlockNumberForBtc();
            const currentBtcBlockHeight = lastBtcBlockHeight+1;

            if(btcLatestBlockNumber){
                // when online btc block height bigger than last btc block height
                if(btcLatestBlockNumber > lastBtcBlockHeight){
                    let retryTotal = 0

                    while (true) {
                        try {
                            if (retryTotal > 6) {
                                this.logger.warn(`normalExecution run retry failed several times, please manually process`)
                                this.isExecutionTaskStop = true;
                                break
                            }else{
                                await this.prePackage(true)
                                await this.normalExecution(btcLatestBlockNumber, currentBtcBlockHeight);
                                // save lastBtcBlockHeight when completed
                                await this.lastConfig.update({},{lastBtcBlockHeight:currentBtcBlockHeight});
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
                                this.isExecutionTaskStop = true;
                                break
                            }else{
                                await this.preExecutionService.chunk(currentBtcBlockHeight, timestamp);
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

    async normalExecution(btcLatestBlockNumber:number, currentBlockNumber:number) {
        // initial nonce
        this.xvmService.initNonce()
        // get eligible inscriptions
        const { inscriptionList, blockTimestamp } = await this.indexerService.fetchNormalInscription0xvmByBlock(currentBlockNumber);
        this.logger.log(`normalExecution: ${currentBlockNumber}/${btcLatestBlockNumber}, inscriptions-number: ${inscriptionList?.length ?? 0}`)
        // get latest xvm block height
        const xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber();
        let lastTxHash: string = '';
        if(!isNaN(xvmLatestBlockNumber) && inscriptionList && inscriptionList?.length > 0){
            let decodeInscriptionList:CommandsV1Type[] = []

            for (let index = 0; index < inscriptionList.length; index++) {
                const inscription = inscriptionList[index]
                const protocol = this.routerService.from(inscription.content)
                // execute transaction from inscription content
                const _hashList = await protocol.executeTransaction(inscription)
    
                if(_hashList && _hashList?.length > 0){
                    lastTxHash = inscription.hash;
                    // decode inscription content to transactions
                    decodeInscriptionList = decodeInscriptionList.concat(protocol.decodeInscription(inscription.content) as CommandsV1Type[]);
                }
            }

            if(decodeInscriptionList && decodeInscriptionList?.length > 0){
                // mineBlock
                const minterBlockHash = await this.xvmService.minterBlock(blockTimestamp);
                this.logger.log(`Precompute Inscription Generate Block ${currentBlockNumber} is ${minterBlockHash}`);

                // save decoded transactions
                await this.preBroadcastTxItem.save(
                    this.preBroadcastTxItem.create(
                        decodeInscriptionList.map((_decodeInscriptionItem) => ({
                            action: _decodeInscriptionItem.action,
                            data: _decodeInscriptionItem.data??"",
                            // set current btc block height as xvmBlockHeight for hashMapping
                            xvmBlockHeight: xvmLatestBlockNumber+1
                        })),
                    ),
                );

                try {
                    if(lastTxHash){
                        // update lastTxHash
                        await this.lastConfig.update({},{lastTxHash})
                    }
                } catch (error) {
                    this.logger.error("update lastTxHsh failed")
                    throw error
                }
            }
        }
    }

    async prePackage(isEnforce?:boolean) {
        await this.preExecutionService.package(isEnforce);
    }

    async executeMQ() {
        if (!this.isExecutionTaskStop) {
            this.messageQueue.push({type:"execute", timestamp: Date.now()});
            return true;
        }

        return false;
    }

    async chunkMQ() {
        if (!this.isExecutionTaskStop) {
            this.messageQueue.push({type:"chunk", timestamp: Date.now()});
        }
    }
}
