export interface IProtocol<I, C> {
    filterInscription(inscriptions: I): I | null
    decodeInscription(inscriptionContent: string): Array<C>
    executeTransaction(inscription: I, type?:string): Promise<Array<string>>
    encodeInscription(inscriptionArray: Array<C>): string | null

    /** protocol action
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    */

    deploy(data: string, inscription: I): Promise<string | null>
    execute(data: string, inscription: I): Promise<string | null>
    transfer(data: string, inscription: I): Promise<string | null>
    deposit(data: string, inscription: I): Promise<string | null>
    withdraw(data: string, inscription: I): Promise<string | null>
    prev(data: string, inscription: I): Promise<string | null>
    mineBlock(data: string): Promise<string | null>
    isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string }
}
