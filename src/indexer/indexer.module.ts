import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { RouterModule } from '../router/router.module';

@Module({
  imports: [RouterModule],
  providers: [
    IndexerService
  ],
  exports: [
    IndexerService,
  ]
})
export class IndexerModule { }
