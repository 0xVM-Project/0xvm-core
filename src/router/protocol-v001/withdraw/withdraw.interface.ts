export interface IWithdraw {
    fromAddress: string
    toAddress: string
    amount: string
    evmHash: string
    status: number
}

export interface AddressMapping {
    code: number,
    data: {
        xvmAddress: string,
        btcAddress: string
    },
    errorMessage: string
}