import { Test, TestingModule } from '@nestjs/testing';
import { InscriptionService } from './inscription.service';
import { CommonModule } from 'src/common/common.module';
import { ApiModule } from 'src/common/api/api.module';
import { BtcrpcService } from 'src/common/api/btcrpc/btcrpc.service';

describe('OrdService', () => {
  let module: TestingModule
  let service: InscriptionService;
  let btcApiService: BtcrpcService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        ApiModule,
      ],
      providers: [InscriptionService],
    }).compile();

    service = module.get<InscriptionService>(InscriptionService)
    btcApiService = module.get<BtcrpcService>(BtcrpcService)
  });

  afterAll(async () => {
    await module.close()
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parse insrcription', async () => {
    const txid = 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61b'
    const txinwitness = [
      "f3f2acacad5e5c38138458c37434950ca291c54366b1104d8118b0bf4ac6084dcf5694ca932e9da621aa7f0e375171a7ca43833b9c894514da0d652048406a8e",
      "20fe5f680f60d8715c1d75220fb875c45cd4b27304eae9e9a45a6ee40923f5e50fac0063036f726401010a746578742f706c61696e004d08023066303030314441414141414141426741494141514142674141414151414141414241414141444141414141674144414149414151414341414141416741414141424141414174675541414442345a6a6b774d6d51334d446b344e44466b593251324e5441774f444933597a677a4f5451774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774f4442694f5441794e7a49324d4467774e6a41304d4455794e4449324d4441774f4445354d4455314e5441324d5441794e5467344d4459784d444178595459774d44417a4f5459774d44426d4d325a6c4e6a41344d4459774e4441314d6a4d304f4441784e5459784d4441784d4455334e6a41774d4467775a6d5131596a55774e6a41774e444d324d5441324d5441774e474d314e7a59774d44417a4e5459775a544178597a67774e6a4d774e6a59324d5746695a4445304e6a45774d4455784e5463344d44597a4e6d4e6c5a6d4e6c4e6d55784e4459784d4441325a6a55334f4441324d7a64684e4441324d6a52694d5451324d5441774e7a6b314e7a67774e6a4e684f44646b4f545179597a45304e6a45774d446b334e546331596a59774d4441344d475a6b4e5749324d5441774e546b324d544177596a55314e6a56694e6a41304d4455784e6a45774d4459324f5445354d4459784d44457a595455324e574d080249324d4451774e5445344d446b784d444d354d47597a4e5749324d5441774e7a63324d544177596d49314e6a56694d444131596a59784d4441344d5459784d4445784d5455324e5749324d4451774e5445324d5441774f4755354d546b774e6a45774d544e684e545931596a59774e4441314d5467774f5445774d7a6b775a6a4d31596a59784d4441355a6a59784d4445784e7a55324e5749324d4451774e5445324d54417759574d354d546b774e6a45774d544e684e545931596a59774e4441314d5467774f5445774d7a6b775a6a4d31596a59774d4445314e4467784e545931596a59774d4445344d4459774d4441344d6a67794e5451324d544177593251354d546b774e6a45774d5467304e545931596a6b794e5441314d4467784f5441314e5455774e325a6b4f57526a596a59775957526c4d5445344f545a6c4e7a67345a6d5a684e7a493559544d334e5751324f4449774e3255784e7a49344e446b344d6a426b4f5463314f546b34596a5a6b4e32566a5a446b774d4751774d7a4d324d4441784e5451324d4451774e5445324d5441784d4463354d6a6b784f5441324d5441785a6a6b314e6a56694e6a41304d4455784f4441354d54417a4f5442684d5455324e5749324d4441774e5451344d5455324e5749324d4441774e6a41774d5455304f5441314d446b774e545931596a59774d4441344d546b774e5441354d546b774e544d080241314e6a56694e6a45774d544d304f4445324d5441784d6a45314e6a56694f4449314d6a55774e5441314e6a56694e6a41774d4459774d6a41344d6a41784f5441314d4459784d4445305a6a59774d4441344d7a41784f4451324d5441784d6d49314e6a56694f5449354d5455774e5441314e6a56694e3259305a5451344e3249334d5441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774d4441774e6a41774d4455794e6a41784d5459774d4451314d6a59774d6a51324d4441775a6d5131596a59774d4441324d5441784f4759344d6a59784d4445794d5455324e5749354d5455774e6a45774d546c684f444d324d5441784d6a45314e6a56694f5449314d4467794f4449774d546b774e5441344d4467794d5445784e5459784d4446694d6a55334e6a45774d5749784e6a45774d5455314e545931596a56694f5449354d5455774e5441314e6a56694e6a41774d44637a5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6d5a6a67794d5459354d4455774f5445354d4455774e545931596a59774d4441324d5441785a544d344d6a59784d4446694f4455324e5749354d4455774f5445354d4455774e545931596a59784d444dd601466d4d7a67784e6a45774d5751344e545931596a67794e5449314d4455774e545931596a59774d4441324d4451774f4449774d546b774e5441324d5441794d4755324d4441774f444d774d5467314e6a45774d5756684e545931596a59784d444978596a59774d6a41344d7a41784f4451324d5441784d6d49314e6a56694f544d354d6a55774e5441314d4455325a6d56684d6a59304e6a6b334d4459324e7a4d314f4449794d5449794d44466c5a5749774d3259335a4455784f446c684e324a6c4d324577596a49304d7a51334f5463315932526c597a67314f57466c59324e6b596a64684e3249344f444d794e6d51324e5442694e474e6c5a445932595751324e44637a4e6d5932597a597a4e444d774d4441344d5467774d444d7a4e7a64684d474d30597a63774f54426d5a5449345a6d59344d32466d596a4d335a6d51354d446b304f5449355957466c4e6a45334f4441794d44466d4f5456684d7a6c6d4e6a56684d7a63774f57457a4e6a5177596d4d794f5752684d4449775a5445775a54466a4f544d304e325532596a45355a575a6a4d544d314e4749334d6d4d355a5446694f4751335a4759305a44646d4d7a51325a5463334f546b795a6a45314f4759314f545131597a6c685a6a414141413d3d68",
      "c1fe5f680f60d8715c1d75220fb875c45cd4b27304eae9e9a45a6ee40923f5e50f34cfe4219677592a71ba049053f07cea4fb6ebab6a40ef88c7e51445c195a438"
    ]
    const data = service.getInscriptionContentData(txid, txinwitness)
    console.log(data)
  })

  it('parse insrcription for btc rpc tx', async () => {
    const { result: hash } = await btcApiService.getblockhash(2865305)
    const { result: { tx } } = await btcApiService.getBlock(hash)
    for (const t of tx) {
      const txid = t.txid
      const txinwitness = t.vin.at(0).txinwitness
      const data = service.getInscriptionContentData(txid, txinwitness)
      if (data.contentLength > 0 && data.content.startsWith('0f0001')) {
        console.log(`length: ${data.contentLength} content(6): ${data.content}`)
      }
      if(data.contentLength==0){
        console.log(`length: ${data.contentLength} content(6): ${data.content}`)
      }
    }
  })
});
