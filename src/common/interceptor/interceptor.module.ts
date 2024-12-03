import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from '../interceptor/response.interceptor';
import { AllExceptionsFilter } from '../exception/all.exceptions'
import { TimeoutInterceptor } from './timeout.interceptor';

@Module({
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TimeoutInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
    ]
})
export class InterceptorModule { }