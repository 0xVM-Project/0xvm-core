export interface BaseCommandsType {
    action: number
}

export interface CommandsV1Type extends BaseCommandsType {
    data: `0x${string}`
}