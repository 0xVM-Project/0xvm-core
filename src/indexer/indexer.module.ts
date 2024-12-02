import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { RouterModule } from '../router/router.module';
import { OrdModule } from 'src/ord/ord.module';
import { BtcrpcModule } from 'src/common/api/btcrpc/btcrpc.module';

@Module({
  imports: [RouterModule, OrdModule, BtcrpcModule],
  providers: [
    IndexerService
  ],
  exports: [
    IndexerService, OrdModule
  ]
})
export class IndexerModule { }
