import { Module } from '@nestjs/common';
import { LearningCurriculumService } from './learning-curriculum.service';
import { LearningCurriculumController } from './learning-curriculum.controller';
import { StudentModule } from '../../student/student.module';
import { SubscriptionModule } from '../../subscription/subscription.module';

@Module({
  // LearningCurriculumService builds the tree with a single raw SQL query via
  // the injected DataSource. SubscriptionModule powers the SubscriptionGuard on
  // the student controller (StudentModule kept explicit for the student context).
  imports: [StudentModule, SubscriptionModule],
  controllers: [LearningCurriculumController],
  providers: [LearningCurriculumService],
})
export class LearningCurriculumModule {}
