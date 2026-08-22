import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonAttempt } from './entity/lesson-attempt.entity';
import { QuestionAttempt } from './entity/question-attempt.entity';
import { DailyChallengeAttempt } from './entity/daily-challenge.attempt.entity';
import { AttemptsService } from './attempts.service';
import { AttemptsSchoolController } from './attempts-school.controller';
import { AttemptsStudentController } from './attempts-student.controller';
import { SchoolModule } from '../../school/school.module';
import { SubscriptionModule } from '../../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonAttempt,
      QuestionAttempt,
      DailyChallengeAttempt,
    ]),
    SchoolModule,
    SubscriptionModule,
  ],
  providers: [AttemptsService],
  controllers: [AttemptsSchoolController, AttemptsStudentController],
  exports: [AttemptsService],
})
export class AttemptsModule {}
