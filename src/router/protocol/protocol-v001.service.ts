import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProtocolVersionEnum } from '../router.enum';
import { CommandsV1Type } from '../interface/protocol.interface'
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import * as Flatbuffers from "./flatbuffers/output/zxvm";
import * as flatbuffers from "flatbuffers";
import { XvmService } from 'src/xvm/xvm.service';
import { ethers } from 'ethers';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { HashMappingService } from './hash-mapping/hash-mapping.service';
import { OrdService } from 'src/ord/ord.service';
import { Inscription } from 'src/ord/inscription.service';
import { ProtocolBase } from './protocol-base';
import { InjectRepository } from '@nestjs/typeorm';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { Repository } from 'typeorm';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';


@Injectable()
export class ProtocolV001Service extends ProtocolBase<Inscription, CommandsV1Type> {
    private readonly logger = new Logger(ProtocolV001Service.name)
    public readonly version = ProtocolVersionEnum['0f0001']

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly xvmService: XvmService,
        private readonly hashMappingService: HashMappingService,
        private readonly ordService: OrdService,
        @InjectRepository(BtcHistoryTx) private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly btcrpcService: BtcrpcService,
    ) {
        super()
    }

    filterInscription(ordiInscriptionsContent: Inscription): Inscription | null {
        return ordiInscriptionsContent.content.startsWith(this.version) ? ordiInscriptionsContent : null
    }

    decodeInscription(inscriptionContent: string): Array<CommandsV1Type> {
        const base64String = inscriptionContent.slice(6)
        const base64Decode = this.base64Decode(base64String)
        return this.flatbuffersDecode(base64Decode)
    }

    async executeTransaction(inscription: Inscription): Promise<Array<string>> {
        if (!inscription?.content || !inscription?.inscriptionId) {
            throw new Error(`Inscription content or inscription id cannot be empty`)
        }
        // ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61bi0
        if (inscription.inscriptionId.length != 66) {
            throw new Error(`Invalid inscription id, length must be 64, currently ${inscription.inscriptionId?.length}`)
        }
        const transactionHash: string[] = []
        const inscriptionCommandList = this.decodeInscription(inscription.content)
        let xvmFrom: string = ''
        let xvmTo: string = ''
        let logIndex: number = 0
        const inscriptionHash = `0x${inscription.inscriptionId.slice(0, -2)}`
        let isPreExecutionInscription = false
        // command list
        for (const inscriptionCommand of inscriptionCommandList) {
            const headers = {
                [InscriptionActionEnum.prev]: this.prev.bind(this),
                [InscriptionActionEnum.deploy]: this.deploy.bind(this),
                [InscriptionActionEnum.execute]: this.execute.bind(this),
                [InscriptionActionEnum.transfer]: this.transfer.bind(this),
                [InscriptionActionEnum.deposit]: this.deposit.bind(this),
                [InscriptionActionEnum.withdraw]: this.withdraw.bind(this),
                [InscriptionActionEnum.mineBlock]: this.mineBlock.bind(this)
            }
            if (!(inscriptionCommand.action in headers)) {
                this.logger.warn(`create transaction fail, Action is out of scope`)
                return null
            }
            // Pre-execution inscription head info
            if (inscriptionCommand.action == InscriptionActionEnum.prev) {
                isPreExecutionInscription = true
                continue
            }
            // mine block inscription command
            if (inscriptionCommand.action == InscriptionActionEnum.mineBlock) {
                await headers[inscriptionCommand.action](inscriptionCommand.data, inscription).catch(error => {
                    throw new Error(`execute transaction fail. action:${inscriptionCommand.action} data:${inscriptionCommand.data}\n ${error?.stack} inscriptionId:${inscription?.inscriptionId}`)
                })
                continue
            }
            if (!xvmFrom) {
                const unsingTransaction = this.xvmService.unSignTransaction(inscriptionCommand.data)
                xvmFrom = unsingTransaction.from
                xvmTo = unsingTransaction.to
            }

            // Normal inscription command
            const hash = await headers[inscriptionCommand.action](inscriptionCommand.data, inscription).catch(error => {
                throw new Error(`execute transaction fail. action:${inscriptionCommand.action} data:${inscriptionCommand.data}\n ${error?.stack} inscriptionId:${inscription?.inscriptionId}`)
            })
            if (hash) {
                // hash mapping
                await this.hashMappingService.bindHash({
                    xFromAddress: xvmFrom ?? '',
                    xToAddress: xvmTo ?? '',
                    btcHash: inscriptionHash,
                    xvmHash: hash,
                    logIndex: logIndex
                })
                logIndex += 1
                transactionHash.push(hash)
                this.logger.log(`[${inscription.blockHeight}] Send Transaction success, action:${InscriptionActionEnum[inscriptionCommand.action]}  hash: ${hash}`)
            } else {
                this.logger.warn(`[${inscription.blockHeight}] Send Transaction fail, action:${InscriptionActionEnum[inscriptionCommand.action]} inscriptionId:${inscription.inscriptionId} data:${inscriptionCommand.data}`)
            }
        }

        // Pre-execution inscription rewards
        // Normal inscription rewards
        const toRewards = isPreExecutionInscription ? this.defaultConf.xvm.sysXvmAddress : xvmFrom
        const hash = await this.xvmService.rewardsTransfer(toRewards).catch(error => {
            throw new Error(`inscription rewards fail. sysAddress: ${this.xvmService.sysAddress} to: ${toRewards} inscriptionId: ${inscription.inscriptionId}\n ${error?.stack}`)
        })
        if (hash) {
            // hash mapping        
            await this.hashMappingService.bindHash({
                xFromAddress: xvmFrom ?? '',
                xToAddress: xvmTo ?? '',
                btcHash: inscriptionHash,
                xvmHash: hash,
                logIndex: logIndex
            })
            transactionHash.push(hash)
        }
        this.logger.log(`[${inscription.blockHeight}] Send Inscription Rewards[546*(10^8)] success, hash: ${hash}`)
        return transactionHash
    }

    async mineBlock(data: string, inscription: Inscription): Promise<string> {
        const blockHeight = parseInt(data.slice(2, 12), 16)
        const blockTimestamp = parseInt(data.slice(12), 16)
        const minterBlockHash = await this.xvmService.minterBlock(blockTimestamp)
        this.logger.log(`Precompute Inscription Generate Block ${blockHeight} is ${minterBlockHash}`)
        return minterBlockHash
    }

    async prev(data: string, inscription: Inscription) {
        return null
    }

    async deploy(data: string, inscription: Inscription) {
        return await this.xvmService.sendRawTransaction(data)
    }

    async execute(data: string, inscription: Inscription): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async transfer(data: string, inscription: Inscription): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async deposit(data: string, inscription: Inscription): Promise<string> {
        const unsingTransaction = this.xvmService.unSignTransaction(data)
        const to = unsingTransaction.from
        const txid = inscription.inscriptionId.slice(0, -2)
        const depositOutput = await this.ordService.getInscriptionTxOutput(txid, 1)
        if (!depositOutput) {
            this.logger.warn(`Invalid deposit. No deposit funds were sent. inscriptionId:${inscription.inscriptionId} sender:${unsingTransaction.from} inscriptionId:${inscription.inscriptionId}`)
            return null
        }
        const { scriptPubKey: { address }, value } = depositOutput
        // If the deposit address is not the system address, the deposit is invalid.
        if (this.defaultConf.xvm.sysBtcAddress != address) {
            this.logger.warn(`Invalid deposit. Invalid funds deposit address. inscriptionId:${inscription.inscriptionId} sender:${unsingTransaction.from}  deposit system address:${address}`)
            return null
        }
        return await this.xvmService.depositTransfer(to, ethers.parseEther(value.toString()))
    }

    async withdraw(data: string, inscription: Inscription): Promise<string> {
        const unsingTransaction = this.xvmService.unSignTransaction(data)
        // verify withdraw command tx 
        if (this.defaultConf.xvm.xbtcPoolAddress.toLowerCase() != unsingTransaction.to.toLowerCase()) {
            this.logger.warn(`Invalid withdraw command(err Contract:${unsingTransaction.to}). inscriptionId:${inscription?.inscriptionId} sender:${unsingTransaction.from} withdraw amount:${unsingTransaction.value.toString()} wei`)
            return null
        }
        if (unsingTransaction.data != '0xd0e30db0') {
            this.logger.warn(`Invalid withdraw command(err input data: ${unsingTransaction.data}). inscriptionId:${inscription?.inscriptionId} sender:${unsingTransaction.from} withdraw amount:${unsingTransaction.value.toString()} wei`)
            return null
        }
        // Deduction of xBTC balance
        return await this.xvmService.sendRawTransaction(data)
    }

    base64Decode(base64String: string): Uint8Array {
        let result = new Uint8Array();
        if (base64String) {
            try {
                result = new Uint8Array(Buffer.from(base64String, "base64"));
            } catch (error) {
                this.logger.error("base64Decode error: ", error);
            }
        }
        return result
    }

    flatbuffersDecode(content: Uint8Array): Array<CommandsV1Type> {
        let result: Array<CommandsV1Type> = []

        if (content && content?.length > 0) {
            const transactions = Flatbuffers.Transaction.getRootAsTransaction(
                new flatbuffers.ByteBuffer(content)
            )

            if (transactions && transactions?.contentLength() > 0) {
                for (let i = 0; i < transactions?.contentLength(); i++) {
                    const content = transactions.content(i)
                    const action = content?.action()
                    // check data
                    if (!content?.data().startsWith('0x')) {
                        this.logger.warn(`Command data error, must start with 0x.`)
                        continue
                    }
                    if (![1, 2, 3, 4, 5].includes(action)) {
                        this.logger.warn(`Command action error, must in [1,2,3,4,5].`)
                        continue
                    }
                    const data = content?.data() as `0x${string}`
                    result.push({ action, data })
                }
            }
        }
        return result
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

    isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string } {
        if (!inscriptionContent.startsWith(this.version)) {
            throw new Error(`protocol: ${inscriptionContent.slice(0, 6)} Invalid or incompatible with current protocol version.`)
        }
        const command = this.decodeInscription(inscriptionContent)
        const firstCommand = command.at(0)
        const endCommand = command.at(command.length - 1)
        const isPrecompute = firstCommand.action == 0 ? true : false

        const blockHeight = parseInt(endCommand.data.slice(2, 12), 16)
        const mineTimestamp = parseInt(endCommand.data.slice(12), 16)
        return {
            isPrecompute: isPrecompute,
            mineTimestamp: mineTimestamp,
            prevHash: isPrecompute ? firstCommand.data : null
        }
    }
}
