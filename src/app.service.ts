import { Injectable } from '@nestjs/common';
import { CoreService } from './core/core.service';

@Injectable()
export class AppService {
  constructor(private readonly coreService: CoreService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async preExecute(): Promise<boolean> {
    return await this.coreService.preExecution();
  }
}
