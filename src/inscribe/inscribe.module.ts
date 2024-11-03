import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { InscribeService } from './inscribe.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreBroadcastTx, LastTxHash, HashMapping]),
  ],
  providers: [InscribeService],
  exports: [InscribeService],
})
export class InscribeModule {}
