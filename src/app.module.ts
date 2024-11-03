import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbMysqlConfig from './config/db-mysql.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PipesModule } from './common/pipes/pipes.module';
import { ToolsModule } from './tools/tools.module';
import { IndexerModule } from './indexer/indexer.module';
import { XvmModule } from './xvm/xvm.module';
import { CoreModule } from './core/core.module';
import { TaskModule } from './task/task.module';
import { OrdModule } from './ord/ord.module';
import { InscribeModule } from './inscribe/inscribe.module';
import { PreExecutionModule } from './pre-execution/pre-execution.module';

@Module({
  imports: [
    CommonModule,
    PipesModule,
    ToolsModule,
    IndexerModule,
    XvmModule,
    CoreModule,
    TaskModule,
    OrdModule,
    InscribeModule,
    PreExecutionModule
  ],
  controllers: [AppController,],
  providers: [
    AppService,
  ],
})
export class AppModule { }
