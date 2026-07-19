import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedQuestion } from './entity/saved-question.entity';
import { SavedQuestionService } from './saved-question.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedQuestion])],
  providers: [SavedQuestionService],
  exports: [SavedQuestionService],
})
export class SavedQuestionModule {}
