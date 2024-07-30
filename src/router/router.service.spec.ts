import { Test, TestingModule } from '@nestjs/testing';
import { RouterService } from './router.service';
import { RouterModule } from './router.module';
import { IndexerModule } from 'src/indexer/indexer.module';
import { IndexerService } from 'src/indexer/indexer.service';
import { CommonModule } from 'src/common/common.module';
import { ProtocolV001Module } from './protocol-v001/protocol-v001.module';
import { MysqlModule } from 'src/common/mysql/mysql.module';

describe('ProtocolService', () => {
  let service: RouterService;
  let indexService: IndexerService
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, RouterModule, IndexerModule, ProtocolV001Module],
      providers: [
        RouterService,
        IndexerService,
      ],
    }).compile();

    service = module.get<RouterService>(RouterService);
    indexService = module.get<IndexerService>(IndexerService);
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deploy command', async () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAACAAAA2gAAADB4Zjg2YTgwODQxZGNkNjUwMDgyNTIwODk0NjEzOTJmNDk4ZDc3Zjg0NzRlZjdkZDhhZTc0MzM1N2Y5OGE3MjNlYzg3MWZmOTczY2FmYTgwMDA4MDFjYTA5MzE2MmY2MGVmYmYzYzFjYTNhNGNmMzM0NjU2NmEzOTZkZTRiZGU4YWY5ODQyNzMwM2UwODk5MzMxNjJkMjU4YTAzNjRmNzhkODZiYWYzYTJmZmE3NGYwZDQxOWU0NWM2ZTI1ZDZiNzJlNTc5NTdhYjU5NjA3ODRmNDE2YWFlNmE0AAA='
    const inscription = {
      inscriptionId: 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61bi0',
      contentType: '',
      contentLength: inscriptionContent.length,
      content: inscriptionContent
    }
    const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
    console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  })

  it('invalid deposit command', async () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAmAAAADB4Zjg0OTgwODA4MDgwODA4MDFjYTBhY2M2OTI3MjJkYWViYjZhYWE0MmY0OTU5NzlmN2IzNzk1Mzc2NTFmZjkzMTcxYTBiODI1ZDA0MTllNzcxYmMzYTA0MWJjNWZmNzZhZGIxODA0NTFlYTQ5N2Y3OWMyMWE4MGM5MmIzYjVlODFlNTI5NTY5MzZmMjczODI3MTE2NTFlAAAAAA=='
    const inscription = {
      inscriptionId: 'f5bae178e3ec56de4c2c26d2b0fea6aab2ef0a3ad5cb6c177772722133cdcea5i0',
      contentType: '',
      contentLength: inscriptionContent.length,
      content: inscriptionContent
    }
    const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
    console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  })

  it.only('deposit command', async () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAmAAAADB4Zjg0OTgwODA4MDgwODA4MDFjYTBhY2M2OTI3MjJkYWViYjZhYWE0MmY0OTU5NzlmN2IzNzk1Mzc2NTFmZjkzMTcxYTBiODI1ZDA0MTllNzcxYmMzYTA0MWJjNWZmNzZhZGIxODA0NTFlYTQ5N2Y3OWMyMWE4MGM5MmIzYjVlODFlNTI5NTY5MzZmMjczODI3MTE2NTFlAAAAAA'
    const inscription = {
      inscriptionId: '6e25fcb8ca01f63203de7b2e568d87a1bb198c427d5edf67d6f0f7494b377113i0',
      contentType: '',
      contentLength: inscriptionContent.length,
      content: inscriptionContent
    }
    const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
    console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  })
});
