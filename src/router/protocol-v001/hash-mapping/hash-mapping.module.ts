import { Module } from '@nestjs/common';
import { HashMappingService } from './hash-mapping.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HashMapping]),
  ],
  providers: [HashMappingService],
  exports: [HashMappingService]
})
export class HashMappingModule { }
