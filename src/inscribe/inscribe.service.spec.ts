import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AxiosModule } from 'src/common/axios/axios.module';
import dbMysqlConfig from 'src/config/db-mysql.config';
import defaultConfig from 'src/config/default.config';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastConfig } from 'src/entities/last-config.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { ProtocolV001Module } from 'src/router/protocol/protocol-v001.module';
import { ProtocolV001Service } from 'src/router/protocol/protocol-v001.service';
import { RouterModule } from 'src/router/router.module';
import { DataSource } from 'typeorm';
import { InscribeService } from './inscribe.service';
import { MysqlModule } from 'src/common/mysql/mysql.module';
import { ethers } from 'ethers';

jest.setTimeout(30000)

describe('InscribeService', () => {
  let module: TestingModule;
  let service: InscribeService;
  let protocol001Service: ProtocolV001Service;
  let config: ConfigService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.local', '.env'],
          load: [dbMysqlConfig, defaultConfig],
        }),
        ProtocolV001Module,
        AxiosModule,
        RouterModule,
        MysqlModule,
        TypeOrmModule.forFeature([
          PreBroadcastTx,
          LastConfig,
          HashMapping,
          PreBroadcastTxItem,
          BlockHashSnapshot,
        ]),
      ],
      providers: [InscribeService],
    }).compile();

    config = module.get<ConfigService>(ConfigService);
    service = module.get<InscribeService>(InscribeService);
    protocol001Service = module.get<ProtocolV001Service>(ProtocolV001Service);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // it('create signed inscription', async () => {
  //   const defaultConf: ConfigType<typeof defaultConfig> = config.get('defalut');
  //   console.log(defaultConf.xvm.sysPrivateKey);
  //   const provider = new ethers.JsonRpcProvider(defaultConf.xvm.xvmRpcUrl);
  //   const wallet = new ethers.Wallet(defaultConf.xvm.sysPrivateKey, provider);

  //   const gasFee = await provider.getFeeData();

  //   const transactionHex = await wallet.signTransaction({
  //     to: '0xa7764B63d91810422F4D743b7907f469cB7a6D20',
  //     value: 100,
  //     chainId: 42,
  //     gasPrice: gasFee.gasPrice,
  //     gasLimit: 21000,
  //     nonce: 1
  //   });
  //   console.log(transactionHex);

  //   const commandTx = {
  //     action: 3,
  //     data: transactionHex as `0x${string}`,
  //   };

  //   const encodedTx = protocol001Service.encodeInscription([commandTx]);
  //   console.log(encodedTx);
  // });

  // it('transfer btc', async () => {
  //   await service.run();
  // });
});
