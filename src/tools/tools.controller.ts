import { Controller, Get } from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
    constructor(private readonly toolService: ToolsService) { }

    @Get('fetch_timestamp')
    create() {
        return this.toolService.fetchTimestamp();
    }
}
