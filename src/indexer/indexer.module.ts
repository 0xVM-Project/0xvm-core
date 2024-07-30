import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { RouterModule } from '../router/router.module';
import { OrdModule } from 'src/ord/ord.module';

@Module({
  imports: [RouterModule, OrdModule],
  providers: [
    IndexerService
  ],
  exports: [
    IndexerService, OrdModule
  ]
})
export class IndexerModule { }
