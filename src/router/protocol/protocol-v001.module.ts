import { Module } from '@nestjs/common';
import { ProtocolV001Service } from './protocol-v001.service';
import { HashMappingModule } from './hash-mapping/hash-mapping.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { OrdinalsModule } from 'src/common/api/ordinals/ordinals.module';
import { OrdModule } from 'src/ord/ord.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { SqliteModule } from 'src/common/sqlite/sqlite.module';
import { BtcrpcModule } from 'src/common/api/btcrpc/btcrpc.module';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([BlockHashSnapshot, PreBroadcastTxItem]),
        SqliteModule,
        HashMappingModule,
        XvmModule,
        OrdinalsModule,
        OrdModule,
        BtcrpcModule
    ],
    providers: [
        ProtocolV001Service,
    ],
    exports: [
        ProtocolV001Service,
    ]
})
export class ProtocolV001Module { }
