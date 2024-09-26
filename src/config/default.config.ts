import { registerAs } from '@nestjs/config'
import { removeTrailingSlash } from 'src/utils/http'

export default registerAs('defalut', () => ({
    port: process.env.NEST_APP_PORT,
    xvm: {
        xvmRpcUrl: removeTrailingSlash(process.env.XVM_RPC_URL),
        xvmNetwork: process.env.XVM_NETWORK,
        xvmChainId: parseInt(process.env.XVM_CHAIN_ID, 10) || 42,
        firstInscriptionBlockHeight: parseInt(process.env.FIRST_INSCRIPTION_BLOCK_HEIGHT, 10) || 0,
        sysPrivateKey: process.env.SYS_PRIVATE_KEY,
        sysBtcAddress: process.env.SYS_BTC_ADDRESS,
        sysXvmAddress: process.env.SYS_XVM_ADDRESS,
        operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY,
        xbtcPoolAddress: process.env.XBTC_POOL_ADDRESS,
    },
    bitcoind: {
        bitcoinRpcUrl: removeTrailingSlash(process.env.BITCOIN_RPC_URL),
        bitcoinRpcUser: process.env.BITCOIN_RPC_USER,
        bitcoinRpcPassword: process.env.BITCOIN_RPC_PASSWORD,
        confirmBlockHeight: parseInt(process.env.CONFIRM_BLOCK_HEIGHT, 10) || 0,
    },
    ordinals: {
        ordUrl: removeTrailingSlash(process.env.ORD_URL)
    },
    wallet: {
        walletApiUrl: removeTrailingSlash(process.env.WALLET_API_URL)
    }
}))
