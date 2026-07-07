import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './entity/student-profile.entity';
import { StudentController } from './student.controller';
import { StudentProfileService } from './service/student-profile.service';
import { SchoolModule } from '../school/school.module';

require('./errors');

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile]), SchoolModule],
  controllers: [StudentController],
  exports: [StudentProfileService],
  providers: [StudentProfileService],
})
export class StudentModule {}
