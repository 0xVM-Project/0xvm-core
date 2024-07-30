import { Module } from '@nestjs/common';
import { BtcrpcService } from './btcrpc.service';
import { BlockProcessService } from './block-process/block-process.service';

@Module({
  providers: [BtcrpcService, BlockProcessService],
  exports: [BtcrpcService]
})
export class BtcrpcModule {}
