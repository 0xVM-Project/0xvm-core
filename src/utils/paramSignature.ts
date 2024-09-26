import { Wallet, ethers } from 'ethers';

export async function releaseParamSignature(receiveAddress: string, amount: ethers.BigNumberish, signerWithAccount?: Wallet) {
    const packed = ethers.solidityPacked(['address', 'uint256'], [receiveAddress, amount])
    const keccak256Hash = ethers.keccak256(packed);
    const paramsHashBytes = ethers.toBeArray(keccak256Hash)
    return await signerWithAccount.signMessage(paramsHashBytes)
}