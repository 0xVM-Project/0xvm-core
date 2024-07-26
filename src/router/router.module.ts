import { Module } from '@nestjs/common';
import { RouterService } from './router.service';
import { ProtocolV001Module } from './protocol-v001/protocol-v001.module';

@Module({
    imports: [
        ProtocolV001Module,
    ],
    providers: [
        RouterService,
    ],
    exports: [
        RouterService,
    ]
})
export class RouterModule { }
