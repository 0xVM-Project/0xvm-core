import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Transaction, ethers } from 'ethers';
import defaultConfig from 'src/config/default.config';
import { firstValueFrom } from 'rxjs';
import { EvmBlockByNumberResponse, EvmMineBlockResponse, EvmRevertBlockResponse, XvmBlockByNumber, XvmRpcBaseResponse, XvmRpcEngineCreateBlockResponse } from './xvm.interface';
import { releaseParamSignature } from 'src/utils/paramSignature';
import * as XBTCPoolABI from '../config/abi/XBTCPoolABI.json'

@Injectable()
export class XvmService {
    private readonly logger = new Logger(XvmService.name)
    private readonly provider: ethers.Provider
    private readonly sysWallet: ethers.Wallet
    private readonly operatorWallet: ethers.Wallet
    private readonly chainId: number
    private feeData: ethers.FeeData
    public readonly sysAddress: string
    public readonly xbtcPoolAddress: string
    private userNonce: Record<string, number> = {}
    private readonly xbtcPoolContract: ethers.Contract

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly httpService: HttpService,
    ) {
        if (!this.defaultConf.xvm.sysPrivateKey) {
            throw new Error(`System wallet privateKey cannot be empty`)
        }
        this.xbtcPoolAddress = this.defaultConf.xvm.xbtcPoolAddress
        this.provider = new ethers.JsonRpcProvider(this.defaultConf.xvm.xvmRpcUrl)
        this.sysWallet = new ethers.Wallet(this.defaultConf.xvm.sysPrivateKey, this.provider)
        this.operatorWallet = new ethers.Wallet(this.defaultConf.xvm.operatorPrivateKey, this.provider)
        this.provider.getFeeData().then(feeData => {
            this.feeData = feeData
        })
        this.sysAddress = this.sysWallet.address
        this.chainId = this.defaultConf.xvm.xvmChainId ?? 42
        this.xbtcPoolContract = new ethers.Contract(this.xbtcPoolAddress, JSON.stringify(XBTCPoolABI), this.sysWallet)
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

    async getLatestBlock(transactionDetailFlag: boolean = false): Promise<EvmBlockByNumberResponse> {
        const blockNumbeResponse = await this.rpcClient<XvmRpcBaseResponse>('eth_blockNumber', [])
        const latestBlockHeight = blockNumbeResponse.data.result
        const blockByNumberResponse = await this.rpcClient<EvmBlockByNumberResponse>('eth_getBlockByNumber', [latestBlockHeight, transactionDetailFlag])
        return blockByNumberResponse.data
    }

    initNonce() {
        this.userNonce = {}
    }

    async getNonce(address: string): Promise<number> {
        if (!ethers.isAddress(address)) {
            throw new Error(`Get nonce fail. invalid address`)
        }
        const response = await this.rpcClient<XvmRpcBaseResponse>('eth_getTransactionCount', [address, "pending"])
        const _nonce = response.data.result
        return Number.parseInt(_nonce, 16)
    }

    async sendRawTransaction(signTransaction: string): Promise<string> {
        const unSignTransaction = this.unSignTransaction(signTransaction)
        this.logger.debug(`unSignTransaction: ${JSON.stringify(unSignTransaction)}`);
        this.logger.debug(`unSignTransaction.from: ${JSON.stringify(unSignTransaction.from)}`);
        if (!unSignTransaction) {
            throw new Error(`signTransaction cannot be parsed`)
        }
        if (!unSignTransaction.from) {
            throw new Error(`Unable to parse the from address from signTransaction`)
        }
        const response = await this.rpcClient<XvmRpcBaseResponse>('eth_sendRawTransaction', [signTransaction])
        this.logger.debug(`response: ${JSON.stringify(response)}`);
        const data = response.data
        if ('error' in data) {
            const { code, message } = data.error as any
            let rawTx = unSignTransaction.toJSON()
            rawTx = {
                ...rawTx,
                data: rawTx?.data != '0x' ? rawTx?.data.slice(0, 20) + '...' : rawTx?.data
            }
            const errorMessage = `${message}, error(code=${code}, error=${JSON.stringify(data?.error)}, payload=${response?.config?.data}, sender=${unSignTransaction.from}, to=${unSignTransaction?.to}, tx=${JSON.stringify(rawTx ?? {})})`
            // Transactions sent from system addresses are not allowed to be abnormal
            if (unSignTransaction.from.toLowerCase() == this.sysAddress.toLowerCase()) {
                throw new Error(errorMessage)
            }
            this.logger.warn(errorMessage)
        }
        this.logger.debug(`this.userNonce[unSignTransaction.from]: ${JSON.stringify(this.userNonce[unSignTransaction.from])}`);
        if (!this.userNonce[unSignTransaction.from]) {
            this.userNonce[unSignTransaction.from] = parseInt(String(unSignTransaction.nonce), 16) + 1
        } else {
            this.userNonce[unSignTransaction.from]++
        }
        return data.result
    }

    async releaseXBTC(to: string, amount: ethers.BigNumberish): Promise<string> {
        const gasPrice = this.feeData.gasPrice
        const nonce = await this.getNonce(this.sysAddress)
        const signMessage = await releaseParamSignature(to, amount, this.operatorWallet)
        const tx = await this.xbtcPoolContract.release(to, amount, signMessage, { gasPrice: gasPrice, nonce: nonce, chainId: this.chainId })
        this.userNonce[this.sysAddress]++
        return tx.hash
    }

    async depositTransfer(to: string, amount: ethers.BigNumberish): Promise<string> {
        return await this.releaseXBTC(to, amount)
    }

    async rewardsTransfer(to: string): Promise<string> {
        const amount = ethers.parseUnits('546', 10)
        return await this.releaseXBTC(to, amount)
    }

    async minterBlock(timestamp: number) {
        const response = await this.rpcClient<EvmMineBlockResponse>('evm_mine_block', [{ timestamp: timestamp }])
        if ('error' in response.data) {
            throw new Error(`Minter Block fail. error: ${JSON.stringify(response.data.error)}`)
        }
        return response.data.result
    }

    /**
     * Restore to the current block, all subsequent block data will be discarded
     * @param blockHeight Restore data to the current block height
     * @returns Resume execution status, true: success, false: failure
     * @example
     * // revert block: 30
     * // latest block: 31
     * // After successful execution
     * // block 30
     * //  ̶b̶l̶o̶c̶k̶ ̶3̶1̶
     * // After the recovery is successfully executed, the block information after block height 30 will be discarded
     */
    async revertBlock(blockHeight: number): Promise<boolean> {
        const response = await this.rpcClient<EvmRevertBlockResponse>('evm_revert_block', [`0x${blockHeight.toString(16)}`])
        if ('error' in response.data) {
            throw new Error(`Revert Block [${blockHeight}] fail. error: ${JSON.stringify(response.data.error)}`)
        }
        return response.data.result
    }

    async getBlockByNumber(blockHeight: number) {
        const response = await this.rpcClient<EvmBlockByNumberResponse>('eth_getBlockByNumber', [blockHeight, true])
        return response.data.result
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
            return ethers.Transaction.from(signTransaction)
        } catch (error) {
            const errMsg = `unsign transaction fail. \n${error instanceof Error ? error.stack : error}`
            this.logger.warn(errMsg)
            return null
        }
    }
}
