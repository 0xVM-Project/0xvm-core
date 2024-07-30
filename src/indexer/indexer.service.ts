import { Inject, Injectable, Logger } from '@nestjs/common';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { InscriptionType } from './indexer.interface';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import { RouterService } from 'src/router/router.service';
import { OrdService } from 'src/ord/ord.service';
import { Inscription } from 'src/ord/inscription.service';

@Injectable()
export class IndexerService {
    private readonly logger = new Logger(IndexerService.name)
    @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>

    constructor(
        private readonly btcrpcService: BtcrpcService,
        private readonly ordinalsService: OrdinalsService,
        private readonly ordService: OrdService,
        private readonly routerService: RouterService,
    ) { }

    async getLatestBlockNumberForBtc(): Promise<number> {
        const { result: { blocks } } = await this.btcrpcService.getBlockchainInfoForBtc()
        return blocks
    }

    async fetchInscription0xvmForOrdinalsByBlock(blockHeight: string | number): Promise<Array<InscriptionType>> {
        if (Number.isNaN(blockHeight)) {
            throw new Error(`blockHeight cannot be nan`)
        }
        const blockInscriptionResponse = await this.ordinalsService.getBlockInscription(blockHeight)
        if (blockInscriptionResponse.status !== 200) {
            throw new Error(`get block inscription fail`)
        }
        const { data: { block_count, inscriptions } } = blockInscriptionResponse
        const allInscriptionCount = inscriptions.length
        const inscriptionFor0xvmList: Array<InscriptionType> = []
        for await (const inscription of inscriptions) {
            const { entry: { id, inscription_number, timestamp }, content } = inscription
            const inscriptionContent = {
                latestOrdBlock: block_count,
                blockHeight: Number(blockHeight),
                inscriptionId: id,
                inscriptionNumber: inscription_number,
                content: content,
                timestamp: timestamp
            }
            const inscriptionFor0xvm = this.routerService.from(inscriptionContent.content).filterInscription(inscriptionContent)
            if (inscriptionFor0xvm) {
                inscriptionFor0xvmList.push(inscriptionContent)
            }
        }
        const message = `Block [${blockHeight}/${block_count}] InscriptionTotal:${allInscriptionCount}  Inscription0xvmCount:${inscriptionFor0xvmList.length}`
        this.logger.log(message)
        return inscriptionFor0xvmList
    }

    async fetchInscription0xvmByBlock(blockHeight: string | number): Promise<{ inscriptionList: Inscription[], nextBlockHash: string, allInscriptionCount: number }> {
        if (Number.isNaN(blockHeight)) {
            throw new Error(`blockHeight cannot be nan`)
        }
        const { inscriptionList, nextblockhash, blockTimestamp } = await this.ordService.getInscriptionByBlockHeight(Number(blockHeight))

        const allInscriptionCount = inscriptionList.length
        const inscriptionFor0xvmList: Array<Inscription> = []
        for await (const inscription of inscriptionList) {
            const { inscriptionId, content } = inscription
            const inscriptionContent: Inscription = {
                blockHeight: Number(blockHeight),
                inscriptionId: inscriptionId,
                content: content,
                contentLength: inscription.contentLength,
                contentType: inscription.contentType,
                timestamp: blockTimestamp
            }
            const inscriptionFor0xvm = this.routerService.from(inscriptionContent.content).filterInscription(inscriptionContent)
            if (inscriptionFor0xvm) {
                inscriptionFor0xvmList.push(inscriptionContent)
            }
        }
        return {
            inscriptionList: inscriptionFor0xvmList,
            nextBlockHash: nextblockhash,
            allInscriptionCount: allInscriptionCount
        }
    }
}
