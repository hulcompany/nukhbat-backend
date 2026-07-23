import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../../core';
import { CurriculumService } from '../services/curriculum.service';
import { AdminCourseGetDto } from '../course/dto/course.dto';
import { AdminUnitGetDto } from '../units/dto/unit-dto';
import { AdminLessonGetDto } from '../lessons/dto/lessons.dto';
import { AdminQuestionGetDto } from '../questions/dto/question.dto';

@Controller('curriculum/admin')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
@UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
export class CurriculumManagementController {
  constructor(private readonly content: CurriculumService) {}

  // admin read access over the whole content tree — no track-access checks

  @Get('courses')
  async getCourses(@Query() query: AdminCourseGetDto) {
    return await this.content.getCourses({
      title: query.title,
      trackId: query.trackId,
    });
  }

  @Get('units')
  async getUnits(@Query() query: AdminUnitGetDto) {
    return await this.content.getUnits(
      {
        schoolId: query.schoolId,
        title: query.title,
        courseId: query.courseId,
        trackId: query.trackId,
      },
      { school: true },
    );
  }

  @Get('lessons')
  async getLessons(@Query() query: AdminLessonGetDto) {
    return await this.content.getLessons(
      {
        unitId: query.unitId,
        courseId: query.courseId,
        schoolId: query.schoolId,
        title: query.title,
        trackId: query.trackId,
      },
      { school: true },
    );
  }

  @Get('questions')
  async getQuestions(@Query() query: AdminQuestionGetDto) {
    return await this.content.getQuestionsByCriteria({
      params: query,
      schoolId: query.schoolId,
      trackId: query.trackId,
    });
  }
}
