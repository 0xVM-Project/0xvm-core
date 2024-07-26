import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Withdraw } from 'src/entities/withdraw.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { AddressMapping, IWithdraw } from './withdraw.interface';
import { WithdrawRequestException } from 'src/common/exception/custom.exception';
import { HttpService } from '@nestjs/axios';
import defaultConfig from 'src/config/default.config';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WithdrawService {
    @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>
    private readonly logger = new Logger(WithdrawService.name)

    constructor(
        @InjectRepository(Withdraw)
        private readonly withdrawRepository: Repository<Withdraw>,
        private readonly httpService: HttpService,
    ) { }

    async getBtcAddress(xvmAddress: string): Promise<string> {
        const headers = {
            'Content-Type': 'application/json'
        }
        const url = `${this.defaultConf.wallet.walletApiUrl}/address-mapping/${xvmAddress}`
        const response = await firstValueFrom(this.httpService.get<AddressMapping>(url, { headers: headers }))
        return response.data.data.btcAddress
    }

    async withdrawRequest(withdraw: IWithdraw) {
        try {
            await this.withdrawRepository.save(withdraw)
            return withdraw
        } catch (error) {
            if (error instanceof QueryFailedError && error.driverError?.errno == 1062) {
                this.logger.warn(`withdraw request already exists, warn(warn=${JSON.stringify(withdraw ?? {})})`)
                return withdraw
            }
            this.logger.error(error)
            throw error
        }
    }
}
