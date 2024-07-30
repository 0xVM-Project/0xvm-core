import { Module } from '@nestjs/common';
import { InscriptionService } from './inscription.service';
import { BtcrpcModule } from 'src/common/api/btcrpc/btcrpc.module';
import { OrdService } from './ord.service';

@Module({
  imports: [
    BtcrpcModule,
  ],
  providers: [InscriptionService, OrdService],
  exports: [InscriptionService, OrdService]
})
export class OrdModule { }
