import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionKey } from './entity/subscription-key.entity';
import { SubscriptionKeyService } from './service/subscription-key.service';
import { SubscriptionService } from './service/subscription.service';
import { SubscriptionController } from './subscription.controller';
import { StudentModule } from '../student/student.module';
import { SchoolModule } from '../school/school.module';
import { LearningModule } from '../learning/learning.module';

require('./errors');

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionKey]),
    // StudentProfileService for subscribe; SchoolService for SchoolOwnerGuard
    StudentModule,
    SchoolModule,
    LearningModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionKeyService, SubscriptionService],
  exports: [SubscriptionKeyService],
})
export class SubscriptionModule {}
