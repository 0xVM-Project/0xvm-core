import { Test, TestingModule } from '@nestjs/testing';
import { IndexerService } from './indexer.service';
import { CommonModule } from 'src/common/common.module';
import { RouterModule } from 'src/router/router.module';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { OrdModule } from 'src/ord/ord.module';
import { ConfigModule } from '@nestjs/config';
import dbMysqlConfig from 'src/config/db-mysql.config';
import defaultConfig from 'src/config/default.config';
import { SqliteModule } from 'src/common/sqlite/sqlite.module';
import { AxiosModule } from 'src/common/axios/axios.module';
import { BtcrpcModule } from 'src/common/api/btcrpc/btcrpc.module';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';

describe('IndexerService', () => {
  let module: TestingModule
  let service: IndexerService;
  let dataSource: DataSource

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.local', '.env'],  // Specify the loading order
          load: [dbMysqlConfig, defaultConfig],
        }),
        CommonModule,
        TypeOrmModule.forFeature([BlockHashSnapshot]),
        AxiosModule,
        BtcrpcModule,
        SqliteModule,
        RouterModule,
        OrdModule
      ],
      providers: [IndexerService],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
    dataSource = module.get<DataSource>(DataSource);
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

  it('get inscription', async () => {
    const inscription = await service.fetchInscription0xvmByBlock(56253)
    console.log(inscription)
  })

  it.only('fetchNormalInscription0xvmByBlock', async () => {
    const inscription = await service.fetchNormalInscription0xvmByBlock(56363)
    console.log(JSON.stringify(inscription,null,2))
  })

  describe('GenesisInscriptionAddress', () => {
    it('Get GenesisInscriptionAddress by txid', async () => {
      const genesisInscriptionAddress = await service.getGenesisInscriptionAddress('34c70eae5c48062abec8739ac254a1699982aa2c06020ed00b80f6739267d154')
      expect(genesisInscriptionAddress).toEqual('tb1q8gzn9uq9ptupjx4llfcpf9sqarkgndvq2agchk')
    })
    it('Get GenesisInscriptionAddress by inscriptionId', async () => {
      const genesisInscriptionAddress = await service.getGenesisInscriptionAddress('34c70eae5c48062abec8739ac254a1699982aa2c06020ed00b80f6739267d154i0')
      expect(genesisInscriptionAddress).toEqual('tb1q8gzn9uq9ptupjx4llfcpf9sqarkgndvq2agchk')
    })
  })
});
