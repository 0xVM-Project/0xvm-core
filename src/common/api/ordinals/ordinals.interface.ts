export interface  OrdiInscriptionsBlockType {
    block_count: number
    inscriptions: Array<{
        entry: {
            charms: number,
            fee: number,
            height: number,
            id: string,
            inscription_number: number,
            parents: Array<any>,
            sat: string,
            sequence_number: number,
            timestamp: number
        },
        content: string
    }>
}

export interface OrdiOutputType {
    address: string,
    indexed: boolean,
    inscriptions: Array<string>,
    runes: Array<any>,
    sat_ranges: string,
    script_pubkey: string,
    spent: boolean,
    transaction: string,
    value: number
}