import { Injectable } from '@nestjs/common';
import { ProtocolVersionEnum } from './router.enum';
import { ProtocolV001Service } from './protocol/protocol-v001.service';
import { ProtNotValidService as NotValidProtocolService } from './prot-not-valid.service';
import { IProtocol } from './router.interface';

@Injectable()
export class RouterService {
    public readonly handlers: Record<ProtocolVersionEnum, ProtocolV001Service>

    constructor(
        private readonly notValidProtocolService: NotValidProtocolService,
        private readonly protV001Service: ProtocolV001Service,
    ) {
        this.handlers = {
            [ProtocolVersionEnum['0f0001']]: this.protV001Service,
            [ProtocolVersionEnum['0f0002']]: this.protV001Service,
        }
    }
    
    from(inscriptionContent: string): IProtocol<any, any> {
        const version = inscriptionContent.slice(0, 6)
        if (version in this.handlers) {
            return this.handlers[version]
        } else {
            return this.notValidProtocolService
        }
    }
}
