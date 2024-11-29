import { Injectable, Logger } from "@nestjs/common";
import { Inscription, InscriptionService } from "./inscription.service";
import { BtcrpcService } from "src/common/api/btcrpc/btcrpc.service";
import { BlockTxOutput } from "src/common/api/btcrpc/btcrpc.interface";
import { CoreService } from "src/core/core.service";

@Injectable()
export class OrdService {
    private readonly logger = new Logger(InscriptionService.name)
    private nextBlock: { blockHeight: number, blockHash: string }
    private outputFor0xvm: Record<string, BlockTxOutput[]> = {}

    constructor(
        private readonly ordService: InscriptionService,
        private readonly btcrpcService: BtcrpcService,
    ) { }

    async getInscriptionByTxid(txid: string): Promise<Inscription | null> {
        const rawTransactionResponse = await this.btcrpcService.getRawtransaction(txid)
        const tx = rawTransactionResponse.result
        return this.ordService.getInscriptionContentData(tx.txid, tx.vin[0].txinwitness)
    }

    async getInscriptionByBlockHeight(blockHeight: number) {
        this.outputFor0xvm = {}
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
                inscriptionList.push({ ...inscription, hash: tx?.txid ?? "" })
                this.outputFor0xvm[tx.txid] = tx.vout
            }
        }
        return {
            inscriptionList: inscriptionList,
            nextblockhash: nextblockhash,
            blockHash: blockHash,
            blockTimestamp: time
        }
    }

    async getInscriptionTxOutput(txid: string, index = 1): Promise<BlockTxOutput | null> {
        try {
            if (this.outputFor0xvm && txid in this.outputFor0xvm && this.outputFor0xvm[txid].length > index) {
                return this.outputFor0xvm[txid].at(index) ?? null
            } else {
                const { result } = await this.btcrpcService.getRawtransaction(txid)
                const vout = result.vout
                if (vout.length < index + 1) {
                    return null
                }
                return result.vout[index]
            }
        } catch (err) {
            throw new Error(`Failed to obtain the recharge fund transfer address. txid=${txid}  ${err instanceof Error ? err?.stack : err}`)
        }
    }

    async getInscriptionGenesisAddress(txid: string) {
        try {
            const { result: result } = await this.btcrpcService.getRawtransaction(txid)
            const vin0 = result.vin[0]
            const transferVin0 = (await this.btcrpcService.getRawtransaction(vin0.txid)).result.vin[0]
            const origin = await this.btcrpcService.getRawtransaction(transferVin0.txid)
            const { scriptPubKey: { address } } = origin.result.vout[transferVin0.vout]
            return address
        } catch (error) {
            throw new Error(`[GetInscriptionGenesisAddress] Failed to fetch inscription genesis address. Caused by: ${error instanceof Error ? error.stack : error}`)
        }
    }
}