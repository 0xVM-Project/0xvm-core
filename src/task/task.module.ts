import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskService } from './task.service';
import { CoreModule } from 'src/core/core.module';
import { InscribeModule } from 'src/inscribe/inscribe.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoreModule,
    InscribeModule
  ],
  providers: [TaskService]
})
export class TaskModule {}
