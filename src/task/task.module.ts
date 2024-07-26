import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskService } from './task.service';
import { CoreModule } from 'src/core/core.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoreModule
  ],
  providers: [TaskService]
})
export class TaskModule {}
