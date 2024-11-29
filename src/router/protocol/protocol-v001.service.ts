import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProtocolVersionEnum } from '../router.enum';
import { BaseCommandsType, CommandsV1Type, ExecutionModeEnum } from '../interface/protocol.interface'
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
import { inspect } from 'util';
import { capitalizeFirstLetter } from 'src/utils/str.utils';
import { HashMappingInterface } from './hash-mapping/hash.interface';


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

    async inscriptionRewards(rewardReceiveAddress: string, inscriptionHash: string, executionMode: ExecutionModeEnum = ExecutionModeEnum.Normal) {
        const title = `RewardXBTC-${capitalizeFirstLetter(executionMode)}`
        if (rewardReceiveAddress) {
            const rewardsTransferResponse = await this.xvmService.rewardsTransfer(rewardReceiveAddress)
            if ('result' in rewardsTransferResponse) {
                try {
                    // hash mapping
                    const latestHashMappingByBtcHash = await this.hashMappingService.getMappingHashByTxid(inscriptionHash)
                    const logIndex = latestHashMappingByBtcHash ? latestHashMappingByBtcHash.logIndex + 1 : 0
                    const rewardTransactionMappingHash: HashMappingInterface = {
                        xFromAddress: this.xvmService.sysAddress,
                        xToAddress: rewardReceiveAddress,
                        btcHash: inscriptionHash,
                        xvmHash: rewardsTransferResponse.result,
                        logIndex: logIndex
                    }
                    await this.hashMappingService.bindHash(rewardTransactionMappingHash)
                } catch (error) {
                    const newError = new Error(`[${title}] Reward mapping hash failed. Inscription Hash: ${inscriptionHash}`)
                    newError.stack = `${newError.stack}\n  Caused by: ${error instanceof Error ? error.stack : error}`
                    throw newError
                }
            } else {
                this.logger.warn(`${title} distribution failed. Inscription Hash: ${inscriptionHash} Caused by: ${JSON.stringify(rewardsTransferResponse?.error)}`)
            }
        } else {
            this.logger.warn(`${title} distribution failed. Inscription Hash: ${inscriptionHash} Caused by: Missing reward receiving address`)
        }
    }

    async commandExecution(command: CommandsV1Type, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        const actionEnum = command.action as InscriptionActionEnum
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
            this.logger.warn(`[CommandExecution] Execution transaction fail, Action is out of scope`)
        }
        return await headers[actionEnum](command.data, inscriptionHash, executionMode)
    }

    async syncExecuteTransaction(inscription: Inscription): Promise<Array<string>> {
        if (!inscription?.content || !inscription?.inscriptionId) {
            throw new Error(`Inscription content or inscription id cannot be empty`)
        }
        if (inscription.inscriptionId.length != 66) {
            throw new Error(`Invalid inscription id, length must be 64, currently ${inscription.inscriptionId?.length}`)
        }
        const transactionHash: string[] = []
        const inscriptionCommandList = this.decodeInscription(inscription.content)
        const inscriptionSignAddressList: string[] = []
        let logIndex = 0
        for (let index = 0; index < inscriptionCommandList.length; index++) {
            const command = inscriptionCommandList[index];
            const hash = await this.commandExecution(command, inscription.hash, ExecutionModeEnum.Normal)
            // todo code
            if (hash) {
                transactionHash.push(hash)
                const unsingTransaction = this.xvmService.unSignTransaction(command.data)
                const xvmFrom = unsingTransaction.from
                const xvmTo = unsingTransaction.to
                unsingTransaction && inscriptionSignAddressList.push(xvmFrom)
                const executeTransactionMappingHash: HashMappingInterface = {
                    xFromAddress: xvmFrom ?? '',
                    xToAddress: xvmTo ?? '',
                    btcHash: inscription.hash,
                    xvmHash: hash,
                    logIndex: logIndex
                }
                // hash mapping
                await this.hashMappingService.bindHash(executeTransactionMappingHash)
                logIndex += 1
                this.logger.log(`[${inscription.blockHeight}] ${ExecutionModeEnum.Normal} transaction execute success, action:${InscriptionActionEnum[command.action]}  hash: ${hash}`)
            }
        }
        // inscription rewards
        if (!inscriptionSignAddressList.every((item) => item === inscriptionSignAddressList[0])) {
            this.logger.warn(`Inscription command have multiple signature addresses, Inscription Hash: ${inscription.hash}`)
        }
        const rewardReceiveAddress = inscriptionSignAddressList.at(0)
        await this.inscriptionRewards(rewardReceiveAddress, inscription.hash)
        return transactionHash
    }

    async preExecuteTransaction(inscription: Inscription) {
        if (!inscription?.content || !inscription?.inscriptionId) {
            throw new Error(`Inscription content or inscription id cannot be empty`)
        }
        if (inscription.inscriptionId.length != 66) {
            throw new Error(`Invalid inscription id, length must be 64, currently ${inscription.inscriptionId?.length}`)
        }
        const transactionHash: string[] = []
        const inscriptionCommandList = this.decodeInscription(inscription.content)
        const inscriptionSignAddressList: string[] = []
        let logIndex = 0
        for (let index = 0; index < inscriptionCommandList.length; index++) {
            const command = inscriptionCommandList[index];
            const hash = await this.commandExecution(command, inscription.hash, ExecutionModeEnum.PreExecution)
            // todo code
            if (hash) {
                transactionHash.push(hash)
                const unsingTransaction = this.xvmService.unSignTransaction(command.data)
                const xvmFrom = unsingTransaction.from
                const xvmTo = unsingTransaction.to
                unsingTransaction && inscriptionSignAddressList.push(xvmFrom)
                const executeTransactionMappingHash: HashMappingInterface = {
                    xFromAddress: xvmFrom ?? '',
                    xToAddress: xvmTo ?? '',
                    btcHash: inscription.hash,
                    xvmHash: hash,
                    logIndex: logIndex
                }
                // hash mapping
                await this.hashMappingService.bindHash(executeTransactionMappingHash)
                logIndex += 1
                this.logger.log(`[${inscription.blockHeight}] ${ExecutionModeEnum.PreExecution} transaction execute success, action:${InscriptionActionEnum[command.action]}  hash: ${hash}`)
            }
        }
        // inscription rewards
        if (!inscriptionSignAddressList.every((item) => item === inscriptionSignAddressList[0])) {
            this.logger.warn(`Inscription command have multiple signature addresses, Inscription Hash: ${inscription.hash}`)
        }
        const rewardReceiveAddress = inscriptionSignAddressList.at(0)
        await this.inscriptionRewards(rewardReceiveAddress, inscription.hash, ExecutionModeEnum.PreExecution)
        return transactionHash
    }

    async executeTransaction(inscription: Inscription, executionMode: ExecutionModeEnum = ExecutionModeEnum.Normal): Promise<Array<string>> {
        if (executionMode === ExecutionModeEnum.Normal) {
            return await this.syncExecuteTransaction(inscription)
        } else {
            return await this.preExecuteTransaction(inscription)
        }
    }

    async mineBlock(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        const blockHeight = parseInt(data.slice(2, 12), 16)
        const blockTimestamp = parseInt(data.slice(12), 16)
        const minterBlockHash = await this.xvmService.minterBlock(blockTimestamp)
        this.logger.log(`[MineBlockFor${executionMode.toUpperCase()}] Generate Block ${blockHeight} is ${minterBlockHash} for Inscription Hash: ${inscriptionHash}`)
        return minterBlockHash
    }

    private async _handleTransaction(data: string, inscriptionHash: string, action: string, executionMode: ExecutionModeEnum): Promise<string> {
        const formatAction = `${executionMode.toUpperCase()}-${capitalizeFirstLetter(action)}`
        try {
            const response = await this.xvmService.sendRawTransaction(data)
            if ('result' in response) {
                return response.result
            }
            const unSignTransaction = this.xvmService.unSignTransaction(data)
            if (unSignTransaction && unSignTransaction.from.toLowerCase() == this.defaultConf.xvm.sysXvmAddress.toLowerCase()) {
                throw new Error(`[${formatAction}] ${formatAction} failed. Inscription Hash: ${inscriptionHash} sender: ${unSignTransaction.from} to: ${unSignTransaction.to}`)
            }
            this.logger.warn(`[${formatAction}] ${formatAction} Failed. Inscription Hash: ${inscriptionHash} Caused by:${JSON.stringify(response.error)}`)
            return null
        } catch (error) {
            const newError = new Error(`[${formatAction}] ${formatAction} Failed. Inscription Hash: ${inscriptionHash}`)
            newError.stack = `${newError.stack}\nCaused by:${error instanceof Error ? error.stack : error}`
            throw newError
        }
    }

    async prev(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        return null
    }

    async deploy(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        return await this._handleTransaction(data, inscriptionHash, this.deploy.name, executionMode)
    }

    async execute(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        return await this._handleTransaction(data, inscriptionHash, this.execute.name, executionMode)
    }

    async transfer(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string> {
        return await this._handleTransaction(data, inscriptionHash, this.transfer.name, executionMode)
    }

    async deposit(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null> {
        const formatAction = `${ExecutionModeEnum.Normal.toUpperCase()}-Deposit`
        const unSignTransaction = this.xvmService.unSignTransaction(data)
        if (!unSignTransaction) {
            this.logger.warn(`Invalid command hash: ${inscriptionHash}`)
            return null
        }
        if (!unSignTransaction.from) {
            this.logger.warn(`Invalid command hash: ${inscriptionHash}, Unable to parse the from address from signTransaction`)
            return null
        }
        const to = unSignTransaction.from
        const txid = inscriptionHash
        const depositOutput = await this.ordService.getInscriptionTxOutput(txid, 1)
        if (!depositOutput) {
            this.logger.warn(`Invalid deposit. No deposit funds were sent. Inscription Hash:${inscriptionHash} sender:${unSignTransaction.from}`)
            return null
        }
        const { scriptPubKey: { address }, value } = depositOutput
        // If the output1 address is not the deposit address, the deposit is invalid.
        if (this.defaultConf.wallet.fundingAddress != address) {
            this.logger.warn(`Invalid deposit. Invalid funds deposit address. Inscription Hash:${inscriptionHash} sender:${unSignTransaction.from}  deposit system address:${address}`)
            return null
        }
        const response = await this.xvmService.depositTransfer(to, ethers.parseEther(value.toString()))
        if ('error' in response) {
            const newError = new Error(`[${formatAction}] Deposit Failed. Inscription Hash: ${inscriptionHash}`)
            newError.stack = `${newError.stack}\n Caused by: ${JSON.stringify(response.error)}`
            throw newError
        }
        return response.result
    }

    async withdraw(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null> {
        const unSignTransaction = this.xvmService.unSignTransaction(data)
        if (!unSignTransaction) {
            this.logger.warn(`Invalid SignTransaction, cannot be parsed, hash=${inscriptionHash}`)
            return null
        }
        // verify withdraw command tx 
        if (this.defaultConf.xvm.xbtcPoolAddress.toLowerCase() != unSignTransaction.to?.toLowerCase()) {
            this.logger.warn(`Invalid withdraw command(err Contract:${unSignTransaction.to}). Inscription Hash:${inscriptionHash} sender:${unSignTransaction.from} withdraw amount:${unSignTransaction.value.toString()} wei`)
            return null
        }
        if (unSignTransaction.data != '0xd0e30db0') {
            this.logger.warn(`Invalid withdraw command(err input data: ${unSignTransaction.data}). Inscription Hash:${inscriptionHash} sender:${unSignTransaction.from} withdraw amount:${unSignTransaction.value.toString()} wei`)
            return null
        }
        // Deduction of xBTC balance
        await this._handleTransaction(data, inscriptionHash, this.withdraw.name, ExecutionModeEnum.Normal)
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
                    const data = content?.data()
                    if (action === undefined || action === null) {
                        this.logger.warn(`Command action cannot be null or undefined`)
                        continue
                    }
                    // check data
                    if (data == undefined || data == null) {
                        this.logger.warn(`Command data cannot be null or undefined`)
                        continue
                    }
                    if (![0, 1, 2, 3, 4, 5, 6].includes(action)) {
                        this.logger.warn(`Command action error, must in [0,1,2,3,4,5,6].`)
                        continue
                    }
                    result.push({ action: action, data: data })
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
