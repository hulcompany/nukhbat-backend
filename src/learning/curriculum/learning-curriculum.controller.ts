import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { StrictValidation } from '../../common';
import { Context } from '../../context';
import { LearningCurriculumService } from './learning-curriculum.service';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';

// Student's own curriculum tree — track + school come from their profile, never
// the query. Single endpoint for now; the shaping lives in the service and
// we'll expand it later.
@Controller('learning/curriculum')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class LearningCurriculumController {
  constructor(
    private readonly service: LearningCurriculumService,
    private readonly ctx: Context,
  ) {}

  @Get('/')
  async getCurriculum() {
    const student = this.ctx.student;
    return this.service.getCurriculum(student.trackId, student.schoolId);
  }
}
