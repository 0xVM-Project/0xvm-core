import { Injectable } from '@nestjs/common';
import { ProtocolVersionEnum } from './router.enum';
import { ProtocolV001Service } from './protocol/protocol-v001.service';
import { ProtNotValidService as NotValidProtocolService } from './prot-not-valid.service';
import { IProtocol } from './router.interface';
import { IndexerService } from 'src/indexer/indexer.service';
import { ProtocolBase } from './protocol/protocol-base';
import { Inscription } from 'src/ord/inscription.service';
import { BaseCommandsType } from './interface/protocol.interface';

@Injectable()
export class RouterService {
    public readonly handlers: Record<ProtocolVersionEnum, ProtocolBase<Inscription, BaseCommandsType>>

    constructor(
        private readonly notValidProtocolService: NotValidProtocolService,
        private readonly protV001Service: ProtocolV001Service,
    ) {
        this.handlers = {
            [ProtocolVersionEnum['0f0001']]: this.protV001Service,
            [ProtocolVersionEnum['0f0002']]: this.protV001Service,
        }
    }

    from(inscriptionContent: string): ProtocolBase<Inscription, BaseCommandsType> {
        const version = inscriptionContent.slice(0, 6)
        if (version in this.handlers) {
            const protocolVersion = version as ProtocolVersionEnum;
            return this.handlers[protocolVersion]
        } else {
            return this.notValidProtocolService
        }
    }
}
