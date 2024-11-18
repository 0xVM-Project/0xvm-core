import { IProtocol } from "../router.interface";

export abstract class ProtocolBase<I, C> implements IProtocol<I, C> {
    abstract filterInscription(inscription: I): I | null
    abstract decodeInscription(inscriptionContent: string): Array<C>
    abstract encodeInscription(inscriptionArray: Array<C>): string | null
    abstract executeTransaction(inscription: I): Promise<Array<string>>
    abstract prev(data: string, inscription: I): Promise<string | null>
    abstract mineBlock(data: string): Promise<string | null>
    abstract deploy(data: string, inscription: I): Promise<string | null>
    abstract execute(data: string, inscription: I): Promise<string | null>
    abstract transfer(data: string, inscription: I): Promise<string | null>
    abstract deposit(data: string, inscription: I): Promise<string | null>
    abstract withdraw(data: string, inscription: I): Promise<string | null>
    abstract isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string }

    async getRevertBlock(latestBlock: number): Promise<number> {
        return latestBlock
    }
}