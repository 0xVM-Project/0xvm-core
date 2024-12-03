import { CommandsV1Type, ExecutionModeEnum } from "../interface/protocol.interface";
import { IProtocol } from "../router.interface";

export abstract class ProtocolBase<I, C> implements IProtocol<I, C> {
    abstract filterInscription(inscription: I): I | null
    abstract decodeInscription(inscriptionContent: string): Array<C>
    abstract encodeInscription(inscriptionArray: Array<C>): string | null
    abstract syncExecuteTransaction(inscription: I): Promise<Array<string>>
    abstract preExecuteTransaction(pendingTxId:number, commandList: CommandsV1Type[], logIndex:number): Promise<boolean>
    abstract prev(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract mineBlock(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract deploy(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract execute(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract transfer(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract deposit(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract withdraw(data: string, inscriptionHash: string, executionMode: ExecutionModeEnum): Promise<string | null>
    abstract isPrecomputeInscription(inscriptionContent: string): { isPrecompute: boolean, mineTimestamp: number, prevHash: string }

    async getRevertBlock(latestBlock: number): Promise<number> {
        return latestBlock
    }
}