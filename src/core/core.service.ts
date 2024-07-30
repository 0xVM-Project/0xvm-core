import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import defaultConfig from 'src/config/default.config';
import { IndexerService } from 'src/indexer/indexer.service';
import { RouterService } from 'src/router/router.service';
import { sleep } from 'src/utils/times';
import { XvmService } from 'src/xvm/xvm.service';

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
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
        this.indexerService.getLatestBlockNumberForBtc()
            .then(latestBlockHeight => this.latestBlockHeightForBtc = latestBlockHeight)
            .catch(error => { throw error })
    }

    async processBlock(blockHeight: number) {
        this.xvmService.initNonce()
        const { inscriptionList, allInscriptionCount } = await this.indexerService.fetchInscription0xvmByBlock(blockHeight)
        const remainingBlock = this.latestBlockHeightForBtc - (blockHeight - 1)
        const progressRate = Number((blockHeight - 1) / this.latestBlockHeightForBtc * 100).toFixed(2)
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
        const blockHash = await this.xvmService.minterBlock()
        this.logger.log(`Generate Block ${blockHeight} is ${blockHash}`)
    }

    async run() {
        this.latestBlockHeightForBtc = await this.indexerService.getLatestBlockNumberForBtc()
        this.latestBlockHeightForXvm = await this.xvmService.getLatestBlockNumber()
        // init xvm block, Skip blocks without oxvm protocol inscriptions high
        while (this.latestBlockHeightForXvm < this.firstInscriptionBlockHeight) {
            if (this.latestBlockHeightForXvm >= this.latestBlockHeightForBtc) {
                break
            }
            this.latestBlockHeightForXvm += 1
            // create block
            await this.xvmService.minterBlock()
            if (this.latestBlockHeightForXvm % 1000 == 0 || this.latestBlockHeightForXvm == this.firstInscriptionBlockHeight) {
                this.logger.log(`Skip Block Progress ${this.latestBlockHeightForXvm}/${this.firstInscriptionBlockHeight}  ${Number(this.latestBlockHeightForXvm / this.firstInscriptionBlockHeight * 100).toFixed(4)}%`)
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
                await this.processBlock(currentBlockNumber)
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
