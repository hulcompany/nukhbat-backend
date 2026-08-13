import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BasePaginationDto } from 'core';
import { StrictValidation } from '../../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { Context } from '../../context';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('learning/leaderboard/student')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class LeaderboardStudentController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly context: Context,
  ) {}

  @Get()
  get(@Query() query: BasePaginationDto) {
    const student = this.context.student;
    return this.leaderboard.get({
      schoolId: student.schoolId,
      trackId: student.trackId,
      query,
    });
  }
}
