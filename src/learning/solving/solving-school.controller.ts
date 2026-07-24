import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { StrictValidation } from '../../common';
import { Context } from '../../context';
import { SchoolOwnerGuard } from '../../school/guards/school-owner.guard';
import { SolvingService } from './solving.service';
import { AttemptGetDto } from './dto/attempt.dto';

// School-owner view of solving: read-only. schoolId is forced from the owner's
// context; the leaderboard is per track (owners may run several).
@Controller('learning/solving/school')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class SolvingSchoolController {
  constructor(
    private readonly solving: SolvingService,
    private readonly ctx: Context,
  ) {}

  @Get('attempts')
  async getAttempts(@Query() query: AttemptGetDto) {
    return this.solving.getAttemptsByCriteria({
      params: query,
      schoolId: this.ctx.school.id,
    });
  }

  // per-question breakdown of one lesson attempt, scoped to the owner's school
  @Get('attempts/:attemptId/questions')
  async getAttemptQuestions(
    @Param('attemptId', ParseUUIDPipe) attemptId: UUID,
  ) {
    return this.solving.getQuestionAttempts({
      lessonAttemptId: attemptId,
      lessonAttempt: { schoolId: this.ctx.school.id },
    });
  }

  @Get('leaderboard/:trackId')
  async getLeaderBoard(@Param('trackId', ParseUUIDPipe) trackId: UUID) {
    return this.solving.getLeaderBoard({
      schoolId: this.ctx.school.id,
      trackId,
    });
  }
}
