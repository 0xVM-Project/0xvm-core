export interface XvmRpcBaseResponse<T = string> {
    jsonrpc: string,
    result: T
    id: number
}

export interface Block {
    author: string,
    baseFeePerGas: string,
    difficulty: string,
    extraData: string,
    gasLimit: string,
    gasUsed: string,
    hash: string,
    logsBloom: string,
    miner: string,
    nonce: string,
    number: string,
    parentHash: string,
    receiptsRoot: string,
    sha3Uncles: string,
    size: string,
    stateRoot: string,
    timestamp: string,
    totalDifficulty: string,
    transactions: any[],
    transactionsRoot: string,
    uncles: any[]
}

export interface XvmRpcGetBlockByNumber extends XvmRpcBaseResponse<Block> {
    result: Block
}

export interface EngineCreateBlock {
    hash: string,
    aux: {
        header_only: boolean,
        clear_justification_requests: boolean,
        needs_justification: boolean,
        bad_justification: boolean,
        is_new_best: boolean
    },
    proof_size: number
}

export interface XvmRpcEngineCreateBlockResponse extends XvmRpcBaseResponse<EngineCreateBlock> {
    result: EngineCreateBlock
}

// evm_mine_block
export interface EvmMineBlockResponse extends XvmRpcBaseResponse<string> {
    result: string
}

// evm_revert_block
export interface EvmRevertBlockResponse extends XvmRpcBaseResponse<boolean> {
    result: boolean
}