import { Test, TestingModule } from '@nestjs/testing';
import { HashMappingService } from './hash-mapping.service';

describe('HashMappingService', () => {
  let service: HashMappingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashMappingService],
    }).compile();

    service = module.get<HashMappingService>(HashMappingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
