export interface IProtocol<I, C> {
    filterInscription(ordiInscriptionsContent: I): I | null
    decodeInscription(inscriptionContent: string): Array<C>
    executeTransaction(inscription: I): Promise<Array<string>>
    encodeInscription(inscriptionArray: Array<C>): string

    /** protocol action
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    */

    deploy(data: string, inscription: I): Promise<string>
    execute(data: string, inscription: I): Promise<string>
    transfer(data: string, inscription: I): Promise<string>
    deposit(data: string, inscription: I): Promise<string>
    withdraw(data: string, inscription: I): Promise<string>
    prev(data: string, inscription: I): Promise<string>
    mineBlock(data: string, inscription: I): Promise<string>
    isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string }
}
