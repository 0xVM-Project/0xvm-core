import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw/withdraw.service';
import { Withdraw } from 'src/entities/withdraw.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [TypeOrmModule.forFeature([Withdraw])],
    providers: [WithdrawService]
})
export class TransactionModule { }
