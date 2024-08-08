import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import defaultConfig from 'src/config/default.config';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { IndexerService } from 'src/indexer/indexer.service';
import { HashMappingService } from 'src/router/protocol/hash-mapping/hash-mapping.service';
import { RouterService } from 'src/router/router.service';
import { isSequential } from 'src/utils/arr';
import { sleep } from 'src/utils/times';
import { XvmService } from 'src/xvm/xvm.service';
import { LessThan, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class CoreService {
    private readonly logger = new Logger(CoreService.name)
    private readonly firstInscriptionBlockHeight: number
    private readonly retryCount: number = 6
    private latestBlockHeightForBtc: number
    private latestBlockHeightForXvm: number
    private diffBlock: number

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        @InjectRepository(BlockHashSnapshot) private readonly blockHashSnapshotRepository: Repository<BlockHashSnapshot>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly btcrpcService: BtcrpcService,
        private readonly hashMappingService: HashMappingService,
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

    async revertBlock(findBlockHeight: number): Promise<number> {
        const confirmBlockHeight = this.defaultConf.bitcoind.confirmBlockHeight
        const { result: findBlockHash } = await this.btcrpcService.getblockhash(findBlockHeight)
        const result = await this.blockHashSnapshotRepository.find({
            order: {
                blockHeight: 'DESC'
            },
            take: confirmBlockHeight
        })
        if (result.length == 0) {
            return findBlockHeight
        }
        const latestBlock = result?.at(0)
        const rangeBlockHeight = result.map(d => d.blockHeight).reverse()
        // check block height range sequence
        const blockHeightSequentialStatus = isSequential(rangeBlockHeight)
        if (!blockHeightSequentialStatus) {
            throw new Error(`Snapshot data is abnormal, and there is missing block information. Block Height range: ${JSON.stringify(rangeBlockHeight ?? [])}`)
        }
        // Compare the snapshot data with the latest block data and return the block height that needs to be rolled back
        let revertBlock = {
            blockHeight: findBlockHeight,
            blockHash: findBlockHash
        }
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
                revertBlock = {
                    blockHeight: snapshot.blockHeight,
                    blockHash: blockHashByNetwork
                }
            }
            index++
        }
        if (revertBlock.blockHeight != findBlockHeight) {
            // todo: revertBlock
            const state = await this.xvmService.revertBlock(revertBlock.blockHeight - 1)
            if (state != true) {
                throw new Error(`Revert Block [${revertBlock.blockHeight}] fail. `)
            }
            await this.blockHashSnapshotRepository.delete({
                blockHeight: MoreThanOrEqual(revertBlock.blockHeight)
            })
            return revertBlock.blockHeight
        }
        return latestBlock.blockHeight + 1
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
        // create block
        const minterBlockHash = await this.xvmService.minterBlock(blockTimestamp)
        this.logger.log(`Generate Block ${blockHeight} is ${minterBlockHash}`)
        // block hash mapping xvm
        await this.hashMappingService.bindHash({
            btcHash: blockHash,
            xvmHash: minterBlockHash,
            logIndex: 0
        })
        return blockHash
    }

    async run() {
        this.latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        this.latestBlockHeightForXvm = await this.xvmService.getLatestBlockNumber()
        const { result: skipBtcBlockHash } = await this.btcrpcService.getblockhash(this.latestBlockHeightForXvm)
        const { result: { time: latestBtcBlockTimestamp } } = await this.btcrpcService.getBlockheader(skipBtcBlockHash)
        // init xvm block, Skip blocks without oxvm protocol inscriptions high
        let skipMinterBlockTimestamp = latestBtcBlockTimestamp
        let skipBlockStartTime = Date.now()
        let skipCostTimestamp = 0
        while (this.latestBlockHeightForXvm < this.firstInscriptionBlockHeight) {
            if (this.latestBlockHeightForXvm >= this.latestBlockHeightForBtc) {
                break
            }
            this.latestBlockHeightForXvm += 1
            // create block
            await this.xvmService.minterBlock(skipMinterBlockTimestamp)
            skipMinterBlockTimestamp += 1
            if (this.latestBlockHeightForXvm % 1000 == 0 || this.latestBlockHeightForXvm == this.firstInscriptionBlockHeight) {
                skipCostTimestamp = Date.now() - skipBlockStartTime
                this.logger.log(`Skip Block Progress ${this.latestBlockHeightForXvm}/${this.firstInscriptionBlockHeight}  ${Number(this.latestBlockHeightForXvm / this.firstInscriptionBlockHeight * 100).toFixed(4)}%  cost time: ${skipCostTimestamp}ms(${skipCostTimestamp / 1000}s)`)
                skipBlockStartTime = Date.now()
            }
        }
        let retryTotal = 0
        while (true) {
            try {
                if (retryTotal > this.retryCount) {
                    this.logger.warn(`Retry failed several times, please manually process`)
                    break
                }
                this.latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
                this.latestBlockHeightForXvm = await this.xvmService.getLatestBlockNumber()
                this.diffBlock = this.latestBlockHeightForBtc - this.latestBlockHeightForXvm
                if (this.diffBlock <= 0) {
                    this.logger.log(`[${this.latestBlockHeightForXvm}/${this.latestBlockHeightForBtc}] Waiting for new blocks`)
                    await sleep(10000)
                    continue
                }
                const currentBlockNumber = this.latestBlockHeightForXvm == 0 ? this.latestBlockHeightForXvm : this.latestBlockHeightForXvm + 1
                const finalBlockHeight = await this.revertBlock(currentBlockNumber)
                const processBlockHash = await this.processBlock(finalBlockHeight)
                await this.snapshotBlock(finalBlockHeight, processBlockHash)
                retryTotal = 0
            } catch (error) {
                retryTotal += 1
                this.logger.error(error instanceof Error ? error.stack : error)
                this.logger.log(`Try retrying ${retryTotal}`)
                await sleep(2000 + 2000 * retryTotal)
            }
        }
    }
}
