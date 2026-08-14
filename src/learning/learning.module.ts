import { Module } from '@nestjs/common';
import { SavedQuestionModule } from './saved-questions/saved-question.module';
import { LearningCurriculumModule } from './curriculum/learning-curriculum.module';
import { SolvingModule } from './solving/solving.module';
import { AttemptsModule } from './attempts/attempts.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    SavedQuestionModule,
    SolvingModule,
    LearningCurriculumModule,
    AttemptsModule,
    LeaderboardModule
  ],
})
export class LearningModule {}
