import { Module } from '@nestjs/common';
import { CoreService } from './core.service';
import { IndexerModule } from 'src/indexer/indexer.module';
import { RouterModule } from 'src/router/router.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { OrdinalsModule } from 'src/common/api/ordinals/ordinals.module';
import { OrdModule } from 'src/ord/ord.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';
import { HashMappingModule } from 'src/router/protocol/hash-mapping/hash-mapping.module';
import { SequencerService } from './sequencer/sequencer.service';
import { SqliteModule } from 'src/common/sqlite/sqlite.module';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { PreExecutionModule } from 'src/pre-execution/pre-execution.module';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PreBroadcastTxItem } from 'src/entities/pre-broadcast-tx-item.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([BlockHashSnapshot,LastTxHash,PreBroadcastTxItem]),
        IndexerModule,
        RouterModule,
        XvmModule,
        OrdinalsModule,
        OrdModule,
        HashMappingModule,
        SqliteModule,
        PreExecutionModule
    ],
    providers: [
        CoreService,
        SequencerService,
    ],
    exports: [
        CoreService
    ]
})
export class CoreModule { }
