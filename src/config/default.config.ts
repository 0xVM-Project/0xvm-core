import { registerAs } from '@nestjs/config'
import { removeTrailingSlash } from 'src/utils/http'

export default registerAs('defalut', () => ({
    port: parseInt(process.env.NEST_APP_PORT ?? '3000'),
    isEnableDebug: process.env.IS_ENABLE_DEBUG,
    xvm: {
        xvmRpcUrl: removeTrailingSlash(process.env.XVM_RPC_URL ?? ''),
        xvmNetwork: process.env.XVM_NETWORK ?? 'mainnet',
        xvmChainId: parseInt(process.env.XVM_CHAIN_ID ?? '42', 10),
        firstInscriptionBlockHeight: parseInt(process.env.FIRST_INSCRIPTION_BLOCK_HEIGHT ?? '0', 10),
        sysPrivateKey: process.env.SYS_PRIVATE_KEY ?? '',
        sysBtcAddress: process.env.SYS_BTC_ADDRESS ?? '',
        sysXvmAddress: process.env.SYS_XVM_ADDRESS ?? '',
        operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY ?? '',
        xbtcPoolAddress: process.env.XBTC_POOL_ADDRESS ?? '',
    },
    bitcoind: {
        bitcoinRpcUrl: removeTrailingSlash(process.env.BITCOIN_RPC_URL ?? ''),
        bitcoinRpcUser: process.env.BITCOIN_RPC_USER ?? 'user',
        bitcoinRpcPassword: process.env.BITCOIN_RPC_PASSWORD ?? 'password',
        confirmBlockHeight: parseInt(process.env.CONFIRM_BLOCK_HEIGHT ?? '0', 10),
    },
    ordinals: {
        ordUrl: removeTrailingSlash(process.env.ORD_URL ?? '')
    },
    wallet: {
        fundingAddress: process.env.FUNDING_ADDRESS ?? '',
        walletApiUrl: removeTrailingSlash(process.env.WALLET_API_URL ?? ''),
        btcFeeRate: process.env.BTC_FEE_RATE ? Number(process.env.BTC_FEE_RATE) : 50,
        InscribeMaxSize: process.env.INSCRIBE_MAX_SIZE ? Number(process.env.INSCRIBE_MAX_SIZE) : 1000000
    }
}))
