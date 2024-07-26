import { Global, Module } from '@nestjs/common';
import { OrdinalsModule } from './ordinals/ordinals.module';
import { BtcrpcModule } from './btcrpc/btcrpc.module';

@Global()
@Module({
  imports: [
    OrdinalsModule,
    BtcrpcModule
  ],
  exports: [
    OrdinalsModule,
    BtcrpcModule
  ]
})
export class ApiModule { }
