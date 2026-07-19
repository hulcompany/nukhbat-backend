require('./errors');
import { Module } from '@nestjs/common';
import { BookModule } from './books/book.module';
import { SchoolAccessModule } from '../school-access/school-access.module';
import { TrackModule } from './tracks/tracks.module';
import { LearningManagementController } from './learning-management.controller';
import { CourseModule } from './course/course.module';
import { LearningSchoolController } from './learning-school.controller';
import { UnitModule } from './units/unit.module';
import { LessonModule } from './lessons/lessons.module';
import { LearningController } from './learning.controller';
import { LearningSchoolService } from './learning-school.service';
import { QuestionModule } from './questions/questions.module';
import { DailyChallengeModule } from './daily-challenge/daily-challenge.module';
import { LearningService } from './learning.service';
import { SchoolModule } from '../school/school.module';
import { StudentModule } from '../student/student.module';
import { SavedQuestionModule } from './saved-questions/saved-question.module';
import { LearningStudentController } from './learning-student.controller';
import { LearningStudentService } from './learning-student.service';

@Module({
  imports: [
    SchoolModule,
    // StudentModule powers StudentGuard on the student learning routes.
    // SubscriptionModule is deliberately NOT imported here — it imports
    // LearningModule, so it would close a cycle. Subscription-gating lives
    // on the solve routes instead.
    StudentModule,
    BookModule,
    SchoolAccessModule,
    TrackModule,
    CourseModule,
    UnitModule,
    LessonModule,
    QuestionModule,
    DailyChallengeModule,
    SavedQuestionModule,
  ],
  controllers: [
    LearningManagementController,
    LearningSchoolController,
    LearningStudentController,
    LearningController,
  ],
  providers: [LearningSchoolService, LearningService, LearningStudentService],
  exports: [LearningSchoolService, LearningService, LearningStudentService],
})
export class LearningModule {}
