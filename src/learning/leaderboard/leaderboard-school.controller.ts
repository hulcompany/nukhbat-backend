import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StrictValidation } from '../../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { Context } from '../../context';
import { SchoolOwnerGuard } from '../../school/guards/school-owner.guard';
import { SchoolLeaderboardDto } from './dto/leaderboard.dto';
import { LeaderboardService } from './leaderboard.service';

@Controller('learning/leaderboard/school')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class LeaderboardSchoolController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly context: Context,
  ) {}

  @Get()
  get(@Query() query: SchoolLeaderboardDto) {
    return this.leaderboard.get({
      schoolId: this.context.school.id,
      trackId: query.trackId,
      query,
    });
  }
}
