require('./errors');
import { Module } from '@nestjs/common';
import { BookModule } from './books/book.module';
import { SchoolAccessModule } from './school-access/school-access.module';
import { TrackModule } from './tracks/tracks.module';
import { LearningManagementController } from './learning-management.controller';
import { CourseModule } from './course/course.module';
// import { LearningSchoolController } from './learning-school.controller';
import { UnitModule } from './units/unit.module';
import { LessonModule } from './lessons/lessons.module';
import { LearningController } from './learning.controller';
import { LearningSchoolService } from './learning-school.service';
import { QuestionModule } from './questions/questions.module';
import { DailyChallengeModule } from './daily-challenge/daily-challenge.module';

@Module({
  imports: [
    // SchoolModule,
    BookModule,
    SchoolAccessModule,
    TrackModule,
    CourseModule,
    UnitModule,
    LessonModule,
    QuestionModule,
    DailyChallengeModule,
  ],
  controllers: [
    LearningManagementController,
    // LearningSchoolController,
    LearningController,
  ],
  providers: [LearningSchoolService],
  exports: [LearningSchoolService],
})
export class LearningModule {}
