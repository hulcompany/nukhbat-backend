import { Module } from '@nestjs/common';
import { SavedQuestionModule } from './saved-questions/saved-question.module';
import { LearningCurriculumModule } from './curriculum/learning-curriculum.module';
import { SolvingModule } from './solving/solving.module';
// import { LedgerModule } from './ledger/ledger.module';
import { StudentModule } from '../student/student.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    SavedQuestionModule,
    SolvingModule,
    // LedgerModule,
    StudentModule,
    SubscriptionModule,
    LearningCurriculumModule,
  ],
  //   providers: [SavedQuestionService],
  //   exports: [SavedQuestionService],
  //   controllers: [SavedQuestionController],
})
export class LearningModule {}
