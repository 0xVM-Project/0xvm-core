import { HttpException, HttpStatus } from '@nestjs/common';

export class BaseCustomException extends HttpException {
  constructor(message: string, code: number, status: HttpStatus) {
    super({ code, message, errorMessage: message, data: {} }, status);
  }
}