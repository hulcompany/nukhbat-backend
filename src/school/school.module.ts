// require('./school.policy');
require('./school-errors');
import { Module } from '@nestjs/common';
import { SchoolManageController } from './school.manage.controller';
import { SchoolService } from './school.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entity/school.entity';
import { LearningModule } from '../learning/learning.module';
import { SchoolController } from './school.controller';

@Module({
  imports: [TypeOrmModule.forFeature([School]), LearningModule],
  controllers: [SchoolController, SchoolManageController],
  exports: [SchoolService],
  providers: [SchoolService],
})
export class SchoolModule {}
