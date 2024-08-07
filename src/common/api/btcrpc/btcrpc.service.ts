import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { BlockchainInfoResponse, BlockHeaderResponse, BlockResponse, BtcBaseResponse, RawTransactionResponse } from './btcrpc.interface';

@Injectable()
export class BtcrpcService {
    private readonly logger = new Logger(BtcrpcService.name)
    @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>

    constructor(
        private readonly httpService: HttpService,
    ) { }

    private async client<T>(rpcMethod: string, params: any[]) {
        const payload = {
            "jsonrpc": "1.0",
            "id": "curltest",
            "method": rpcMethod,
            "params": params
        }
        const config: AxiosRequestConfig = {
            headers: {
                'content-type': 'application/json'
            },
            auth: {
                username: this.defaultConf.bitcoind.bitcoinRpcUser,
                password: this.defaultConf.bitcoind.bitcoinRpcPassword
            },
            method: 'POST',
            baseURL: this.defaultConf.bitcoind.bitcoinRpcUrl,
            data: payload
        }

        return await firstValueFrom(this.httpService.request<T>(config))
    }

    async getBlockchainInfoForBtc() {
        const { data } = await this.client<BlockchainInfoResponse>('getblockchaininfo', [])
        return data
    }

    async getblockhash(blockHeight: number) {
        const { data } = await this.client<BtcBaseResponse<string>>('getblockhash', [blockHeight])
        return data
    }

    async getBlock(blockHash: string, verbosity: 0 | 1 | 2 = 2) {
        const { data } = await this.client<BlockResponse>('getblock', [blockHash, verbosity])
        return data
    }

    async getBlockheader(blockHash: string) {
        const { data } = await this.client<BlockHeaderResponse>('getblockheader', [blockHash])
        return data
    }

    async getBlockToHex(blockHash: string) {
        const { data } = await this.client<BtcBaseResponse<string>>('getblock', [blockHash, 0])
        return data
    }

    async getRawtransaction(txid: string) {
        const { data } = await this.client<RawTransactionResponse>('getrawtransaction', [txid, 1])
        return data
    }
}
