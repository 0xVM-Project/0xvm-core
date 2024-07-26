import { Test, TestingModule } from '@nestjs/testing';
import { IndexerService } from './indexer.service';
import { CommonModule } from 'src/common/common.module';
import { RouterModule } from 'src/router/router.module';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { Withdraw } from 'src/entities/withdraw.entity';

describe('IndexerService', () => {
  let module: TestingModule
  let service: IndexerService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        RouterModule,
      ],
      providers: [IndexerService],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get latest block number', async () => {
    const blockNumber = await service.getLatestBlockNumberForBtc()
    console.log(blockNumber)
  })

  it('get inscription',async()=>{
    const inscription = await service.fetchInscription0xvmByBlock(2865749)
    console.log(inscription)
  })
});
