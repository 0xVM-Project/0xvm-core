import { Injectable } from '@nestjs/common';
import { ProtocolBase } from './protocol/protocol-base';
import { Inscription } from 'src/ord/inscription.service';
import { BaseCommandsType } from './interface/protocol.interface';

@Injectable()
export class ProtNotValidService extends ProtocolBase<Inscription, BaseCommandsType> {
    filterInscription(inscription: Inscription): Inscription | null {
        return null
    }

    decodeInscription(inscriptionContent: string): Array<BaseCommandsType> {
        return []
    }

    async executeTransaction(inscription: any): Promise<Array<string>> {
        return []
    }

    encodeInscription(inscription: any): string | null {
        return null
    }

    /** protocol action
    **  prev = 0,
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    **  mineBlock = 6
    */

    async prev(data: string, inscription: Inscription): Promise<string | null> { return null }
    async mineBlock(data: string, inscription: Inscription): Promise<string | null> { return null }
    async deploy(data: string, inscription: Inscription): Promise<string | null> { return null }
    async execute(data: string, inscription: Inscription): Promise<string | null> { return null }
    async transfer(data: string, inscription: Inscription): Promise<string | null> { return null }
    async deposit(data: string, inscription: Inscription): Promise<string | null> { return null }
    async withdraw(data: string, inscription: Inscription): Promise<string | null> { return null }

    isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string } { return { isPrecompute: false, mineTimestamp: 0, prevHash: '' } }
}
