import { IProtocol } from "../router.interface";

export abstract class ProtocolBase<I, C> implements IProtocol<I, C> {
    abstract filterInscription(ordiInscriptionsContent: I): I | null
    abstract decodeInscription(inscriptionContent: string): Array<C>
    abstract executeTransaction(inscription: I): Promise<Array<string>>
    abstract deploy(data: string, inscription: I): Promise<string>
    abstract execute(data: string, inscription: I): Promise<string>
    abstract transfer(data: string, inscription: I): Promise<string>
    abstract deposit(data: string, inscription: I): Promise<string>
    abstract withdraw(data: string, inscription: I): Promise<string>

    async getRevertBlock(latestBlock: number): Promise<number> {
        return latestBlock
    }
}