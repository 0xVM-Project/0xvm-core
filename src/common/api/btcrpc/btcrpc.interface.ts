export interface BtcBaseResponse<T> {
    result: T
    error: string
    id: string
}
interface BlockchainInfo {
    chain: string,
    blocks: number,
    headers: number,
    bestblockhash: string,
    difficulty: number,
    time: number,
    mediantime: number,
    verificationprogress: number,
    initialblockdownload: boolean,
    chainwork: string,
    size_on_disk: number,
    pruned: false,
    warnings: string,
}

export interface BlockchainInfoResponse extends BtcBaseResponse<BlockchainInfo> {
    result: BlockchainInfo
}

export interface TxInput {
    coinbase: string,
    txinwitness: Array<string>,
    sequence: number
}

export interface TxOutput {
    value: number,
    n: number,
    scriptPubKey: {
        asm: string,
        desc: string,
        hex: string,
        address: string,
        type: string
    }
}

export interface Transaction {
    txid: string,
    hash: string,
    version: number,
    size: number,
    vsize: number,
    weight: number,
    locktime: number,
    vin: Array<TxInput>,
    vout: Array<TxOutput>,
    hex: string,
    blockhash: string,
    confirmations: number,
    time: number,
    blocktime: number
}

interface Block {
    hash: string,
    confirmations: number,
    height: number,
    version: number,
    versionHex: string,
    merkleroot: string,
    time: number,
    mediantime: number,
    nonce: number,
    bits: string,
    difficulty: number,
    chainwork: string,
    nTx: number,
    previousblockhash: string,
    nextblockhash: string,
    strippedsize: number,
    size: number,
    weight: number,
    tx: Array<{
        txid: string,
        hash: string,
        version: number,
        size: number,
        vsize: number,
        weight: number,
        locktime: number,
        vin: Array<TxInput>,
        vout: Array<TxOutput>,
        hex: string
    }>
}

export interface BlockResponse extends BtcBaseResponse<Block> {
    result: Block
}

export interface RawTransactionResponse extends BtcBaseResponse<Transaction> {
    result: Transaction
}

export interface BlockHeader {
    hash: string,
    confirmations: number,
    height: number,
    version: number,
    versionHex: string,
    merkleroot: string,
    time: number,
    mediantime: number,
    nonce: number,
    bits: string,
    difficulty: number,
    chainwork: string,
    nTx: number,
    previousblockhash: string,
    nextblockhash: string
}

export interface BlockHeaderResponse extends BtcBaseResponse<BlockHeader> {
    result: BlockHeader
}