import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { QuestionAttempt } from './entity/question-attempt.entity';
import { SolvedDailyChallenges } from './entity/solved-daily-challenges.entity';
import { SolvingService } from './solving.service';
import { SnapshotsService } from './snapshots.service';
import { SolveLessonsService } from './solve-lessons.service';
import { SolvingSchoolController } from './solving-school.controller';
import { SolvingStudentController } from './solving-student.controller';
import { CurriculumModule } from '../../curriculum/curriculum.module';
import { LedgerModule } from '../ledger/ledger.module';
import { StudentModule } from '../../student/student.module';
import { SchoolModule } from '../../school/school.module';
import { SubscriptionModule } from '../../subscription/subscription.module';
// import { SchoolAccessModule } from '../../school-access/school-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonAttempt,
      QuestionAttempt,
      SolvedDailyChallenges,
    ]),
    // CurriculumService (lesson/question reads, grading), LedgerService
    // (rewards), StudentService (profile balance). SubscriptionModule powers
    // the SubscriptionGuard on the student controller; SchoolModule powers the
    // SchoolOwnerGuard on the school controller; SchoolAccessModule backs the
    // track-access reads in SolvingService.
    CurriculumModule,
    StudentModule,
    SchoolModule,
    SubscriptionModule,
    // SchoolAccessModule,
    LedgerModule,
  ],
  providers: [SolvingService, SnapshotsService, SolveLessonsService],
  controllers: [SolvingSchoolController, SolvingStudentController],
  exports: [SolvingService],
})
export class SolvingModule {}
