import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { StrictValidation } from '../../common';
import { Context } from '../../context';
import { SolvingService } from './solving.service';
import { SolveLessonsService } from './solve-lessons.service';
import { StartLessonDto, SolveLessonDto } from './dto/solve-lesson.dto';
import { AttemptStudentGetDto } from './dto/attempt.dto';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';

// Student view of solving: the attempt flow (start/solve) plus their own
// attempt history and the leaderboard. studentId + schoolId are forced from
// the context — the student can never read or act as another.
@Controller('learning/solving/student')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class SolvingStudentController {
  constructor(
    private readonly solving: SolvingService,
    private readonly solve: SolveLessonsService,
    private readonly ctx: Context,
  ) {}

  @Post('start')
  async start(@Body() body: StartLessonDto) {
    const student = this.ctx.student;
    return this.solve.start({
      studentId: student.id,
      schoolId: student.schoolId,
      trackId: student.trackId,
      lessonId: body.lessonId,
    });
  }

  @Post('solve')
  async solveLesson(@Body() body: SolveLessonDto) {
    const student = this.ctx.student;
    return this.solve.solve({
      studentId: student.id,
      snapshotId: body.snapshotId,
      answers: body.answers,
    });
  }

  @Get('attempts')
  async getAttempts(@Query() query: AttemptStudentGetDto) {
    const student = this.ctx.student;
    return this.solving.getAttemptsByCriteria({
      params: query,
      schoolId: student.schoolId,
      studentId: student.id,
    });
  }

  @Get('leaderboard')
  async getLeaderBoard() {
    const student = this.ctx.student;
    return this.solving.getLeaderBoard({
      schoolId: student.schoolId,
      trackId: student.trackId,
    });
  }
}
