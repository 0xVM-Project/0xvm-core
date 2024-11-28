export interface BaseCommandsType {
    action: number
}

export interface CommandsV1Type extends BaseCommandsType {
    data: string
}

export enum ExecutionModeEnum {
    Normal = 'normal',
    PreExecution = 'pre-execution'
}