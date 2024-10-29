import { Injectable, Logger } from '@nestjs/common';
import { Interval, Timeout } from '@nestjs/schedule';
import { CoreService } from 'src/core/core.service';
import { InscribeService } from 'src/inscribe/inscribe.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly coreService: CoreService,
    private readonly inscribeService: InscribeService,
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

  @Interval(10000)
  async handleInterval() {
    try {
      this.logger.log('Inscribe service startup');
      await this.inscribeService.preCommit();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : error);
    }
  }
}
