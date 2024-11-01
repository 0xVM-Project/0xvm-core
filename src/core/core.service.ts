import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import defaultConfig from 'src/config/default.config';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { IndexerService } from 'src/indexer/indexer.service';
import { HashMappingService } from 'src/router/protocol/hash-mapping/hash-mapping.service';
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
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly btcrpcService: BtcrpcService,
        private readonly hashMappingService: HashMappingService,
        @InjectRepository(BtcHistoryTx, 'sqlite') private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly sequencerService: SequencerService,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
        this.indexerService.getLatestBlockNumberForBtc()
            .then(latestBlockHeight => this.latestBlockHeightForBtc = latestBlockHeight)
            .catch(error => { throw error })
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
        for (let index = 0; index < inscriptionList.length; index++) {
            const inscription = inscriptionList[index];
            const _hashList = await this.routerService.from(inscription.content).executeTransaction(inscription)
            hashList.push(..._hashList)
        }
        this.logger.log(`[${blockHeight}] xvmInscription:${inscriptionList.length}  xvmTransaction:${hashList.length}`)
        return blockHash
    }

    get isSyncSuccess(): boolean {
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
        while (processBlockHeight <= latestBlockHeightForBtc) {
            const savedRow = await this.sequencerService.syncSequencer(processBlockHeight)
            if (latestBlockHeightForBtc - processBlockHeight <= 1) {
                latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
            }
            this.logger.log(`Sync saved ${processBlockHeight}/${latestBlockHeightForBtc} Inscription Numbers ${savedRow}`)
            processBlockHeight += 1
        }

        // Execution of synchronised transactions
        let nextSort = 10
        let history: BtcHistoryTx[] = []
        while (nextSort == 10 || history.length > 0) {
            history = await this.btcHistoryTxRepository.find({
                where: { isExecuted: false, sort: MoreThan(nextSort) },
                order: { sort: 'ASC' },
                take: 100
            })
            nextSort = history.at(history.length - 1).sort
            // execution inscription
            for (let index = 0; index < history.length; index++) {
                const record = history[index]
                const isPrecompute = record.sort.toString().slice(-1) == '1' ? true : false
                const inscription: Inscription = {
                    blockHeight: record.blockHeight,
                    inscriptionId: `${record.hash}i0`,
                    contentType: 'text/plain',
                    contentLength: record.content.length,
                    content: record.content
                }
                const hashList = await this.routerService.from(inscription.content).executeTransaction(inscription)
                this.logger.log(`⟱⟱⟱ Sync tx execution ${hashList.length} for ${record.blockHeight} ⟱⟱⟱`)
                if (!isPrecompute && record.blockHeight != history[index + 1].blockHeight) {
                    const normalMineBlockHash = this.xvmService.minterBlock(record.blockTimestamp)
                    this.logger.log(`Normal Inscription Generate Block ${record.blockHeight} is ${normalMineBlockHash}`)
                }
                await this.btcHistoryTxRepository.update(
                    { sort: record.sort },
                    { isExecuted: true }
                )
            }
        }

    }

    async run() {
        // 1. sync history tx
        await this.sync()
    }
}
