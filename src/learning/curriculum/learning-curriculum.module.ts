import { Module } from '@nestjs/common';
import { LearningCurriculumService } from './learning-curriculum.service';
import { LearningCurriculumController } from './learning-curriculum.controller';
import { CurriculumModule } from '../../curriculum/curriculum.module';
import { StudentModule } from '../../student/student.module';
import { SubscriptionModule } from '../../subscription/subscription.module';

@Module({
  // CurriculumModule powers LearningCurriculumService's reads; SubscriptionModule
  // powers the SubscriptionGuard on the student controller (StudentModule comes
  // along via SubscriptionModule's re-export, kept explicit for clarity).
  imports: [CurriculumModule, StudentModule, SubscriptionModule],
  controllers: [LearningCurriculumController],
  providers: [LearningCurriculumService],
})
export class LearningCurriculumModule {}
