require('./errors');
import { Module } from '@nestjs/common';
import { SchoolAccessModule } from '../school-access/school-access.module';
import { TrackModule } from './tracks/tracks.module';
import { CourseModule } from './course/course.module';
import { UnitModule } from './units/unit.module';
import { LessonModule } from './lessons/lessons.module';
import { QuestionModule } from './questions/questions.module';
import { DailyChallengeModule } from './daily-challenge/daily-challenge.module';
import { SchoolModule } from '../school/school.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CurriculumManagementController } from './controllers/curriculum-management.controller';
import { CurriculumSchoolController } from './controllers/curriculum-school.controller';
import { CurriculumController } from './controllers/curriculum.controller';
import { CurriculumService } from './services/curriculum.service';
import { CurriculumSchoolService } from './services/curriculum-school.service';

@Module({
  imports: [
    SchoolModule,
    // StudentModule powers StudentGuard on the student learning routes.
    // SubscriptionModule is deliberately NOT imported here — it imports
    // LearningModule, so it would close a cycle. Subscription-gating lives
    // on the solve routes instead.
    SubscriptionModule,
    SchoolAccessModule,
    TrackModule,
    CourseModule,
    UnitModule,
    LessonModule,
    QuestionModule,
    DailyChallengeModule,
  ],
  controllers: [
    CurriculumManagementController,
    CurriculumSchoolController,
    CurriculumController,
  ],
  providers: [CurriculumService, CurriculumSchoolService],
  exports: [CurriculumService, CurriculumSchoolService],
})
export class CurriculumModule {}
