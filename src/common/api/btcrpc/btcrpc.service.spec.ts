import { Test, TestingModule } from '@nestjs/testing';
import { BtcrpcService } from './btcrpc.service';
import { CommonModule } from 'src/common/common.module';
import * as bitcoin from 'bitcoinjs-lib'
import * as fs from 'fs'
import { BlockProcessService } from './block-process/block-process.service';
import { OrdModule } from 'src/ord/ord.module';
import { InscriptionService } from 'src/ord/inscription.service';

describe('BtcrpcService', () => {
  let module: TestingModule
  let service: BtcrpcService
  let blockProcessService: BlockProcessService
  let inscriptionService: InscriptionService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        OrdModule
      ],
      providers: [
        BtcrpcService,
        BlockProcessService,
      ],
    }).compile();

    service = module.get<BtcrpcService>(BtcrpcService);
    blockProcessService = module.get<BlockProcessService>(BlockProcessService);
    inscriptionService = module.get<InscriptionService>(InscriptionService);
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get block hex to string', async () => {
    const { result: hash } = await service.getblockhash(2865305)
    console.log(`hash:${hash}`)
    const { result: blockDataHex } = await service.getBlockToHex(hash)
    const data = blockProcessService.processBlock(blockDataHex)
    for (const tx of data.transactions) {
      const inscription = inscriptionService.getInscriptionContentData(tx.txid, tx.ins[0].witness)
      const content = inscription.content
      if (content.startsWith('0f0001')) {
        console.log(content)
        console.log(JSON.stringify(tx, null, 2))
      }
    }
  })
});
