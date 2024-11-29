import { ExecutionModeEnum } from "./interface/protocol.interface"

export interface IProtocol<I, C> {
    filterInscription(inscriptions: I): I | null
    decodeInscription(inscriptionContent: string): Array<C>
    executeTransaction(inscription: I, executionMode?: ExecutionModeEnum): Promise<Array<string>>
    encodeInscription(inscriptionArray: Array<C>): string | null

    /** protocol action
    **  deploy = 1,
    **  execute = 2,
    **  transfer = 3,
    **  deposit = 4,
    **  withdraw = 5
    */

    deploy(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    execute(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    transfer(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    deposit(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    withdraw(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    prev(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    mineBlock(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string }
}
