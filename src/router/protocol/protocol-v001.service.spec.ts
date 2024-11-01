import { Test, TestingModule } from '@nestjs/testing';
import { IndexerModule } from 'src/indexer/indexer.module';
import { IndexerService } from 'src/indexer/indexer.service';
import { CommonModule } from 'src/common/common.module';
import { MysqlModule } from 'src/common/mysql/mysql.module';
import { ProtocolV001Module } from './protocol-v001.module';
import { ProtocolV001Service } from './protocol-v001.service';
import { XvmModule } from 'src/xvm/xvm.module';
import { SqliteModule } from 'src/common/sqlite/sqlite.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { HashMappingModule } from './hash-mapping/hash-mapping.module';
import { OrdModule } from 'src/ord/ord.module';
import { RouterModule } from '../router.module';
import { DataSource } from 'typeorm';
import { sleep } from 'src/utils/times';

const depositInscription1 = () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAACAAAA2gAAADB4Zjg2YTgwODQxZGNkNjUwMDgyNTIwODk0NjEzOTJmNDk4ZDc3Zjg0NzRlZjdkZDhhZTc0MzM1N2Y5OGE3MjNlYzg3MWZmOTczY2FmYTgwMDA4MDFjYTA5MzE2MmY2MGVmYmYzYzFjYTNhNGNmMzM0NjU2NmEzOTZkZTRiZGU4YWY5ODQyNzMwM2UwODk5MzMxNjJkMjU4YTAzNjRmNzhkODZiYWYzYTJmZmE3NGYwZDQxOWU0NWM2ZTI1ZDZiNzJlNTc5NTdhYjU5NjA3ODRmNDE2YWFlNmE0AAA='
    return {
        blockHeight: 268900,
        inscriptionId: 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61bi0',
        contentType: '',
        contentLength: inscriptionContent.length,
        content: inscriptionContent
    }
}

// invalid deposit command
const depositInscription2 = () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAACAAAA2gAAADB4Zjg2YTgwODQxZGNkNjUwMDgyNTIwODk0NjEzOTJmNDk4ZDc3Zjg0NzRlZjdkZDhhZTc0MzM1N2Y5OGE3MjNlYzg3MWZmOTczY2FmYTgwMDA4MDFjYTA5MzE2MmY2MGVmYmYzYzFjYTNhNGNmMzM0NjU2NmEzOTZkZTRiZGU4YWY5ODQyNzMwM2UwODk5MzMxNjJkMjU4YTAzNjRmNzhkODZiYWYzYTJmZmE3NGYwZDQxOWU0NWM2ZTI1ZDZiNzJlNTc5NTdhYjU5NjA3ODRmNDE2YWFlNmE0AAA='
    return {
        blockHeight: 268901,
        inscriptionId: 'ba6307750d57b99a5ffa0bac2b1fd7efc5953d8f094bf56bcbd298c5e621a61bi0',
        contentType: '',
        contentLength: inscriptionContent.length,
        content: inscriptionContent
    }
}

const depositInscription3 = () => {
    const inscriptionContent = '0f0001DAAAAAAABgAIAAQABgAAAAQAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAEAAAAmAAAADB4Zjg0OTgwODA4MDgwODA4MDFjYTBhY2M2OTI3MjJkYWViYjZhYWE0MmY0OTU5NzlmN2IzNzk1Mzc2NTFmZjkzMTcxYTBiODI1ZDA0MTllNzcxYmMzYTA0MWJjNWZmNzZhZGIxODA0NTFlYTQ5N2Y3OWMyMWE4MGM5MmIzYjVlODFlNTI5NTY5MzZmMjczODI3MTE2NTFlAAAAAA'
    return {
        blockHeight: 268902,
        inscriptionId: '6e25fcb8ca01f63203de7b2e568d87a1bb198c427d5edf67d6f0f7494b377113i0',
        contentType: '',
        contentLength: inscriptionContent.length,
        content: inscriptionContent
    }
}

describe('ProtocolV001Service', () => {
    let protocolV001Service: ProtocolV001Service
    let module: TestingModule
    let dataSource: DataSource;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forFeature([BtcHistoryTx]),
                SqliteModule,
                CommonModule,
                HashMappingModule,
                ProtocolV001Module,
                OrdModule,
                RouterModule,
                XvmModule],
            providers: [
                ProtocolV001Service,
                IndexerService,
            ],
            exports: [ProtocolV001Service]
        }).compile();

        protocolV001Service = module.get<ProtocolV001Service>(ProtocolV001Service);
        dataSource = module.get<DataSource>(DataSource);
    });

    afterAll(async () => {
        await dataSource.destroy();
        await module.close()
    })

    it('historyTxSequencer', async () => {
        const inscriptionList = [
            depositInscription1(),
            depositInscription2(),
            depositInscription3(),
        ]
        // await protocolV001Service.historyTxSequencer(inscriptionList)
    })
});