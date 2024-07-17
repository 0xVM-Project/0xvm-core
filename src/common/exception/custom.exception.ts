import { HttpStatus } from '@nestjs/common';
import { BaseCustomException } from './base-custom.exception';
import { ErrorCodes } from './constant/error-codes.constant';

export class WithdrawRequestException extends BaseCustomException {
    constructor(message: string = ErrorCodes.WITHDRAW_REQUEST_ERROR.message) {
        super(message, ErrorCodes.WITHDRAW_REQUEST_ERROR.code, HttpStatus.OK);
    }
}

// todo: Other specific exception classes...
