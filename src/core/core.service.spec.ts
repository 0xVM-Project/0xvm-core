import { Test, TestingModule } from '@nestjs/testing';
import { CoreService } from './core.service';
import { RouterModule } from 'src/router/router.module';
import { IndexerModule } from 'src/indexer/indexer.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { CommonModule } from 'src/common/common.module';

jest.setTimeout(30000)

describe('CoreService', () => {
  let module: TestingModule
  let service: CoreService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        IndexerModule,
        RouterModule,
        XvmModule,
      ],
      providers: [CoreService],
    }).compile();

    service = module.get<CoreService>(CoreService);
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('process block', async () => {
    await service.processBlock(2865305)
  })
});
