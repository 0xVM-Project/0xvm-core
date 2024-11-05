import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { RouterModule } from 'src/router/router.module';
import { InscribeService } from './inscribe.service';

@Module({
  imports: [
    RouterModule,
    TypeOrmModule.forFeature([
      PreBroadcastTx,
      LastTxHash,
      HashMapping,
      PreBroadcastTxItem,
    ]),
  ],
  providers: [InscribeService],
  exports: [InscribeService],
})
export class InscribeModule {}
