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
import { AttemptsService } from './attempts.service';
import { AttemptsGetDto } from './dto/attempts.dto';

// School-owner view of solving: read-only. schoolId is forced from the owner's
// context; the leaderboard is per track (owners may run several).
@Controller('learning/attempts/school')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class AttemptsSchoolController {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly ctx: Context,
  ) {}

  @Get()
  async getAttempts(@Query() query: AttemptsGetDto) {
    return this.attempts.getLessonAttemptsByCriteria({
      params: query,
      schoolId: this.ctx.school.id,
    });
  }

  @Get(':attemptId/questions')
  getAttemptQuestions(
    @Param('attemptId', ParseUUIDPipe) attemptId: UUID,
  ) {
    return this.attempts.getQuestionAttempts({
      lessonAttemptId: attemptId,
      lessonAttempt: { schoolId: this.ctx.school.id },
    });
  }
}
