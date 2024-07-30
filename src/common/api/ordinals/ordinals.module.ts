import { Module } from '@nestjs/common';
import { OrdinalsService } from './ordinals.service';
import { BtcrpcModule } from '../btcrpc/btcrpc.module';

@Module({
  imports: [
    BtcrpcModule,
  ],
  providers: [
    OrdinalsService
  ],
  exports: [
    OrdinalsService
  ]
})
export class OrdinalsModule {}
