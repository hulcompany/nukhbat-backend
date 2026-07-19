import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../core';
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
    private courses: CourseService,
    private units: UnitService,
    private lessons: LessonService,
    private questions: QuestionService,
  ) {}

  // admin read access over the whole content tree — no track-access checks

  @Get('courses')
  async getCourses(@Query() query: AdminCourseGetDto) {
    return await this.courses.find({
      title: query.title,
      trackId: query.trackId,
    });
  }

  @Get('units')
  async getUnits(@Query() query: AdminUnitGetDto) {
    return await this.units.find(
      {
        schoolId: query.schoolId,
        title: query.title,
        courseId: query.courseId,
        ...(query.trackId ? { course: { trackId: query.trackId } } : {}),
      },
      { school: true },
    );
  }

  @Get('lessons')
  async getLessons(@Query() query: AdminLessonGetDto) {
    // lessons carry no courseId/trackId columns — both go through the unit
    const unitWhere = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.trackId ? { course: { trackId: query.trackId } } : {}),
    };
    return await this.lessons.find(
      {
        unitId: query.unitId,
        schoolId: query.schoolId,
        title: query.title,
        ...(Object.keys(unitWhere).length ? { unit: unitWhere } : {}),
      },
      { school: true },
    );
  }

  @Get('questions')
  async getQuestions(@Query() query: AdminQuestionGetDto) {
    return await this.questions.getByCriteria({
      params: query,
      schoolId: query.schoolId,
      trackId: query.trackId,
    });
  }
}
