import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { OrdiInscriptionsBlockType, OrdiOutputType } from './ordinals.interface';
import { AxiosRequestConfig } from 'axios';
import { BtcrpcService } from '../btcrpc/btcrpc.service';

@Injectable()
export class OrdinalsService {
    private readonly logger = new Logger(OrdinalsService.name)

    constructor(
        @Inject(defaultConfig.KEY) readonly defaultConf: ConfigType<typeof defaultConfig>,
        private readonly httpService: HttpService,
    ) { }

    async ordClient<T>(path: string, data: any = undefined, method: 'POST' | 'GET' = 'GET') {
        // const url = this.defaultConf.ordinals.ordUrl + path
        const config: AxiosRequestConfig = {
            baseURL: this.defaultConf.ordinals.ordUrl,
            url: path,
            method: method,
            ...(data ? { data: data } : {})
        }
        return await firstValueFrom(this.httpService.request<T>(config))
    }

    async getBlockInscription(blockHeight: string | number) {
        const path = `/api/inscriptions/block/${blockHeight}`
        return await this.ordClient<OrdiInscriptionsBlockType>(path)
    }

    async getOutputById(inscriptionId: string, index: number = 1) {
        const outputId = inscriptionId.slice(0, -2) + `:${index}`;
        const path = `/output/${outputId}`
        return await this.ordClient<OrdiOutputType>(path)
    }

    async getBlockheight() {
        const path = `/blockheight`
        const response = await this.ordClient<string>(path)
        return Number(response.data)
    }
}
