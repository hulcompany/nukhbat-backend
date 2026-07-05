import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unit } from './entity/unit.entity';
import { UnitService } from './unit.service';
import { QuestionModule } from '../questions/questions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Unit]), QuestionModule],
  providers: [UnitService],
  exports: [UnitService],
})
export class UnitModule {}
