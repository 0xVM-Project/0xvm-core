import { Test, TestingModule } from '@nestjs/testing';
import { BlockProcessService } from './block-process.service';

describe('BlockServiceService', () => {
  let service: BlockProcessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockProcessService],
    }).compile();

    service = module.get<BlockProcessService>(BlockProcessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
