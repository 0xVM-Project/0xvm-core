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
        private readonly btcrpcService: BtcrpcService,
    ) {
        super()
    }

    filterInscription(inscription: Inscription): Inscription | null {
        return inscription.content.startsWith(this.version) ? inscription : null
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
        const inscriptionHash = `0x${inscription.hash}`
        let isPreExecutionInscription = false
        // command list
        this.logger.debug(`inscriptionCommandList:${JSON.stringify(inscriptionCommandList)}`)
        for (let index = 0; index < inscriptionCommandList.length; index++) {
            const inscriptionCommand = inscriptionCommandList[index]
            const actionEnum = inscriptionCommand.action as InscriptionActionEnum
            const headers = {
                [InscriptionActionEnum.prev]: this.prev.bind(this),
                [InscriptionActionEnum.deploy]: this.deploy.bind(this),
                [InscriptionActionEnum.execute]: this.execute.bind(this),
                [InscriptionActionEnum.transfer]: this.transfer.bind(this),
                [InscriptionActionEnum.deposit]: this.deposit.bind(this),
                [InscriptionActionEnum.withdraw]: this.withdraw.bind(this),
                [InscriptionActionEnum.mineBlock]: this.mineBlock.bind(this)
            }
            if (!(actionEnum in headers)) {
                this.logger.warn(`create transaction fail, Action is out of scope`)
                return []
            }
            // Pre-execution inscription head info
            if (actionEnum == InscriptionActionEnum.prev) {
                isPreExecutionInscription = true
                continue
            }
            // mine block inscription command
            if (actionEnum == InscriptionActionEnum.mineBlock) {
                await headers[actionEnum](inscriptionCommand.data, inscription).catch((error: { stack: any; }) => {
                    throw new Error(`execute transaction fail. action:${actionEnum} data:${inscriptionCommand.data}\n ${error?.stack} inscriptionId:${inscription?.inscriptionId}`)
                })
                continue
            }
            if (!xvmFrom) {
                const unSignTransaction = this.xvmService.unSignTransaction(inscriptionCommand.data)
                if (!unSignTransaction) {
                    this.logger.warn(`Invalid command hash: ${inscription?.hash} index: ${index}`)
                    continue
                }
                if (!unSignTransaction.from) {
                    this.logger.warn(`Invalid command hash: ${inscription?.hash} index: ${index}, Unable to parse the from address from signTransaction`)
                    continue
                }
                if (!unSignTransaction.to) {
                    this.logger.warn(`Invalid command hash: ${inscription?.hash} index: ${index}, Unable to parse the to address from signTransaction`)
                    continue
                }
                xvmFrom = unSignTransaction.from
                xvmTo = unSignTransaction.to
            }

            // Normal inscription command
            const hash = await headers[actionEnum](inscriptionCommand.data, inscription).catch((error: { stack: any; }) => {
                throw new Error(`execute transaction fail. action:${actionEnum} data:${inscriptionCommand.data}\n ${error?.stack} inscriptionId:${inscription?.inscriptionId}`)
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
                this.logger.log(`[${inscription.blockHeight}] Send Transaction success, action:${InscriptionActionEnum[actionEnum]}  hash: ${hash}`)
            } else {
                this.logger.warn(`[${inscription.blockHeight}] Send Transaction fail, action:${InscriptionActionEnum[actionEnum]} inscriptionId:${inscription.inscriptionId} data:${inscriptionCommand.data}`)
            }
        }

        // Pre-execution inscription rewards
        // Normal inscription rewards
        const toRewards = isPreExecutionInscription ? this.defaultConf.xvm.sysXvmAddress : xvmFrom
        this.logger.debug("isPreExecutionInscription",isPreExecutionInscription)
        if (!isPreExecutionInscription) {
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
            this.logger.log(`[${inscription?.blockHeight}] Send Inscription Rewards[546*(10^8)] success, hash: ${hash}`)
        }
        return transactionHash
    }

    async mineBlock(data: string, inscription: Inscription): Promise<string> {
        const blockHeight = parseInt(data.slice(2, 12), 16)
        const blockTimestamp = parseInt(data.slice(12), 16)
        const minterBlockHash = await this.xvmService.minterBlock(blockTimestamp)
        this.logger.log(`Precompute Inscription Generate Block ${blockHeight} is ${minterBlockHash}`)
        return minterBlockHash
    }

    async prev(data: string, inscription: Inscription): Promise<string> {
        return ''
    }

    async deploy(data: string, inscription: Inscription): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async execute(data: string, inscription: Inscription): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async transfer(data: string, inscription: Inscription): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async deposit(data: string, inscription: Inscription): Promise<string | null> {
        const unSignTransaction = this.xvmService.unSignTransaction(data)
        if (!unSignTransaction) {
            this.logger.warn(`Invalid command hash: ${inscription?.hash}`)
            return null
        }
        if (!unSignTransaction.from) {
            this.logger.warn(`Invalid command hash: ${inscription?.hash}, Unable to parse the from address from signTransaction`)
            return null
        }
        const to = unSignTransaction.from
        const txid = inscription.hash
        const depositOutput = await this.ordService.getInscriptionTxOutput(txid, 1)
        if (!depositOutput) {
            this.logger.warn(`Invalid deposit. No deposit funds were sent. inscriptionId:${inscription.inscriptionId} sender:${unSignTransaction.from} inscriptionId:${inscription.inscriptionId}`)
            return null
        }
        const { scriptPubKey: { address }, value } = depositOutput
        // If the output1 address is not the deposit address, the deposit is invalid.
        if (this.defaultConf.wallet.fundingAddress != address) {
            this.logger.warn(`Invalid deposit. Invalid funds deposit address. inscriptionId:${inscription.inscriptionId} sender:${unSignTransaction.from}  deposit system address:${address}`)
            return null
        }
        return await this.xvmService.depositTransfer(to, ethers.parseEther(value.toString()))
    }

    async withdraw(data: string, inscription: Inscription): Promise<string | null> {
        const unSignTransaction = this.xvmService.unSignTransaction(data)
        if (!unSignTransaction) {
            this.logger.warn(`Invalid SignTransaction, cannot be parsed, hash=${inscription.hash}`)
            return null
        }
        // verify withdraw command tx 
        if (this.defaultConf.xvm.xbtcPoolAddress.toLowerCase() != unSignTransaction.to?.toLowerCase()) {
            this.logger.warn(`Invalid withdraw command(err Contract:${unSignTransaction.to}). inscriptionId:${inscription?.inscriptionId} sender:${unSignTransaction.from} withdraw amount:${unSignTransaction.value.toString()} wei`)
            return null
        }
        if (unSignTransaction.data != '0xd0e30db0') {
            this.logger.warn(`Invalid withdraw command(err input data: ${unSignTransaction.data}). inscriptionId:${inscription?.inscriptionId} sender:${unSignTransaction.from} withdraw amount:${unSignTransaction.value.toString()} wei`)
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
                    if (!content || action === undefined || action === null) {
                        continue
                    }
                    // check data
                    if (!content.data()?.startsWith('0x')) {
                        this.logger.warn(`Command data error, must start with 0x.`)
                        continue
                    }
                    if (![0, 1, 2, 3, 4, 5, 6].includes(action)) {
                        this.logger.warn(`Command action error, must in [0,1,2,3,4,5,6].`)
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
        if (command.length == 0) {
            throw new Error(`Invalid inscription code, cannot be parsed`)
        }
        const firstCommand = command[0]
        const endCommand = command[command.length - 1]
        const isPrecompute = firstCommand.action == 0 ? true : false

        const blockHeight = parseInt(endCommand.data.slice(2, 12), 16)
        const mineTimestamp = parseInt(endCommand.data.slice(12), 16)
        return {
            isPrecompute: isPrecompute,
            mineTimestamp: mineTimestamp,
            prevHash: isPrecompute ? firstCommand.data : ''
        }
    }

    base64Encode = (_array?: Uint8Array) => {
        let result: string | undefined = undefined;

        if (_array && _array?.length) {
            try {
                result = Buffer.from(_array).toString('base64');
            } catch (error) {
                this.logger.error("base64Decode error: ", error);
            }
        }

        return result;
    };

    flatbuffersEncode(_array: Array<CommandsV1Type>) {
        let result: Uint8Array | undefined = undefined;
        const builder = new flatbuffers.Builder(0);

        if (_array && _array?.length) {
            const contentOffset = _array.map((_item) => {
                const dataOffset = builder.createString(_item.data);
                Flatbuffers.Data.startData(builder);
                Flatbuffers.Data.addAction(builder, _item.action);
                Flatbuffers.Data.addData(builder, dataOffset);
                return Flatbuffers.Data.endData(builder);
            });

            const contentVectorOffset = Flatbuffers.Transaction.createContentVector(builder, contentOffset);
            Flatbuffers.Transaction.startTransaction(builder);
            Flatbuffers.Transaction.addContent(builder, contentVectorOffset);
            const transactionOffset = Flatbuffers.Transaction.endTransaction(builder);
            builder.finish(transactionOffset);
            result = builder.asUint8Array();
        }

        return result;
    }

    encodeInscription(_array: Array<CommandsV1Type>): string | null {
        let result: string | undefined = undefined;

        if (_array && _array?.length) {
            const flatbuffersEncodeArray = this.flatbuffersEncode(_array);
            const base64EncodeString = this.base64Encode(flatbuffersEncodeArray);
            result = this.version + base64EncodeString
        }

        return result ?? null;
    }
}
