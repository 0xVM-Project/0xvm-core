import { Inject, Injectable, Logger } from '@nestjs/common';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { InscriptionType } from './indexer.interface';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import { RouterService } from 'src/router/router.service';

@Injectable()
export class IndexerService {
    private readonly logger = new Logger(IndexerService.name)
    @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>

    constructor(
        private readonly btcrpcService: BtcrpcService,
        private readonly ordinalsService: OrdinalsService,
        private readonly routerService: RouterService,
    ) { }

    async getLatestBlockNumberForBtc(): Promise<number> {
        const { result: { blocks } } = await this.btcrpcService.getBlockchainInfoForBtc()
        return blocks
    }

    async fetchInscription0xvmByBlock(blockHeight: string | number): Promise<Array<InscriptionType>> {
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
}
