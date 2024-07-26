import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProtocolVersionEnum } from '../router.enum';
import { InscriptionType } from '../../indexer/indexer.interface';
import { IProtocol } from '../router.interface';
import { CommandsV1Type } from '../interface/protocol.interface'
import { InscriptionActionEnum } from 'src/indexer/indexer.enum';
import * as Flatbuffers from "./flatbuffers/output/zxvm";
import * as flatbuffers from "flatbuffers";
import { XvmService } from 'src/xvm/xvm.service';
import { ethers } from 'ethers';
import { WithdrawService } from './withdraw/withdraw.service';
import { IWithdraw } from './withdraw/withdraw.interface';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { HashMappingService } from './hash-mapping/hash-mapping.service';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import { error } from 'console';


@Injectable()
export class ProtocolV001Service implements IProtocol<InscriptionType, CommandsV1Type, InscriptionType, String> {
    private readonly logger = new Logger(ProtocolV001Service.name)
    public readonly version = ProtocolVersionEnum['0f0001']

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly ordinalsService: OrdinalsService,
        private readonly xvmService: XvmService,
        private readonly withdrawService: WithdrawService,
        private readonly hashMappingService: HashMappingService,
    ) { }

    filterInscription(ordiInscriptionsContent: InscriptionType): InscriptionType | null {
        return ordiInscriptionsContent.content.startsWith(this.version) ? ordiInscriptionsContent : null
    }

    decodeInscription(inscriptionContent: string): Array<CommandsV1Type> {
        const base64String = inscriptionContent.slice(6)
        const base64Decode = this.base64Decode(base64String)
        return this.flatbuffersDecode(base64Decode)
    }

    async executeTransaction(inscription: InscriptionType): Promise<Array<string>> {
        if (!inscription?.content || !inscription?.inscriptionId) {
            throw new Error(`Inscription content or inscription id cannot be empty`)
        }
        const transactionHash: string[] = []
        const inscriptionCommandList = this.decodeInscription(inscription.content)
        let xvmFrom: string = ''
        let xvmTo: string = ''
        let logIndex: number = 0
        const inscriptionHash = inscription.inscriptionId.slice(0, -2)
        // command list
        for (const inscriptionCommand of inscriptionCommandList) {
            const headers = {
                [InscriptionActionEnum.deploy]: this.deploy.bind(this),
                [InscriptionActionEnum.execute]: this.execute.bind(this),
                [InscriptionActionEnum.transfer]: this.transfer.bind(this),
                [InscriptionActionEnum.deposit]: this.deposit.bind(this),
                [InscriptionActionEnum.withdraw]: this.withdraw.bind(this),
            }
            if (!(inscriptionCommand.action in headers)) {
                this.logger.warn(`create transaction fail, Action is out of scope`)
                return null
            }
            if (!xvmFrom) {
                const unsingTransaction = this.xvmService.unSignTransaction(inscriptionCommand.data)
                xvmFrom = unsingTransaction.from
                xvmTo = unsingTransaction.to
            }
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
                this.logger.log(`[${inscription.blockHeight}] Send Transaction success, action:${InscriptionActionEnum[inscriptionCommand.action]}  hash:${hash}`)
            } else {
                this.logger.warn(`[${inscription.blockHeight}] Send Transaction fail, action:${InscriptionActionEnum[inscriptionCommand.action]} inscriptionId:${inscription.inscriptionId} data:${inscriptionCommand.data}`)
            }
        }
        // inscription rewards
        const toRewards = xvmFrom
        const hash = await this.xvmService.rewardsTransfer(toRewards, ethers.parseUnits('546', 8)).catch(error => {
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

    async deploy(data: string, inscription: InscriptionType) {
        return await this.xvmService.sendRawTransaction(data)
    }

    async execute(data: string, inscription: InscriptionType): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async transfer(data: string, inscription: InscriptionType): Promise<string> {
        return await this.xvmService.sendRawTransaction(data)
    }

    async deposit(data: string, inscription: InscriptionType): Promise<string> {
        const inscriptionId = inscription.inscriptionId
        const outputResponse = await this.ordinalsService.getOutputById(inscriptionId, 1)
        const { address, value } = outputResponse.data
        // If the deposit address is not the system address, the deposit is invalid.
        const unsingTransaction = this.xvmService.unSignTransaction(data)
        const to = unsingTransaction.from
        if (this.defaultConf.xvm.sysBtcAddress == address) {
            return await this.xvmService.rewardsTransfer(to, value)
        }
        this.logger.warn(`Invalid deposit. Invalid funds deposit address. sender:${unsingTransaction.from}  deposit system address:${address}`)
        return null
    }

    async withdraw(data: string, inscription: InscriptionType): Promise<string> {
        const unsingTransaction = this.xvmService.unSignTransaction(data)
        // Deduction of xBTC balance
        const hash = await this.xvmService.sendRawTransaction(data)
        // withdraw btc request
        const toAddressForBtc = await this.withdrawService.getBtcAddress(unsingTransaction.from)
        const withdraw: IWithdraw = {
            fromAddress: this.defaultConf.xvm.sysBtcAddress,
            toAddress: toAddressForBtc,
            amount: unsingTransaction.value.toString(),
            evmHash: hash,
            status: 1
        }
        await this.withdrawService.withdrawRequest(withdraw)
        return hash
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
}
