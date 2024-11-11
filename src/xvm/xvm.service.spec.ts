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

  it.only('unSignTransaction',async()=>{
    const data = '0xf86080808094904b0ed23ee5ee038680a128c0d0d00f1618acf3830f4240801ca05d07e481e317e7f405be2c48fc94d011a00f3eb00a522e1534791a230c316947a0667e5fd0c53c4c1a763e3d30af3847c4757911b1d8c180d2355ca677632e027c'
    const tx = service.unSignTransaction(data)
    console.log(tx)
  })
});
