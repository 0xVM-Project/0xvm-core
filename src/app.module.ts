import { Inject, Logger, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PipesModule } from './common/pipes/pipes.module';
import defaultConfig from './config/default.config';
import { CoreModule } from './core/core.module';
import { IndexerModule } from './indexer/indexer.module';
import { InscribeModule } from './inscribe/inscribe.module';
import { OrdModule } from './ord/ord.module';
import { PreExecutionModule } from './pre-execution/pre-execution.module';
import { TaskModule } from './task/task.module';
import { ToolsModule } from './tools/tools.module';
import { XvmModule } from './xvm/xvm.module';

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
    PreExecutionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
  ) {
    // Output memory usage every 30 seconds
    if (this.defaultConf.memoryMonitorEnable) {
      setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryUsageInMB = {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`, // Resident memory set
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`, // Total heap memory
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`, // Used heap memory
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`, // External Memory
          arrayBuffers: `${(memoryUsage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`, // ArrayBuffer Memory
        };
        this.logger.debug(
          `Memory usage (in MB): ${JSON.stringify(memoryUsageInMB, null, 2)}`,
        );
      }, 30000);
    }
  }
}
