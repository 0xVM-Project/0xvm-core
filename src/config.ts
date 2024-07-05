import { config } from "dotenv";
config();

export const vmRpcUrl = process.env?.VM_RPC_URL ?? "";
export const bitcoinRpcUrl = process.env?.BITCOIN_RPC_URL ?? "";
export const bitcoinRpcUser = process.env?.BITCOIN_RPC_USER ?? "";
export const bitcoinRpcPassword = process.env?.BITCOIN_RPC_PASSWORD ?? "";
export const ordUrl = process.env?.ORD_URL ?? "";
export const network = process.env?.NETWORK ?? "";
export const chainId = process.env?.CHAIN_ID
  ? Number(process.env?.CHAIN_ID)
  : 42;
export const databasePath = process.env?.DB_PATH ?? "";
export const btcAddress = process.env?.BTC_ADDRESS ?? "";
export const tokenAddress = process.env?.TOKEN_ADDRESS ?? "";
export const sendTokenPrivateKey = process.env?.SEND_TOKEN_PRIVATE_KEY ?? "";
export const databaseHost = process.env?.DATABASE_HOST ?? "";
export const databaseUser = process.env?.DATABASE_USER ?? "";
export const databasePassword = process.env?.DATABASE_PASSWORD ?? "";
export const databaseName = process.env?.DATABASE_NAME ?? "";
export const latestBlock = process.env?.LATEST_BLOCK
  ? Number(process.env?.LATEST_BLOCK)
  : 2865304;
export const latestTimestamp = process.env?.LATEST_TIMESTAMP
  ? Number(process.env?.LATEST_TIMESTAMP)
  : Math.floor(Date.now() / 1000);
export const inscriptionLabel = "0f0";
export const inscriptionVersion = "001";
export const inscriptionAccuracy = 1e10;
export const walletAccountUrl = process.env?.WALLET_ACCOUNT_URL ?? "";
