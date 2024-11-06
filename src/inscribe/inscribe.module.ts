import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { RouterModule } from 'src/router/router.module';
import { InscribeService } from './inscribe.service';
import { LastConfig } from 'src/entities/last-config.entity';

@Module({
  imports: [
    RouterModule,
    TypeOrmModule.forFeature([
      PreBroadcastTx,
      LastConfig,
      HashMapping,
      PreBroadcastTxItem,
    ]),
  ],
  providers: [InscribeService],
  exports: [InscribeService],
})
export class InscribeModule {}
