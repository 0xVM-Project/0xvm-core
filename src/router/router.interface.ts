import { CommandsV1Type, ExecutionModeEnum } from "./interface/protocol.interface"

export interface IProtocol<I, C> {
    filterInscription(inscriptions: I): I | null
    decodeInscription(inscriptionContent: string): Array<C>
    syncExecuteTransaction(inscription: I): Promise<boolean>
    preExecuteTransaction(pendingTxId:number, commandList: CommandsV1Type[], logIndex:number): Promise<boolean>
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
