import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbMysqlConfig from 'src/config/db-mysql.config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [dbMysqlConfig.KEY],
            useFactory: async (config: ConfigType<typeof dbMysqlConfig>) => {
                return {
                    type: 'mysql',
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    password: config.password,
                    database: config.database,
                    entities: config.entities,
                    synchronize: config.synchronize,
                    timezone: config.timezone
                }
            },
        }),
    ]
})
export class MysqlModule { }
