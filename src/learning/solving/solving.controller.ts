import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StrictValidation } from '../../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { Context } from '../../context';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';
import { SolvingSnapshotDto, SolvingStartLessonDto } from './dto';
import { SolvingDailyChallengeService } from './solving-daily-challenge.service';
import { SolvingLessonsService } from './solving-lessons.service';
import { SolvingSavedService } from './solving-saved.service';
import {
  DailyChallengePreview,
  SolvingSolveResult,
  SolvingStartResult,
} from './types';

@Controller('learning/solving')
@UseGuards(JwtGuardStrict, RoleGuard([RoleType.student]), SubscriptionGuard())
@StrictValidation()
export class SolvingController {
  constructor(
    private readonly lessons: SolvingLessonsService,
    private readonly dailyChallenges: SolvingDailyChallengeService,
    private readonly savedQuestions: SolvingSavedService,
    private readonly context: Context,
  ) {}

  @Post('lesson/start')
  async startLesson(
    @Body() dto: SolvingStartLessonDto,
  ): Promise<SolvingStartResult> {
    return this.lessons.start(this.context.student, dto);
  }

  @Post('lesson/solve')
  async solveLesson(
    @Body() dto: SolvingSnapshotDto,
  ): Promise<SolvingSolveResult> {
    return this.lessons.solve(this.context.student, dto);
  }

  @Post('daily-challenge/start')
  async startDailyChallenge(): Promise<SolvingStartResult> {
    return this.dailyChallenges.start(this.context.student);
  }

  @Post('daily-challenge/solve')
  async solveDailyChallenge(
    @Body() dto: SolvingSnapshotDto,
  ): Promise<SolvingSolveResult> {
    return this.dailyChallenges.solve(this.context.student, dto);
  }

  @Get('daily-challenge')
  async getDailyChallenge(): Promise<DailyChallengePreview> {
    return this.dailyChallenges.getToday(this.context.student);
  }

  @Post('saved/start')
  async startSaved(): Promise<SolvingStartResult> {
    return this.savedQuestions.start(this.context.student);
  }

  @Post('saved/solve')
  async solveSaved(
    @Body() dto: SolvingSnapshotDto,
  ): Promise<SolvingSolveResult> {
    return this.savedQuestions.solve(this.context.student, dto);
  }
}
