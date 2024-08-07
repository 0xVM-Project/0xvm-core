import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdraw } from 'src/entities/withdraw.entity';
import { WithdrawService } from './withdraw.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Withdraw]),
    ],
    providers: [
        WithdrawService,
    ],
    exports: [
        WithdrawService,
    ]
})
export class WithdrawModule {}
