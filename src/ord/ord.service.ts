import { Injectable, Logger } from "@nestjs/common";
import { Inscription, InscriptionService } from "./inscription.service";
import { BtcrpcService } from "src/common/api/btcrpc/btcrpc.service";

@Injectable()
export class OrdService {
    private readonly logger = new Logger(InscriptionService.name)
    private nextBlock: { blockHeight: number, blockHash: string }

    constructor(
        private readonly ordService: InscriptionService,
        private readonly btcrpcService: BtcrpcService,
    ) { }

    async getInscriptionByBlockHeight(blockHeight: number) {
        let blockHash = ''
        if (this.nextBlock && this.nextBlock.blockHeight == blockHeight && this.nextBlock.blockHash) {
            blockHash = this.nextBlock.blockHash
        } else {
            const getBlockHashResponse = await this.btcrpcService.getblockhash(blockHeight)
            blockHash = getBlockHashResponse.result
        }
        if (!blockHash || blockHash.length == 0) {
            throw new Error(`getInscriptionByBlockHeight fail. [${blockHeight}] Block hash is empty`)
        }
        const block = await this.btcrpcService.getBlock(blockHash, 2)
        const { nextblockhash, time, height } = block.result
        this.nextBlock = {
            blockHeight: height + 1,
            blockHash: nextblockhash
        }
        const inscriptionList: Array<Inscription> = []
        for (const tx of block.result.tx) {
            const inscription = this.ordService.getInscriptionContentData(tx.txid, tx.vin[0].txinwitness)
            if (inscription) {
                inscriptionList.push(inscription)
            }
        }
        return {
            inscriptionList: inscriptionList,
            nextblockhash: nextblockhash,
            blockTimestamp: time
        }
    }
}