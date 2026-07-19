import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { StrictValidation } from '../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { StudentGuard } from '../student/guard/student.guard';
import { LearningStudentService } from './learning-student.service';
import { SaveQuestionDto } from './saved-questions/dto/saved-question.dto';

// Student learning surface. SubscriptionGuard is intentionally NOT composed
// here: SubscriptionModule already imports LearningModule, so pulling it in
// would close a module cycle. Browsing books/courses/saved questions only
// needs an active profile; the paid gate belongs on the solve routes.
@Controller('learning')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.student]),
  StudentGuard({ requireActive: true }),
)
@StrictValidation()
export class LearningStudentController {
  constructor(private readonly service: LearningStudentService) {}

  @Get('student/books')
  async getMyBooks() {
    return await this.service.getMyBooks();
  }

  @Get('student/courses')
  async getMyCourses() {
    return await this.service.getMyCourses();
  }

  // Saved questions
  @Post('saved_questions')
  async saveQuestion(@Body() body: SaveQuestionDto) {
    return await this.service.saveQuestion(body.questionId);
  }

  @Get('saved_questions')
  async getSavedQuestions() {
    return await this.service.getSavedQuestions();
  }

  @Get('saved_questions/:id')
  async getSavedQuestion(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.getSavedQuestion(id);
  }

  @Delete('saved_questions/:id')
  async removeSavedQuestion(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.removeSavedQuestion(id);
  }
}
