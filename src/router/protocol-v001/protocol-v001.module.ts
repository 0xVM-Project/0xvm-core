import { Module } from '@nestjs/common';
import { ProtocolV001Service } from './protocol-v001.service';
import { ProtNotValidService } from '../prot-not-valid.service';
import { WithdrawModule } from './withdraw/withdraw.module';
import { HashMappingModule } from './hash-mapping/hash-mapping.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { OrdinalsModule } from 'src/common/api/ordinals/ordinals.module';

@Module({
    imports: [
        WithdrawModule,
        HashMappingModule,
        XvmModule,
        OrdinalsModule
    ],
    providers: [
        ProtocolV001Service,
        ProtNotValidService,
    ],
    exports: [
        ProtocolV001Service,
        ProtNotValidService,
    ]
})
export class ProtocolV001Module { }
