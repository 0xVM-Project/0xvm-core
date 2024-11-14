import { Inject, Injectable, Logger } from '@nestjs/common';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { RouterService } from 'src/router/router.service';
import { OrdService } from 'src/ord/ord.service';
import { Inscription } from 'src/ord/inscription.service';

@Injectable()
export class IndexerService {
    private readonly logger = new Logger(IndexerService.name)
    @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>

    constructor(
        private readonly btcrpcService: BtcrpcService,
        private readonly ordService: OrdService,
        private readonly routerService: RouterService,
    ) { }

    async getLatestBlockNumberForBtc(): Promise<number> {
        const { result: { blocks } } = await this.btcrpcService.getBlockchainInfoForBtc()
        return blocks
    }

    async getLatestBlockInfoForBtc(): Promise<{ block: number, timestamp: number }> {
        const { result: { blocks, time } } = await this.btcrpcService.getBlockchainInfoForBtc()
        return { block: blocks, timestamp: time }
    }

    async fetchInscription0xvmByBlock(blockHeight: string | number): Promise<{ inscriptionList: Inscription[], nextBlockHash: string, blockHash: string, allInscriptionCount: number, blockTimestamp: number }> {
        if (Number.isNaN(blockHeight)) {
            throw new Error(`blockHeight cannot be nan`)
        }
        const { inscriptionList, nextblockhash, blockTimestamp, blockHash } = await this.ordService.getInscriptionByBlockHeight(Number(blockHeight))

        const allInscriptionCount = inscriptionList.length
        const inscriptionFor0xvmList: Array<Inscription> = []
        for await (const inscription of inscriptionList) {
            const { inscriptionId, content, hash } = inscription
            const inscriptionContent: Inscription = {
                blockHeight: Number(blockHeight),
                inscriptionId: inscriptionId,
                content: content,
                contentLength: inscription.contentLength,
                contentType: inscription.contentType,
                timestamp: blockTimestamp,
                hash
            }
            const inscriptionFor0xvm = this.routerService.from(inscriptionContent.content).filterInscription(inscriptionContent)
            if (inscriptionFor0xvm) {
                inscriptionFor0xvmList.push(inscriptionContent)
            }
        }
        return {
            inscriptionList: inscriptionFor0xvmList,
            nextBlockHash: nextblockhash,
            blockHash: blockHash,
            allInscriptionCount: allInscriptionCount,
            blockTimestamp: blockTimestamp
        }
    }

    /**
     * Get the Genesis Inscription Address
     * @param inscriptionIdOrTxid 
     */
    async getGenesisInscriptionAddress(inscriptionIdOrTxid: string): Promise<string> {
        if (!inscriptionIdOrTxid || inscriptionIdOrTxid.length < 64) {
            throw new Error(`Error: Inscription ID or transaction hash must be passed in`)
        }
        const txid = inscriptionIdOrTxid.slice(0, 64)
        const inscriptionTx = await this.btcrpcService.getRawtransaction(txid)
        // Finding sources of funding for inscriptions
        const fundsTx = await this.btcrpcService.getRawtransaction(inscriptionTx.result.vin[0].txid)
        const utxoSourcesTx = await this.btcrpcService.getRawtransaction(fundsTx.result.vin[0].txid)
        const fundsSources = utxoSourcesTx.result.vout[fundsTx.result.vin[0].vout]
        return fundsSources.scriptPubKey.address
    }

    async fetchNormalInscription0xvmByBlock(blockHeight: number){
        if (Number.isNaN(blockHeight)) {
            throw new Error(`blockHeight cannot be nan`)
        }

        const { inscriptionList, nextblockhash, blockTimestamp, blockHash } = await this.ordService.getInscriptionByBlockHeight(Number(blockHeight))
        const allInscriptionCount = inscriptionList.length
        const inscriptionFor0xvmList: Array<Inscription> = []

        for await (const inscription of inscriptionList) {
            const { inscriptionId, content, hash } = inscription
            const inscriptionContent: Inscription = {
                blockHeight: Number(blockHeight),
                inscriptionId: inscriptionId,
                content: content,
                contentLength: inscription.contentLength,
                contentType: inscription.contentType,
                timestamp: blockTimestamp,
                hash
            }
            const protocol = this.routerService.from(inscriptionContent.content);

            if(protocol){
                const filterInscription = protocol.filterInscription(inscriptionContent);

                if(filterInscription){
                    const inscriptionFor0xvm = protocol.isPrecomputeInscription(filterInscription.content)

                    if (inscriptionFor0xvm && !inscriptionFor0xvm.isPrecompute) {
                        inscriptionFor0xvmList.push(inscriptionContent)
                    }
                }
            }
        }

        return {
            inscriptionList: inscriptionFor0xvmList,
            nextBlockHash: nextblockhash,
            blockHash: blockHash,
            allInscriptionCount: allInscriptionCount,
            blockTimestamp: blockTimestamp
        }
    }
}
