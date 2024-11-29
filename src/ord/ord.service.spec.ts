import { Test, TestingModule } from '@nestjs/testing';
import { InscriptionService } from './inscription.service';
import { CommonModule } from 'src/common/common.module';
import { ApiModule } from 'src/common/api/api.module';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';
import { OrdModule } from './ord.module';
import { OrdService } from './ord.service';

describe('OrdService', () => {
  let module: TestingModule
  let service: InscriptionService;
  let btcApiService: BtcrpcService
  let ordService: OrdService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        ApiModule,
        OrdModule
      ],
      providers: [InscriptionService],
    }).compile();

    service = module.get<InscriptionService>(InscriptionService)
    btcApiService = module.get<BtcrpcService>(BtcrpcService)
    ordService = module.get<OrdService>(OrdService)
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parse insrcription', async () => {
    const txid = 'fff0ca7cfbaff6e5725cf4a8b269dcb2eb8194af2e626dfdc8627378bb79330f'
    const txinwitness = [
      "c1ba6a24748bb9d63466255593c3ccfe4e20ed98596d848f1d4a21cea2c65e2c73361ab7ffaf840c12d6b03522a19240e0f7dee360e9df605244d4b2f6b5d4ae",
      "20aa691f171b1e7645c2edd907ccf978d29dde405f7a10f87b92ef3e20d075b12dac0063036f726401010a746578742f706c61696e004d56013066303030314441414141414141426741494141514142674141414151414141414241414141444141414141674144414149414151414341414141416741414141454141414178674141414442345a6a67324d4467774f4441344d446b304f544130596a426c5a44497a5a5755315a5755774d7a67324f4442684d544934597a426b4d4751774d4759784e6a453459574e6d4d7a677a4d4759304d6a51774f444178593245774e5751774e3255304f44466c4d7a45335a54646d4e444131596d5579597a51345a6d4d354e4751774d5446684d44426d4d3256694d4442684e5449795a5445314d7a51334f5446684d6a4d77597a4d784e6a6b304e3245774e6a59335a54566d5a44426a4e544e6a4e474d78595463324d32557a5a444d775957597a4f445133597a51334e5463354d5446694d575134597a45344d4751794d7a5531593245324e7a63324d7a4a6c4d4449335977414168",
      "c1aa691f171b1e7645c2edd907ccf978d29dde405f7a10f87b92ef3e20d075b12d5926a3070e9b310ebb79d2fc65e144dc22c9c91588883a05ecf3889c703f3bf0"
    ]
    const data = service.getInscriptionContentData(txid, txinwitness)
    console.log(data)
  })

  it('parse insrcription for btc rpc tx', async () => {
    const { result: hash } = await btcApiService.getblockhash(2865305)
    const { result: { tx } } = await btcApiService.getBlock(hash)
    for (const t of tx) {
      const txid = t.txid
      const txinwitness = t.vin.at(0)!.txinwitness
      const data = service.getInscriptionContentData(txid, txinwitness)
      if (!data) {
        return new Error(`data invalid`)
      }
      if (data.contentLength > 0 && data.content.startsWith('0f0001')) {
        console.log(`length: ${data.contentLength} content(6): ${data.content}`)
      }
      if (data.contentLength == 0) {
        console.log(`length: ${data.contentLength} content(6): ${data.content}`)
      }
    }
  })
  it('getInscriptionGenesisAddress', async () => {
    const address = await ordService.getInscriptionGenesisAddress('44103d5ecbab7586dfa07516f016d001886a30bf480186d64e2436795cf218d3')
    expect('tb1pzzzum6hqusz8qfczhwpwsjutqd0nrumez0rdqda44977ds52swps22rmxc').toEqual(address)
  })
});
