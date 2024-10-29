import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InscribeItem } from 'src/entities/inscribe.entity';
import { InscribeService } from './inscribe.service';

@Module({
  imports: [TypeOrmModule.forFeature([InscribeItem])],
  providers: [InscribeService],
  exports: [InscribeService],
})
export class InscribeModule {}
