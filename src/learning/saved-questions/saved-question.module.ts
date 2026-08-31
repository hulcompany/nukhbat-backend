import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionModule } from '../../subscription/subscription.module';
import { SavedQuestion } from './entity/saved-question.entity';
import { SavedQuestionController } from './saved-question.controller';
import { SavedQuestionService } from './saved-question.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedQuestion]), SubscriptionModule],
  providers: [SavedQuestionService],
  exports: [SavedQuestionService],
  controllers: [SavedQuestionController],
})
export class SavedQuestionModule {}
