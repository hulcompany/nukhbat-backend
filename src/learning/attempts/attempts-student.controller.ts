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
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';
import { AttemptsService } from './attempts.service';
import { AttemptStudentGetDto } from './dto/attempts.dto';

@Controller('learning/attempts/student')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class AttemptsStudentController {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly ctx: Context,
  ) {}

  @Get()
  async getAttempts(@Query() query: AttemptStudentGetDto) {
    const student = this.ctx.student;
    return this.attempts.getLessonAttemptsByCriteria({
      params: query,
      schoolId: student.schoolId,
      studentId: student.id,
    });
  }

  @Get(':attemptId/questions')
  getAttemptQuestions(
    @Param('attemptId', ParseUUIDPipe) attemptId: UUID,
  ) {
    return this.attempts.getQuestionAttempts({
      lessonAttemptId: attemptId,
      studentId: this.ctx.student.id,
    });
  }
}
