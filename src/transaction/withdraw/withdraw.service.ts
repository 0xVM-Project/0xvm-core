import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Withdraw } from 'src/entities/withdraw.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { IWithdraw } from './withdraw.interface';
import { WithdrawRequestException } from 'src/common/exception/custom.exception';

@Injectable()
export class WithdrawService {
    private readonly logger = new Logger(WithdrawService.name)

    constructor(
        @InjectRepository(Withdraw)
        private readonly withdrawRepository: Repository<Withdraw>,
    ) { }

    async withdrawRequest(withdraw: IWithdraw) {
        try {
            await this.withdrawRepository.save(withdraw)
            return withdraw
        } catch (error) {
            if (error instanceof QueryFailedError && error.driverError?.errno == 1062) {
                throw new WithdrawRequestException()
            }
            this.logger.error(error)
            throw error
        }
    }
}
