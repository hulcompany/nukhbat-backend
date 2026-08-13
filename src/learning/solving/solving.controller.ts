import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StrictValidation } from '../../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { Context } from '../../context';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';
import { SolvingSnapshotDto, SolvingStartLessonDto } from './dto';
import { SolvingDailyChallengeService } from './solving-daily-challenge.service';
import { SolvingLessonsService } from './solving-lessons.service';

@Controller('learning/solving')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class SolvingController {
  constructor(
    private readonly lessons: SolvingLessonsService,
    private readonly dailyChallenges: SolvingDailyChallengeService,
    private readonly context: Context,
  ) {}

  @Post('lesson/start')
  startLesson(@Body() dto: SolvingStartLessonDto) {
    return this.lessons.start(this.context.student, dto);
  }

  @Post('lesson/solve')
  solveLesson(@Body() dto: SolvingSnapshotDto) {
    return this.lessons.solve(this.context.student, dto);
  }

  @Post('daily-challenge/start')
  startDailyChallenge() {
    return this.dailyChallenges.start(this.context.student);
  }

  @Post('daily-challenge/solve')
  solveDailyChallenge(@Body() dto: SolvingSnapshotDto) {
    return this.dailyChallenges.solve(this.context.student, dto);
  }
}
