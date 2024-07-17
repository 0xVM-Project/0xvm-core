import { ethers } from "ethers";

export async function signAddressMapping(privateKey: string, xvmAddress: string, btcAddress: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKey)
    const prefix = "\x19Ethereum Signed Message:\n32";
    const message = `${prefix}${xvmAddress}:${btcAddress}`
    return await wallet.signMessage(message)
}

export async function verifySignature(message: string, signMessage: string): Promise<string> {
    const prefix = "\x19Ethereum Signed Message:\n32";
    return ethers.verifyMessage(prefix + message, signMessage)
}

// (async () => {
//     const xvmAddress = '0xb4ef6A8086F817fF8990Cc3CadC511A428D6057e'
//     const btcAddress = 'tb1pq2w35seuhfrrvlaru922yujstmhmuvs4h0ethfe805wxrd9fr9tq7hjmqt'
//     const message = `${xvmAddress}:${btcAddress}`
//     const privateKey = 'd9701e6db2ad8612d0d766789bf610951fcc4a928c320172aaa779268439ae72'
//     const wallet = new ethers.Wallet(privateKey)
//     const signMessage = await wallet.signMessage(message)
//     console.log(signMessage)
//     const recoverAddress = ethers.verifyMessage(message, signMessage)
//     console.log(recoverAddress)

// })()
