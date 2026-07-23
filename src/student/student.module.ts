import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './entity/student-profile.entity';
import { StudentController } from './student.controller';
import { SchoolModule } from '../school/school.module';
import { StudentService } from './student.service';

require('./errors');

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile]), SchoolModule],
  controllers: [StudentController],
  exports: [StudentService],
  providers: [StudentService],
})
export class StudentModule {}
