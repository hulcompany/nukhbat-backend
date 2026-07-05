import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyChallengeService } from './daily-challenge.service';
import { DailyChallenge } from './entity/daily-challenge.entity';
import { DailyChallengeUsedQuestions } from './entity/daily-challenge-used-questions.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyChallenge, DailyChallengeUsedQuestions]),
  ],
  providers: [DailyChallengeService],
  exports: [DailyChallengeService],
})
export class DailyChallengeModule {}
