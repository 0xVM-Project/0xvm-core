import { Test, TestingModule } from '@nestjs/testing';
import { HashMappingService } from './hash-mapping.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { CommonModule } from 'src/common/common.module';
import { DataSource } from 'typeorm';

describe('HashMappingService', () => {
  let service: HashMappingService;
  let module: TestingModule
  let dataSource: DataSource

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forFeature([HashMapping]),
        CommonModule,
      ],
      providers: [HashMappingService],
    }).compile();

    service = module.get<HashMappingService>(HashMappingService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getMappingHashByTxid',async()=>{
    const data = await service.getMappingHashByTxid('25fceec478c5f48ac34dcea7e4480020802350983da7997eb18073f467a02924')
    console.log(data)
  })
});
