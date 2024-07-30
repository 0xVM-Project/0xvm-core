import { Module } from '@nestjs/common';
import { RouterService } from './router.service';
import { ProtocolV001Module } from './protocol-v001/protocol-v001.module';
import { ProtNotValidService } from './prot-not-valid.service';

@Module({
    imports: [
        ProtocolV001Module,
    ],
    providers: [
        RouterService,
        ProtNotValidService,
    ],
    exports: [
        RouterService,
        ProtNotValidService
    ]
})
export class RouterModule { }
