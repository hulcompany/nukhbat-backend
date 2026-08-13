import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolModule } from '../../school/school.module';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import { SubscriptionModule } from '../../subscription/subscription.module';
import { LeaderboardSchoolController } from './leaderboard-school.controller';
import { LeaderboardStudentController } from './leaderboard-student.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentProfile]),
    SchoolModule,
    SubscriptionModule,
  ],
  controllers: [LeaderboardSchoolController, LeaderboardStudentController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
