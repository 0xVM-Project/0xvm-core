import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Transaction, ethers } from 'ethers';
import defaultConfig from 'src/config/default.config';
import { firstValueFrom } from 'rxjs';
import { EvmBlockByNumberResponse, EvmMineBlockResponse, EvmRevertBlockResponse, XvmBlockByNumber, XvmRpcBaseResponse, XvmRpcEngineCreateBlockResponse, XvmRpcErrorResponse, XvmRpcResponse, XvmRpcSuccessResponse } from './xvm.interface';
import { releaseParamSignature } from 'src/utils/paramSignature';
import * as XBTCPoolABI from '../config/abi/XBTCPoolABI.json'
import { SendRawTransactionRequestError } from 'src/router/protocol/errors/protocol-v001.errors';
import { sleep } from 'src/utils/times';

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
    private readonly xbtcPoolContract: ethers.Contract
    private readonly maxRetryCount: number = 6
    private retryCount: number = 0
    private latestMineBlockNumber: number = 0

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

    private async cacheLatestMineBlockNumber() {
        if (this.latestMineBlockNumber == 0) {
            this.latestMineBlockNumber = await this.getLatestBlockNumber()
        } else {
            this.latestMineBlockNumber += 1
        }
        return this.latestMineBlockNumber
    }

    get fetchLatestMineBlockNumberCache() {
        return this.latestMineBlockNumber
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
        const response = await this.rpcClient<XvmRpcSuccessResponse>('eth_blockNumber', [])
        const blockHeight = response.data.result
        return Number(Number(blockHeight).toString())
    }

    async getLatestBlock(transactionDetailFlag: boolean = false): Promise<EvmBlockByNumberResponse> {
        const blockNumbeResponse = await this.rpcClient<XvmRpcSuccessResponse>('eth_blockNumber', [])
        const latestBlockHeight = blockNumbeResponse.data.result
        const blockByNumberResponse = await this.rpcClient<EvmBlockByNumberResponse>('eth_getBlockByNumber', [latestBlockHeight, transactionDetailFlag])
        return blockByNumberResponse.data
    }

    async getNonce(address: string): Promise<number> {
        if (!ethers.isAddress(address)) {
            throw new Error(`Get nonce fail. invalid address`)
        }
        try {
            const response = await this.rpcClient<XvmRpcSuccessResponse>('eth_getTransactionCount', [address, "pending"])
            const _nonce = response.data.result
            return Number.parseInt(_nonce, 16)
        } catch (error) {
            const newError = new Error(`[GetNonce] get nonce failed. address: ${address}`)
            newError.stack = `${newError.stack}\n Caused by: ${error instanceof Error ? error.stack : error}`
            throw newError
        }
    }

    async sendRawTransaction(signTransaction: string): Promise<XvmRpcResponse> {
        while (this.retryCount <= this.maxRetryCount) {
            try {
                const response = await this.rpcClient<XvmRpcResponse>('eth_sendRawTransaction', [signTransaction])
                const data = response.data
                this.retryCount = 0
                if ('error' in data) {
                    return data as XvmRpcErrorResponse
                }
                return data as XvmRpcSuccessResponse
            } catch (error) {
                await sleep(3000 * this.retryCount)
                const newError = new SendRawTransactionRequestError(error)
                newError.stack = `${newError.stack}\nCaused by: ${error instanceof Error ? error.stack : error}`
                this.logger.error(`Send Raw Transaction request failed, Retry request [ ${this.retryCount + 1} ]th time. Caused by: ${newError.stack}`)
                if (this.retryCount >= this.maxRetryCount) {
                    throw newError
                }
                this.retryCount += 1
            }
        }
    }

    async releaseXBTC(to: string, amount: ethers.BigNumberish): Promise<XvmRpcResponse> {
        const { maxFeePerGas, maxPriorityFeePerGas } = this.feeData
        const nonce = await this.getNonce(this.sysAddress)
        const signMessage = await releaseParamSignature(to, amount, this.operatorWallet)
        const estimateGas = await this.xbtcPoolContract.release.estimateGas(to, amount, signMessage, { from: this.sysAddress })
        const functionData = this.xbtcPoolContract.interface.encodeFunctionData('release', [to, amount, signMessage])
        const tx: ethers.TransactionRequest = {
            type: 2,
            to: this.xbtcPoolAddress,
            data: functionData,
            gasLimit: estimateGas * 120n / 100n,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            chainId: BigInt(this.chainId),
            nonce: nonce
        }
        const signTransaction = await this.sysWallet.signTransaction(tx)
        return await this.sendRawTransaction(signTransaction)
    }

    async depositTransfer(to: string, amount: ethers.BigNumberish): Promise<XvmRpcResponse> {
        return await this.releaseXBTC(to, amount)
    }

    async rewardsTransfer(to: string): Promise<XvmRpcResponse> {
        const amount = ethers.parseUnits('546', 10)
        return await this.releaseXBTC(to, amount)
    }

    async minterBlock(timestamp: number) {
        const response = await this.rpcClient<EvmMineBlockResponse>('evm_mine_block', [{ timestamp: timestamp }])
        if ('error' in response.data) {
            throw new Error(`Minter Block fail. error: ${JSON.stringify(response.data.error)}`)
        }
        await this.cacheLatestMineBlockNumber()
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
