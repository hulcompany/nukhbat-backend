import { Module } from '@nestjs/common';
import { SavedQuestionModule } from './saved-questions/saved-question.module';
import { LearningCurriculumModule } from './curriculum/learning-curriculum.module';
import { SolvingModule } from './solving/solving.module';

@Module({
  imports: [
    SavedQuestionModule,
    SolvingModule,
    LearningCurriculumModule,
  ],
})
export class LearningModule {}
