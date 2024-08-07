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

@Module({
    imports: [
        TypeOrmModule.forFeature([BlockHashSnapshot]),
        IndexerModule,
        RouterModule,
        XvmModule,
        OrdinalsModule,
        OrdModule,
        HashMappingModule,
    ],
    providers: [
        CoreService,
    ],
    exports: [
        CoreService
    ]
})
export class CoreModule { }
