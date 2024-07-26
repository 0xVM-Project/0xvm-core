import { Module } from '@nestjs/common';
import { BtcrpcService } from './btcrpc.service';

@Module({
  providers: [BtcrpcService],
  exports: [BtcrpcService]
})
export class BtcrpcModule {}
