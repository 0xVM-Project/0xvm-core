import { Test, TestingModule } from '@nestjs/testing';
import { BtcrpcService } from './btcrpc.service';

describe('BtcrpcService', () => {
  let service: BtcrpcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BtcrpcService],
    }).compile();

    service = module.get<BtcrpcService>(BtcrpcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
