import { Test, TestingModule } from '@nestjs/testing';
import { OrdinalsService } from './ordinals.service';

describe('OrdinalsService', () => {
  let service: OrdinalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdinalsService],
    }).compile();

    service = module.get<OrdinalsService>(OrdinalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
