import { Module } from '@nestjs/common';
import { ProtocolV001Service } from './protocol-v001.service';
import { WithdrawModule } from './withdraw/withdraw.module';
import { HashMappingModule } from './hash-mapping/hash-mapping.module';
import { XvmModule } from 'src/xvm/xvm.module';
import { OrdinalsModule } from 'src/common/api/ordinals/ordinals.module';
import { OrdModule } from 'src/ord/ord.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockHashSnapshot } from 'src/entities/block-snapshot.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([BlockHashSnapshot]),
        WithdrawModule,
        HashMappingModule,
        XvmModule,
        OrdinalsModule,
        OrdModule,
    ],
    providers: [
        ProtocolV001Service,
    ],
    exports: [
        ProtocolV001Service,
    ]
})
export class ProtocolV001Module { }
