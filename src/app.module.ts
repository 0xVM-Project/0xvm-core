import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbMysqlConfig from './config/db-mysql.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PipesModule } from './common/pipes/pipes.module';
import { ToolsModule } from './tools/tools.module';
import { TransactionModule } from './transaction/transaction.module';
import { InscriptionModule } from './inscription/inscription.module';

@Module({
  imports: [
    CommonModule,
    PipesModule,
    ToolsModule,
    TransactionModule,
    InscriptionModule,
  ],
  controllers: [AppController,],
  providers: [
    AppService,
  ],
})
export class AppModule { }
