export interface IProtocol<I, BaseCommandsInterface, InscriptionType, T> {
    filterInscription(ordiInscriptionsContent: I): I | null
    decodeInscription(inscriptionContent: string): Array<BaseCommandsInterface>
    executeTransaction(inscription: InscriptionType): Promise<Array<string>>

    /** protocol action
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    */

    deploy(data: T, inscription: InscriptionType): Promise<string>
    execute(data: T, inscription: InscriptionType): Promise<string>
    transfer(data: T, inscription: InscriptionType): Promise<string>
    deposit(data: T, inscription: InscriptionType): Promise<string>
    withdraw(data: T, inscription: InscriptionType): Promise<string>
}
