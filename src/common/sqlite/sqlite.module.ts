import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            name: 'sqlite',
            type: 'sqlite',
            database: 'db/indexer.sqlite', // SQLite Database File Name
            entities: [BtcHistoryTx], // Introduce your entity here
            synchronize: true, // Automatic synchronisation of database structures for use in development environments
        }),
        TypeOrmModule.forFeature([BtcHistoryTx], 'sqlite')
    ],
    exports: [TypeOrmModule]
})
export class SqliteModule { }
