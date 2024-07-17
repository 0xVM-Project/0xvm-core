import { Injectable } from '@nestjs/common';

@Injectable()
export class ToolsService {
    fetchTimestamp(): { t: number, timestamp: number } {
        const t = Date.now()
        return {
            t: t,
            timestamp: Math.floor(t / 1000)
        }
    }
}
