import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscribeService } from './inscribe.service';
import { LastConfig } from 'src/entities/last-config.entity';
import { IndexerModule } from 'src/indexer/indexer.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { HashMappingModule } from 'src/router/protocol/hash-mapping/hash-mapping.module';

@Module({
  imports: [
    IndexerModule,
    XvmModule,
    HashMappingModule,
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
