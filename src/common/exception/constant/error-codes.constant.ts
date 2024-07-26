export const ErrorCodes = {
    WITHDRAW_REQUEST_ERROR: { code: 9000, message: 'Withdrawal request already exists' },
    HASH_MAPPING_ERROR: { code: 9001, message: 'Hash Mapping btcHash or xvmHash already exists' },
} as const