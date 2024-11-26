import { Injectable, Logger } from '@nestjs/common';
import { Interval, SchedulerRegistry, Timeout } from '@nestjs/schedule';
import { CoreService } from 'src/core/core.service';
import { InscribeService } from 'src/inscribe/inscribe.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  private isInscribeRunning: boolean;

  constructor(
    private readonly coreService: CoreService,
    private readonly inscribeService: InscribeService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    this.isInscribeRunning = false;
  }

  @Timeout(3000)
  async handleTimeout() {
    try {
      this.logger.log('Indexing service startup');
      await this.coreService.run();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }

  @Interval('pre-execute', 10000)
  async handleExecute() {
    try {
      if (this.coreService.isExecutionTaskStop) {
        const interval = this.schedulerRegistry.getInterval('pre-execute');
        clearInterval(interval);
      } else {
        await this.coreService.chunkMQ();
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }

  @Interval(10000)
  async handleInscribe() {
    try {
      if (!this.isInscribeRunning) {
        this.isInscribeRunning = true;
        await this.coreService.prePackage();
        await this.inscribeService.run();
        this.isInscribeRunning = false;
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
      this.isInscribeRunning = false;
    }
  }
}
