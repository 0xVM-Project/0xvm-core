import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import defaultConfig from 'src/config/default.config';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { IndexerService } from 'src/indexer/indexer.service';
import { PreExecutionService } from 'src/pre-execution/pre-execution.service';
import { RouterService } from 'src/router/router.service';
import { isSequential } from 'src/utils/arr';
import { sleep } from 'src/utils/times';
import { XvmService } from 'src/xvm/xvm.service';
import { In, LessThan, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository, MoreThan } from 'typeorm';
import { SequencerService } from './sequencer/sequencer.service';
import { Inscription } from 'src/ord/inscription.service';

@Injectable()
export class CoreService {
    private readonly logger = new Logger(CoreService.name)
    private readonly firstInscriptionBlockHeight: number
    private readonly retryCount: number = 6
    private latestBlockHeightForBtc: number
    private latestBlockHeightForXvm: number
    private diffBlock: number
    private syncStatus: boolean

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        @InjectRepository(BlockHashSnapshot) private readonly blockHashSnapshotRepository: Repository<BlockHashSnapshot>,
        @InjectRepository(LastTxHash) private readonly lastTxHash: Repository<LastTxHash>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly btcrpcService: BtcrpcService,
        private readonly preExecutionService: PreExecutionService,
        @InjectRepository(BtcHistoryTx, 'sqlite') private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly sequencerService: SequencerService,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
        this.indexerService.getLatestBlockNumberForBtc()
            .then(latestBlockHeight => this.latestBlockHeightForBtc = latestBlockHeight)
            .catch(error => { throw error })
        this.syncStatus = false
    }

    async snapshotBlock(blockHeight: number, blockHash?: string) {
        try {
            if (!blockHash) {
                const { result } = await this.btcrpcService.getblockhash(blockHeight)
                blockHash = result
            }
            const saveData = this.blockHashSnapshotRepository.create({ blockHash: blockHash, blockHeight: blockHeight })
            await this.blockHashSnapshotRepository.save(saveData)

            // Only keep the last confirmBlockHeight blocks
            await this.blockHashSnapshotRepository.delete({
                blockHeight: LessThanOrEqual(blockHeight - this.defaultConf.bitcoind.confirmBlockHeight)
            })
        } catch (error) {
            if (error instanceof QueryFailedError && error.driverError?.errno == 1062) {
                this.logger.warn(`snapshot block ${blockHeight} already exists`)
                return
            }
            throw error
        }
    }

    async getFinalBlock(verifyBlockHeight: number): Promise<number> {
        const confirmBlockHeight = this.defaultConf.bitcoind.confirmBlockHeight
        let snapshotBlockHeights = []
        for (let index = 0; index < confirmBlockHeight; index++) {
            snapshotBlockHeights.push(verifyBlockHeight - index)
        }
        const result = await this.blockHashSnapshotRepository.find({
            where: {
                blockHeight: In(snapshotBlockHeights)
            },
            order: {
                blockHeight: 'DESC'
            },
            take: confirmBlockHeight
        })
        // No snapshot information is returned for the current block height
        if (result.length == 0) {
            return verifyBlockHeight
        }
        const rangeBlockHeight = result.map(d => d.blockHeight).reverse()
        // check block height range sequence
        const blockHeightSequentialStatus = isSequential(rangeBlockHeight)
        if (!blockHeightSequentialStatus) {
            throw new Error(`Snapshot data is abnormal, and there is missing block information. Block Height range: ${JSON.stringify(rangeBlockHeight ?? [])}`)
        }
        // Compare the snapshot data with the latest block data and return the block height that needs to be rolled back
        let finalBlockHeight = result[0].blockHeight
        let retryCount = 0
        for (let index = 0; index < result.length;) {
            const snapshot = result[index]
            const { result: blockHashByNetwork } = await this.btcrpcService.getblockhash(snapshot.blockHeight)
            if (blockHashByNetwork != snapshot.blockHash) {
                if (!blockHashByNetwork) {
                    retryCount++
                    this.logger.warn(`get block hash fail, hash: ${blockHashByNetwork}, retry ${retryCount}`)
                    await sleep(1000 * retryCount)
                    continue
                }
                retryCount = 0
                finalBlockHeight = snapshot.blockHeight - 1
            }
            index++
        }
        if (finalBlockHeight != verifyBlockHeight) {
            // todo: revertBlock
            const state = await this.xvmService.revertBlock(finalBlockHeight)
            if (state != true) {
                throw new Error(`Revert Block [${finalBlockHeight}] fail. `)
            } else {
                this.logger.log(`Revert Block [${finalBlockHeight}] success. `)
            }
            await this.blockHashSnapshotRepository.delete({
                blockHeight: MoreThan(finalBlockHeight)
            })
            return finalBlockHeight
        }
        return finalBlockHeight
    }

    async processBlock(blockHeight: number): Promise<string> {
        this.xvmService.initNonce()
        const { inscriptionList, allInscriptionCount, blockHash, blockTimestamp } = await this.indexerService.fetchInscription0xvmByBlock(blockHeight)
        const remainingBlock = this.latestBlockHeightForBtc - (blockHeight - 1)
        const progressRate = Math.floor((blockHeight - 1) / this.latestBlockHeightForBtc * 10000) / 100
        this.logger.log(`⟱⟱⟱ ${blockHeight} ⟱⟱⟱`)
        const message = `Block [${blockHeight}/${this.latestBlockHeightForBtc}] Total:${allInscriptionCount} 0xvm:${inscriptionList.length} RemainingBlock:${remainingBlock} Progress:${progressRate}%`
        this.logger.log(message)
        const hashList: string[] = []
        let lastTransactionHash: string = ''
        for (let index = 0; index < inscriptionList.length; index++) {
            const inscription = inscriptionList[index];
            const _hashList = await this.routerService.from(inscription.content).executeTransaction(inscription)
            hashList.push(..._hashList)
            lastTransactionHash = inscription.hash
        }
        // preExecution update: save last transaction hash to database for preExecution
        try {
            if(lastTransactionHash){
                await this.lastTxHash.update({},{ hash: lastTransactionHash})
            }
        } catch (error) {
            this.logger.error("add lastTxHsh failed")
            throw error
        }
        this.logger.log(`[${blockHeight}] xvmInscription:${inscriptionList.length}  xvmTransaction:${hashList.length}`)
        return blockHash
    }

    get isSyncSuccess(): boolean {
        return this.syncStatus
    }

    async sync() {
        // let latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        // // sync Sequencer
        // const latestHistoryTx = await this.btcHistoryTxRepository.findOne({
        //     where: {},
        //     order: { blockHeight: 'DESC' },
        // })
        // let processBlockHeight = latestHistoryTx ? latestHistoryTx.blockHeight + 1 : this.defaultConf.xvm.firstInscriptionBlockHeight
        // const schedule = {
        //     startTime: Math.floor((Date.now()) / 1000),
        //     startBlockHeight: processBlockHeight,
        //     endBlockHeight: latestBlockHeightForBtc,
        //     processBlockHeight: processBlockHeight,
        //     estimatedRemainingSeconds: 0
        // }
        // while (true) {
        //     if (processBlockHeight > latestBlockHeightForBtc) {
        //         const { result: latestBlockBy0xvm } = await this.xvmService.getLatestBlock()
        //         const latestBlockTimestampBy0xvm = parseInt(latestBlockBy0xvm.timestamp.slice(2), 16)
        //         const latestBlockHeightBy0xvm = parseInt(latestBlockBy0xvm.number.slice(2), 16)
        //         if (latestBlockHeightBy0xvm == 0) {
        //             break
        //         }
        //         const latestHistoryTx = await this.btcHistoryTxRepository.findOne({
        //             where: {},
        //             order: { sort: 'DESC' },
        //         })
        //         if (!latestHistoryTx) {
        //             throw new Error(`The {{btcHistoryTxRepository}} table data is abnormal and the data is empty`)
        //         }
        //         if (latestBlockTimestampBy0xvm == latestHistoryTx.blockTimestamp) {
        //             break
        //         } else {
        //             this.logger.log(`0xvm still has transactions to be broadcasted, wait 30 seconds to continue checking`)
        //             // sleep 30s
        //             await sleep(30000)
        //             latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        //             continue
        //         }
        //     }
        //     // let savedRow = 0
        //     const savedRow = await this.sequencerService.syncSequencer(processBlockHeight)
        //     if (latestBlockHeightForBtc - processBlockHeight <= 1) {
        //         latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        //     }
        //     schedule.processBlockHeight = processBlockHeight
        //     schedule.endBlockHeight = latestBlockHeightForBtc
        //     schedule.estimatedRemainingSeconds = Math.floor((schedule.processBlockHeight - schedule.startBlockHeight) / ((Math.floor(Date.now() / 1000)) - schedule.startTime) * (schedule.endBlockHeight - schedule.processBlockHeight))
        //     let timeleft = `${Math.floor(schedule.estimatedRemainingSeconds / 3600)}:${Math.floor((schedule.estimatedRemainingSeconds % 3600) / 60)}:${schedule.estimatedRemainingSeconds % 60}`
        //     this.logger.log(`Sync saved ${processBlockHeight}/${latestBlockHeightForBtc} Inscription-Nums: ${savedRow} Time-left ${timeleft}`)
        //     processBlockHeight += 1
        // }

        // Execution of synchronised transactions
        let nextSort = 0
        let history: BtcHistoryTx[] = []
        const { result: latestBlockBy0xvm } = await this.xvmService.getLatestBlock()
        const latestBlockTimestampBy0xvm = parseInt(latestBlockBy0xvm.timestamp.slice(2), 16)
        const latestBlockHeightBy0xvm = parseInt(latestBlockBy0xvm.number.slice(2), 16)
        // Synchronous execution start time
        const syncExecutionStartTime = latestBlockHeightBy0xvm == 0 ? 0 : latestBlockTimestampBy0xvm
        while (true) {
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
        this.syncStatus = true
    }

    async run() {
        // 1. sync history tx
        await this.sync()
        // await this.execution()
    }

    async execution() {
        this.logger.log("Run start")
        let retryTotal = 0

        if (this.latestBlockHeightForBtc && this.latestBlockHeightForXvm && this.latestBlockHeightForBtc > 0 && this.latestBlockHeightForXvm > 0) {
            let latestBlockHeightForXvm = this.latestBlockHeightForBtc

            while (true) {
                try {
                    if (retryTotal > this.retryCount) {
                        this.logger.warn(`Run retry failed several times, please manually process`)
                        break
                    }

                    if(this.latestBlockHeightForBtc === latestBlockHeightForXvm + 1){
                        const lastTxHash = await this.lastTxHash.findOne({});

                        if(!lastTxHash){
                            await this.lastTxHash.save(this.lastTxHash.create())
                        }

                        const finalBlockHeightForXvm = await this.normalExecution()

                        if(finalBlockHeightForXvm){
                            await this.preExecution(finalBlockHeightForXvm+1)
                        }

                        retryTotal = 0
                    } else if (this.latestBlockHeightForBtc === latestBlockHeightForXvm) {
                        this.logger.log(`[${this.latestBlockHeightForXvm}/${this.latestBlockHeightForBtc}] Waiting for new blocks`)
                        await sleep(10000)
                        continue
                    } else {
                        break
                    }
                } catch (error) {
                    retryTotal += 1
                    this.logger.error(error instanceof Error ? error.stack : error)
                    this.logger.log(`Run try retrying ${retryTotal}`)
                    await sleep(2000 + 2000 * retryTotal)
                }
            }
        } else {
            this.logger.log("Run Invalid latestBlockHeightForXvm, skip");
        }
    }

    async normalExecution() {
        const finalBlockHeightForXvm = await this.getFinalBlock(
            this.latestBlockHeightForXvm,
        );
        const processBlockHeightForXvm = finalBlockHeightForXvm + 1;
        const processBlockHashForXvm = await this.processBlock(
            processBlockHeightForXvm,
        );
        await this.snapshotBlock(processBlockHeightForXvm, processBlockHashForXvm);
        return processBlockHeightForXvm;
      }
    
      async preExecution(finalBlockHeightForXvm:number) {
        if(finalBlockHeightForXvm){
            this.preExecutionService.execute(finalBlockHeightForXvm); 
        }
      }
}
