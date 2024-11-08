import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LastConfig } from 'src/entities/last-config.entity';
import { PendingTx } from 'src/entities/pending-tx.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { HashMappingModule } from 'src/router/protocol/hash-mapping/hash-mapping.module';
import { RouterModule } from 'src/router/router.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { PreExecutionService } from './pre-execution.service';

@Module({
  imports: [
    RouterModule,
    XvmModule,
    HashMappingModule,
    TypeOrmModule.forFeature([
      PendingTx,
      PreBroadcastTx,
      PreBroadcastTxItem,
      LastConfig,
    ]),
  ],
  providers: [PreExecutionService],
  exports: [PreExecutionService],
})
export class PreExecutionModule {}
