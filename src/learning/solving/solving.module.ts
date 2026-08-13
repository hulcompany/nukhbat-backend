import { Module } from '@nestjs/common';
import { CurriculumModule } from '../../curriculum/curriculum.module';
import { StudentModule } from '../../student/student.module';
import { SubscriptionModule } from '../../subscription/subscription.module';
import { AttemptsModule } from '../attempts/attempts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { SavedQuestionModule } from '../saved-questions/saved-question.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { SolvingController } from './solving.controller';
import { SolvingDailyChallengeService } from './solving-daily-challenge.service';
import { SolvingLessonsService } from './solving-lessons.service';

@Module({
  imports: [
    CurriculumModule,
    StudentModule,
    SubscriptionModule,
    AttemptsModule,
    LedgerModule,
    SavedQuestionModule,
    SnapshotsModule,
  ],
  controllers: [SolvingController],
  providers: [SolvingLessonsService, SolvingDailyChallengeService],
})
export class SolvingModule {}
