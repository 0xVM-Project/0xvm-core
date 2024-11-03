import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { PreExecutionService } from './pre-execution.service';

@Module({
  imports: [RouterModule],
  providers: [PreExecutionService],
  exports: [PreExecutionService],
})
export class PreExecutionModule {}
