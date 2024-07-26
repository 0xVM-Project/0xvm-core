export interface BtcBlockchainInfo {
    result: {
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
    },
    error: string,
    id: string,
}