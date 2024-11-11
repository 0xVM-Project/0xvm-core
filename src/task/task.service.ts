import { Injectable, Logger } from '@nestjs/common';
import { Interval, SchedulerRegistry, Timeout } from '@nestjs/schedule';
import { CoreService } from 'src/core/core.service';
import { InscribeService } from 'src/inscribe/inscribe.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly coreService: CoreService,
    private readonly inscribeService: InscribeService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Timeout(3000)
  async handleTimeout() {
    try {
      this.logger.log('Indexing service startup');
      await this.coreService.run();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }

  @Interval('pre-execute', 5000)
  async handleExecute() {
    try {
      if (this.coreService.isExecutionTaskStop) {
        const interval = this.schedulerRegistry.getInterval('pre-execute');
        clearInterval(interval);
      } else {
        this.logger.log('Execute service start');
        await this.coreService.execution();
        this.logger.log('Execute service end');
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }

  @Interval(10000)
  async handleInscribe() {
    try {
      this.logger.log('Inscribe service start');
      await this.inscribeService.run();
      this.logger.log('Inscribe service end');
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }
}
