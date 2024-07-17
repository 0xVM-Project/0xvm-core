import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './interceptor/response.interceptor';
import { AllExceptionsFilter } from './exception/all.exceptions'
import { MysqlModule } from './mysql/mysql.module';
import { ConfigModule } from '@nestjs/config';
import dbMysqlConfig from 'src/config/db-mysql.config';
import defaultConfig from 'src/config/default.config';
import { InterceptorModule } from './interceptor/interceptor.module';

@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env.local', '.env'],  // Specify the loading order
        load: [dbMysqlConfig, defaultConfig],
    }),
        MysqlModule,
        InterceptorModule,
    ]
})
export class CommonModule { }