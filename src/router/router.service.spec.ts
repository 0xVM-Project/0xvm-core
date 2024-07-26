import { Test, TestingModule } from '@nestjs/testing';
import { RouterService } from './router.service';
import { RouterModule } from './router.module';
import { IndexerModule } from 'src/indexer/indexer.module';
import { IndexerService } from 'src/indexer/indexer.service';
import { CommonModule } from 'src/common/common.module';

describe('ProtocolService', () => {
  let service: RouterService;
  let indexService: IndexerService
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, RouterModule, IndexerModule],
      providers: [
        RouterService,
        IndexerService,
      ],
    }).compile();

    service = module.get<RouterService>(RouterService);
    indexService = module.get<IndexerService>(IndexerService);
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Protocol0f0001Service', () => {
    it('deploy command', () => {
      const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAACAAAA2gAAADB4Zjg2YTgwODQxZGNkNjUwMDgyNTIwODk0NjEzOTJmNDk4ZDc3Zjg0NzRlZjdkZDhhZTc0MzM1N2Y5OGE3MjNlYzg3MWZmOTczY2FmYTgwMDA4MDFjYTA5MzE2MmY2MGVmYmYzYzFjYTNhNGNmMzM0NjU2NmEzOTZkZTRiZGU4YWY5ODQyNzMwM2UwODk5MzMxNjJkMjU4YTAzNjRmNzhkODZiYWYzYTJmZmE3NGYwZDQxOWU0NWM2ZTI1ZDZiNzJlNTc5NTdhYjU5NjA3ODRmNDE2YWFlNmE0AAA='
      const inscription = {
        blockHeight: 200000,
        inscriptionId: 'adfasdfsadfsdfsdfsd',
        content: inscriptionContent,
      }
      const tr = service.from(inscriptionContent).executeTransaction(inscription)
      console.log(`it tr`, tr)
    })
  })
});
