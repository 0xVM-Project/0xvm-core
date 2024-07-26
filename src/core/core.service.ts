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

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
        private readonly xvmService: XvmService,
        private readonly ordinalsService: OrdinalsService,
    ) {
        this.firstInscriptionBlockHeight = this.defaultConf.xvm.firstInscriptionBlockHeight
    }

    async processBlock(blockHeight: number) {
        this.xvmService.initNonce()
        const inscriptionList = await this.indexerService.fetchInscription0xvmByBlock(blockHeight)
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
        let btcLatestBlockNumber: number = await this.indexerService.getLatestBlockNumberForBtc()
        let xvmLatestBlockNumber: number = await this.xvmService.getLatestBlockNumber()
        let ordinalsBlockNumber: number = await this.ordinalsService.getBlockheight()
        // init xvm block, Skip blocks without oxvm protocol inscriptions high
        while (xvmLatestBlockNumber < this.firstInscriptionBlockHeight) {
            if (xvmLatestBlockNumber >= btcLatestBlockNumber) {
                break
            }
            xvmLatestBlockNumber += 1
            // create block
            await this.xvmService.minterBlock()
            if (xvmLatestBlockNumber % 1000 == 0 || xvmLatestBlockNumber == this.firstInscriptionBlockHeight) {
                this.logger.log(`Skip Block Progress ${xvmLatestBlockNumber}/${this.firstInscriptionBlockHeight}  ${Number(xvmLatestBlockNumber / this.firstInscriptionBlockHeight * 100).toFixed(4)}%`)
            }
        }
        let retryTotal = 0
        while (true) {
            try {
                if (retryTotal > this.retryCount) {
                    this.logger.warn(`Retry failed several times, please manually process`)
                    break
                }
                btcLatestBlockNumber = await this.indexerService.getLatestBlockNumberForBtc()
                xvmLatestBlockNumber = await this.xvmService.getLatestBlockNumber()
                ordinalsBlockNumber = await this.ordinalsService.getBlockheight()
                const currentBlockNumber = xvmLatestBlockNumber == 0 ? xvmLatestBlockNumber : xvmLatestBlockNumber + 1
                if ((ordinalsBlockNumber > 0 && currentBlockNumber > ordinalsBlockNumber) || currentBlockNumber > btcLatestBlockNumber) {
                    this.logger.log(`[${currentBlockNumber}/${btcLatestBlockNumber}] Waiting for new blocks`)
                    await sleep(10000)
                    continue
                }
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
