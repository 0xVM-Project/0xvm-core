import { Module } from '@nestjs/common';
import { XvmService } from './xvm.service';

@Module({
  providers: [XvmService],
  exports: [XvmService]
})
export class XvmModule {}
