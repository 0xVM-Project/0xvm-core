import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { BtcBlockchainInfo } from './btcrpc.interface';

@Injectable()
export class BtcrpcService {
    private readonly logger = new Logger(BtcrpcService.name)
    @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>

    constructor(
        private readonly httpService: HttpService,
    ){}

    async getBlockchainInfoForBtc() {
        const url = this.defaultConf.bitcoind.bitcoinRpcUrl
        const config: AxiosRequestConfig = {
            headers: {
                'content-type': 'application/json'
            },
            auth: {
                username: this.defaultConf.bitcoind.bitcoinRpcUser,
                password: this.defaultConf.bitcoind.bitcoinRpcPassword
            }
        }
        const payload = {
            "jsonrpc": "1.0",
            "id": "curltest",
            "method": "getblockchaininfo",
            "params": []
        }
        const response = await firstValueFrom(this.httpService.post<BtcBlockchainInfo>(url, payload, config))
        return response.data
    }
}
