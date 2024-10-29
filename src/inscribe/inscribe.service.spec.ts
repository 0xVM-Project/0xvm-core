import { Test, TestingModule } from '@nestjs/testing';
import { InscribeService } from './inscribe.service';

describe('InscribeService', () => {
  let service: InscribeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InscribeService],
    }).compile();

    service = module.get<InscribeService>(InscribeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
