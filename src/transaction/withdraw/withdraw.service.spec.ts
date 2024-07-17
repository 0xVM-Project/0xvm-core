import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawService } from './withdraw.service';
import { TransactionModule } from '../transaction.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdraw } from 'src/entities/withdraw.entity';
import { CommonModule } from 'src/common/common.module';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.setTimeout(30000)

describe('WithdrawService', () => {
  let service: WithdrawService;
  let dataSource: DataSource;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CommonModule,
        TypeOrmModule.forFeature([Withdraw]),],
      providers: [WithdrawService],
    }).compile();

    service = module.get<WithdrawService>(WithdrawService);
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.destroy();  // close DataSource
    await module.close();  // close the NestJS module
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create withdraw request', async() => {
    const result = await service.withdrawRequest({
      fromAddress: 'tb1plem349zzfpd760llw3kkegvukpxzntfuf58rvxzzskvd2mh9uh0s3pr7j4',
      toAddress: 'tb1pu8hqz0qvn4725auhqhut7m3kf8hcesmzzmy8k0yjfyw0qgk59ejs255a2j',
      amount: '2000',
      evmHash: '0x2',
      status: 1
    })
    console.log(result)
  })
});
