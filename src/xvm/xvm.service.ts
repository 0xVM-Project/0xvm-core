import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Transaction, ethers } from 'ethers';
import defaultConfig from 'src/config/default.config';
import { firstValueFrom } from 'rxjs';
import { XvmRpcBaseResponse, XvmRpcEngineCreateBlockResponse } from './xvm.interface';

@Injectable()
export class XvmService {
    private readonly logger = new Logger(XvmService.name)
    private readonly provider: ethers.Provider
    private readonly sysWallet: ethers.Wallet
    private readonly chainId: number
    private feeData: ethers.FeeData
    public readonly sysAddress: string
    private userNonce: Record<string, number> = {}

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly httpService: HttpService,
    ) {
        if (!this.defaultConf.xvm.sysPrivateKey) {
            throw new Error(`System wallet privateKey cannot be empty`)
        }
        this.provider = new ethers.JsonRpcProvider(this.defaultConf.xvm.xvmRpcUrl)
        this.sysWallet = new ethers.Wallet(this.defaultConf.xvm.sysPrivateKey, this.provider)
        this.provider.getFeeData().then(feeData => {
            this.feeData = feeData
        })
        this.sysAddress = this.sysWallet.address
        this.chainId = this.defaultConf.xvm.xvmChainId ?? 42
    }

    async rpcClient<T>(method: string, params: any[]) {
        const url = this.defaultConf.xvm.xvmRpcUrl
        const headers = {
            'Content-Type': 'application/json'
        }
        const payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }
        return await firstValueFrom(this.httpService.post<T>(url, payload, { headers: headers }))
    }

    async getLatestBlockNumber(): Promise<number> {
        const response = await this.rpcClient<XvmRpcBaseResponse>('eth_blockNumber', [])
        const blockHeight = response.data.result
        return Number(Number(blockHeight).toString())
    }

    initNonce() {
        this.userNonce = {}
    }

    async getNonce(address: string): Promise<number> {
        if (!ethers.isAddress(address)) {
            throw new Error(`Get nonce fail. invalid address`)
        }
        if (address in this.userNonce) {
            return this.userNonce[address]
        } else {
            const response = await this.rpcClient<XvmRpcBaseResponse>('eth_getTransactionCount', [address, "pending"])
            const _nonce = response.data.result
            this.userNonce[address] = Number.parseInt(_nonce, 16)
            return this.userNonce[address]
        }
    }

    async sendRawTransaction(signTransaction: string): Promise<string> {
        const response = await this.rpcClient<XvmRpcBaseResponse>('eth_sendRawTransaction', [signTransaction])
        const data = response.data
        const unSignTransaction = this.unSignTransaction(signTransaction)
        if ('error' in data) {
            const { code, message } = data.error as any
            let rawTx = unSignTransaction.toJSON()
            rawTx = {
                ...rawTx,
                data: rawTx?.data != '0x' ? rawTx?.data.slice(0, 20) + '...' : rawTx?.data
            }
            const errorMessage = `${message}, error(error=${JSON.stringify(data?.error)}, payload=${response?.config?.data}, sender=${unSignTransaction.from}, to=${unSignTransaction?.to}, tx=${JSON.stringify(rawTx ?? {})})`
            // Transactions sent from system addresses are not allowed to be abnormal
            if (unSignTransaction.from.toLowerCase() == this.sysAddress.toLowerCase()) {
                throw new Error(errorMessage)
            }
            this.logger.warn(errorMessage)
        }
        this.userNonce[unSignTransaction.from]++
        return data.result
    }

    async depositTransfer(to: string, amount: ethers.BigNumberish): Promise<string> {
        const gasPrice = this.feeData.gasPrice
        const nonce = await this.getNonce(this.sysAddress)
        const tx = { to: to, value: amount, gasLimit: 21000, gasPrice: gasPrice, nonce: nonce, chainId: this.chainId }
        const signTransaction = await this.sysWallet.signTransaction(tx)
        return await this.sendRawTransaction(signTransaction)
    }

    async rewardsTransfer(to: string): Promise<string> {
        const amount = ethers.parseUnits('546', 10)
        const gasPrice = this.feeData.gasPrice
        const nonce = await this.getNonce(this.sysAddress)
        const tx = { to: to, value: amount, gasLimit: 21000, gasPrice: gasPrice, nonce: nonce, chainId: this.chainId }
        const signTransaction = await this.sysWallet.signTransaction(tx)
        return await this.sendRawTransaction(signTransaction)
    }

    async minterBlock() {
        const response = await this.rpcClient<XvmRpcEngineCreateBlockResponse>('engine_createBlock', [true, true, null])
        return response.data.result.hash
    }

    unSignTransaction(signTransaction: string): Transaction | null {
        if (!signTransaction) {
            this.logger.warn(`signTransaction not is empty`)
            return null
        }
        if (!signTransaction.startsWith('0x')) {
            this.logger.warn(`Invalid signTransaction`)
            return null
        }
        try {
            const tx = ethers.Transaction.from(signTransaction)
            if (!ethers.isAddress(tx.from)) {
                this.logger.warn(`Invalid signature address`)
                return null
            }
            if (!ethers.isAddress(tx.to)) {
                this.logger.warn(`Invalid to address. toAddress: ${tx?.to} sender: ${tx.from}`)
            }
            return tx
        } catch (error) {
            const errMsg = `unsign transaction fail. \n${error instanceof Error ? error.stack : error}`
            this.logger.warn(errMsg)
            return null
        }
    }
}
