import { Module } from '@nestjs/common';
import { CoreService } from './core.service';
import { IndexerModule } from 'src/indexer/indexer.module';
import { RouterModule } from 'src/router/router.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { OrdinalsModule } from 'src/common/api/ordinals/ordinals.module';
import { OrdModule } from 'src/ord/ord.module';

@Module({
    imports: [
        IndexerModule,
        RouterModule,
        XvmModule,
        OrdinalsModule,
        OrdModule
    ],
    providers: [
        CoreService,
    ],
    exports: [
        CoreService
    ]
})
export class CoreModule { }
