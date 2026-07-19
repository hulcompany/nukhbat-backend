import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entity/course.entity';
import { CourseService } from './course.service';
import { SchoolAccessModule } from '../../school-access/school-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Course]), SchoolAccessModule],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
