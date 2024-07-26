import { Injectable, Logger } from '@nestjs/common';
import { Timeout } from '@nestjs/schedule';
import { OrdinalsService } from 'src/common/api/ordinals/ordinals.service';
import { CoreService } from 'src/core/core.service';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name)

    constructor(
        private readonly coreService: CoreService,
        private readonly ordinalsService: OrdinalsService
    ) { }

    @Timeout(3000)
    async handleTimeout() {
        try {
            this.logger.log('Indexing service startup')
            await this.coreService.run()
        } catch (error) {
            this.logger.error(error instanceof Error ? error.stack : error)
        }
    }
}
