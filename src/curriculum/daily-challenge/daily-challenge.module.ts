import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyChallengeService } from './daily-challenge.service';
import { DailyChallenge } from './entity/daily-challenge.entity';
import { DailyChallengeUsedQuestions } from './entity/daily-challenge-used-questions.entity';
import { StudentModule } from '../../student/student.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyChallenge, DailyChallengeUsedQuestions]),
    // resolves the enrolled-student audience when a challenge is created, so we
    // can raise the daily-report notification event for that track
    StudentModule,
  ],
  providers: [DailyChallengeService],
  exports: [DailyChallengeService],
})
export class DailyChallengeModule {}
