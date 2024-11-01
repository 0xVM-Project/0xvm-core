import { Injectable } from '@nestjs/common';
import { ProtocolBase } from './protocol/protocol-base';

@Injectable()
export class ProtNotValidService extends ProtocolBase<any, any> {
    saveInscriptionToSqlite(inscriptionList: any[]) {
        return null
    }
    filterInscription(ordiInscriptionsContent: any) {
        return null
    }

    decodeInscription(inscriptionContent: string) {
        return null
    }

    executeTransaction(inscription: any) {
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

    prev(inscriptionCommand: any) { return null }
    mineBlock(inscriptionCommand: any) { return null }
    deploy(inscriptionCommand: any) { return null }
    execute(inscriptionCommand: any) { return null }
    transfer(inscriptionCommand: any) { return null }
    deposit(inscriptionCommand: any) { return null }
    withdraw(inscriptionCommand: any) { return null }

    isPrecomputeInscription(inscriptionContent: string) { return null }
}
