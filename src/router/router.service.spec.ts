import { Test, TestingModule } from '@nestjs/testing';
import { RouterService } from './router.service';
import { RouterModule } from './router.module';
import { IndexerModule } from 'src/indexer/indexer.module';
import { IndexerService } from 'src/indexer/indexer.service';
import { CommonModule } from 'src/common/common.module';
import { ProtocolV001Module } from './protocol/protocol-v001.module';
import { MysqlModule } from 'src/common/mysql/mysql.module';
import { OrdService } from 'src/ord/ord.service';
import { OrdModule } from 'src/ord/ord.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { XvmService } from 'src/xvm/xvm.service';
import { CommandsV1Type } from './interface/protocol.interface';

describe('ProtocolService', () => {
  let service: RouterService;
  let indexService: IndexerService
  let module: TestingModule
  let ordService: OrdService
  let xvmService: XvmService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, RouterModule, IndexerModule, ProtocolV001Module,OrdModule,XvmModule],
      providers: [
        RouterService,
        IndexerService,
      ],
    }).compile();

    service = module.get<RouterService>(RouterService);
    indexService = module.get<IndexerService>(IndexerService);
    ordService = module.get<OrdService>(OrdService)
    xvmService = module.get<XvmService>(XvmService)
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // it('deploy command', async () => {
  //   const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAACAAAA2gAAADB4Zjg2YTgwODQxZGNkNjUwMDgyNTIwODk0NjEzOTJmNDk4ZDc3Zjg0NzRlZjdkZDhhZTc0MzM1N2Y5OGE3MjNlYzg3MWZmOTczY2FmYTgwMDA4MDFjYTA5MzE2MmY2MGVmYmYzYzFjYTNhNGNmMzM0NjU2NmEzOTZkZTRiZGU4YWY5ODQyNzMwM2UwODk5MzMxNjJkMjU4YTAzNjRmNzhkODZiYWYzYTJmZmE3NGYwZDQxOWU0NWM2ZTI1ZDZiNzJlNTc5NTdhYjU5NjA3ODRmNDE2YWFlNmE0AAA='
  //   const inscription = {
  //     inscriptionId: 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61bi0',
  //     contentType: '',
  //     contentLength: inscriptionContent.length,
  //     content: inscriptionContent,
  //     hash: 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61b'
  //   }
  //   const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
  //   console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  // })

  // it('invalid deposit command', async () => {
  //   const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAmAAAADB4Zjg0OTgwODA4MDgwODA4MDFjYTBhY2M2OTI3MjJkYWViYjZhYWE0MmY0OTU5NzlmN2IzNzk1Mzc2NTFmZjkzMTcxYTBiODI1ZDA0MTllNzcxYmMzYTA0MWJjNWZmNzZhZGIxODA0NTFlYTQ5N2Y3OWMyMWE4MGM5MmIzYjVlODFlNTI5NTY5MzZmMjczODI3MTE2NTFlAAAAAA=='
  //   const inscription = {
  //     inscriptionId: 'f5bae178e3ec56de4c2c26d2b0fea6aab2ef0a3ad5cb6c177772722133cdcea5i0',
  //     contentType: '',
  //     contentLength: inscriptionContent.length,
  //     content: inscriptionContent,
  //     hash: 'f5bae178e3ec56de4c2c26d2b0fea6aab2ef0a3ad5cb6c177772722133cdcea5'
  //   }
  //   const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
  //   console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  // })

  // it('deposit command', async () => {
  //   const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAxgAAADB4Zjg2MDgwODA4MDk0OTA0YjBlZDIzZWU1ZWUwMzg2ODBhMTI4YzBkMGQwMGYxNjE4YWNmMzgzMGY0MjQwODAxY2EwNWQwN2U0ODFlMzE3ZTdmNDA1YmUyYzQ4ZmM5NGQwMTFhMDBmM2ViMDBhNTIyZTE1MzQ3OTFhMjMwYzMxNjk0N2EwNjY3ZTVmZDBjNTNjNGMxYTc2M2UzZDMwYWYzODQ3YzQ3NTc5MTFiMWQ4YzE4MGQyMzU1Y2E2Nzc2MzJlMDI3YwAA'
  //   const inscription = {
  //     inscriptionId: '6e25fcb8ca01f63203de7b2e568d87a1bb198c427d5edf67d6f0f7494b377113i0',
  //     contentType: '',
  //     contentLength: inscriptionContent.length,
  //     content: inscriptionContent,
  //     hash: '6e25fcb8ca01f63203de7b2e568d87a1bb198c427d5edf67d6f0f7494b377113'
  //   }
  //   const txHashList = await service.from(inscriptionContent).executeTransaction(inscription)
  //   console.log(`txHashList:${JSON.stringify(txHashList, null, 2)}`)
  // })
  it('deposit command parse', async () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAxgAAADB4Zjg2MDgwODA4MDk0OTA0YjBlZDIzZWU1ZWUwMzg2ODBhMTI4YzBkMGQwMGYxNjE4YWNmMzgzMGY0MjQwODAxY2EwNWQwN2U0ODFlMzE3ZTdmNDA1YmUyYzQ4ZmM5NGQwMTFhMDBmM2ViMDBhNTIyZTE1MzQ3OTFhMjMwYzMxNjk0N2EwNjY3ZTVmZDBjNTNjNGMxYTc2M2UzZDMwYWYzODQ3YzQ3NTc5MTFiMWQ4YzE4MGQyMzU1Y2E2Nzc2MzJlMDI3YwAA'
    const command = service.from(inscriptionContent).decodeInscription(inscriptionContent)
    console.log(command)
  })

  it.only('',async()=>{
    const inscribe = await ordService.getInscriptionByTxid('b468c63116eddc5f920958f2999581c932b01b697d03340b08f74611c6d4754e')
    const command = service.from(inscribe.content).decodeInscription(inscribe.content) as CommandsV1Type[]
    const unsign = xvmService.unSignTransaction(command[0].data)
    console.log(unsign)
  })
});