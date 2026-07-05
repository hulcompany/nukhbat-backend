import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolAccess } from './entity/school-access.entity';
import { Track } from '../tracks/entity/track.entity';
import { Course } from '../course/entity/course.entity';
import { Unit } from '../units/entity/unit.entity';
import { SchoolAccessService } from './school-access.service';
import { Lesson } from '../lessons/entity/lesson.entity';
import { Question } from '../questions/entity/questions.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolAccess,
      Track,
      Course,
      Unit,
      Lesson,
      Question,
    ]),
  ],
  exports: [SchoolAccessService],
  providers: [SchoolAccessService],
})
export class SchoolAccessModule {}
