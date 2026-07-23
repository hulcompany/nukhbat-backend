import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedQuestion } from './entity/saved-question.entity';
import { SavedQuestionService } from './saved-question.service';
import { SavedQuestionController } from './saved-question.controller';
import { SubscriptionModule } from '../../subscription/subscription.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedQuestion]), SubscriptionModule],
  providers: [SavedQuestionService],
  exports: [SavedQuestionService],
  controllers: [SavedQuestionController],
})
export class SavedQuestionModule {}
