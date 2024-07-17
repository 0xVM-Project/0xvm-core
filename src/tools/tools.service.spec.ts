import { Test, TestingModule } from '@nestjs/testing';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ToolsModule } from './tools.module';

describe('ToolService', () => {
  let service: ToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolsService],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('It should be possible to obtain a timestamp', () => {
    expect(service).toBeDefined();
    console.log(service.fetchTimestamp())
  });
});
