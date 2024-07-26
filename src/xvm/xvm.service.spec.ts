import { Test, TestingModule } from '@nestjs/testing';
import { XvmService } from './xvm.service';
import { CommonModule } from 'src/common/common.module';

describe('XvmService', () => {
  let service: XvmService;
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule],
      providers: [XvmService],
    }).compile();

    service = module.get<XvmService>(XvmService);
  });

  afterAll(async()=>{
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getLatestBlockNumber',async()=>{
    const blocknumber = await service.getLatestBlockNumber()
    expect(!Number.isNaN(blocknumber)).toEqual(true)
  })
});
