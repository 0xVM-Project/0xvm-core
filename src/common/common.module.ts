import { Module } from '@nestjs/common';
import { MysqlModule } from './mysql/mysql.module';
import { ConfigModule } from '@nestjs/config';
import dbMysqlConfig from 'src/config/db-mysql.config';
import defaultConfig from 'src/config/default.config';
import { InterceptorModule } from './interceptor/interceptor.module';
import { AxiosModule } from './axios/axios.module';
import { ApiModule } from './api/api.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],  // Specify the loading order
            load: [dbMysqlConfig, defaultConfig],
        }),
        AxiosModule,
        MysqlModule,
        InterceptorModule,
        ApiModule,
    ]
})
export class CommonModule { }