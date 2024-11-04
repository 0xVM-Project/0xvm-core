import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { RouterModule } from 'src/router/router.module';
import { PreExecutionService } from './pre-execution.service';

@Module({
  imports: [
    RouterModule,
    TypeOrmModule.forFeature([PendingTx, PreBroadcastTx, PreBroadcastTxItem]),
  ],
  providers: [PreExecutionService],
  exports: [PreExecutionService],
})
export class PreExecutionModule {}
