import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../core';
import { UUID } from 'crypto';
import { SchoolAccessService } from './school-access/school-access.service';
import { CourseService } from './course/course.service';
import { UnitService } from './units/unit.service';
import { LessonService } from './lessons/lessons.service';
import { QuestionService } from './questions/questions.service';
import {
  AdminCourseGetDto,
  AdminLessonGetDto,
  AdminQuestionGetDto,
  AdminUnitGetDto,
} from './dto/learning-admin.dto';

@Controller('learning/admin')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
@UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
export class LearningManagementController {
  constructor(
    private service: SchoolAccessService,
    private courses: CourseService,
    private units: UnitService,
    private lessons: LessonService,
    private questions: QuestionService,
  ) {}

  // admin read access over the whole content tree — no track-access checks

  @Get('courses')
  async getCourses(@Query() query: AdminCourseGetDto) {
    return await this.courses.find({ title: query.title });
  }

  @Get('units')
  async getUnits(@Query() query: AdminUnitGetDto) {
    return await this.units.find(
      {
        schoolId: query.schoolId,
        title: query.title,
      },
      { school: true },
    );
  }

  @Get('lessons')
  async getLessons(@Query() query: AdminLessonGetDto) {
    return await this.lessons.find(
      {
        unitId: query.unitId,
        schoolId: query.schoolId,
        title: query.title,
        ...(query.courseId ? { unit: { courseId: query.courseId } } : {}),
      },
      { school: true },
    );
  }

  @Get('questions')
  async getQuestions(@Query() query: AdminQuestionGetDto) {
    return await this.questions.getByCriteria({
      params: query,
      schoolId: query.schoolId,
    });
  }

  @Post('schoolAccess/:schoolId/:trackId')
  async assignTrack(
    @Param('schoolId') schoolId: UUID,
    @Param('trackId') trackId: UUID,
  ) {
    return this.service.allow({ schoolId: schoolId, trackId: trackId });
  }

  @Delete('schoolAccess/:schoolId/:trackId')
  async unAssignTrack(
    @Param('schoolId') schoolId: UUID,
    @Param('trackId') trackId: UUID,
  ) {
    return this.service.unAllow({ schoolId: schoolId, trackId: trackId });
  }
}
