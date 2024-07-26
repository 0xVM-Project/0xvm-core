import { Injectable } from '@nestjs/common';
import { IProtocol } from './router.interface';

@Injectable()
export class ProtNotValidService implements IProtocol<any, any, any, any> {
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
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    */

    deploy(inscriptionCommand: any) { return null }
    execute(inscriptionCommand: any) { return null }
    transfer(inscriptionCommand: any) { return null }
    deposit(inscriptionCommand: any) { return null }
    withdraw(inscriptionCommand: any) { return null }
}
