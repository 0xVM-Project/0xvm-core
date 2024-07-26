import { Module } from '@nestjs/common';
import { OrdinalsService } from './ordinals.service';

@Module({
  providers: [
    OrdinalsService
  ],
  exports: [
    OrdinalsService
  ]
})
export class OrdinalsModule {}
