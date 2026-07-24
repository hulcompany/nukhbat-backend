import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageFileValidatorPipeline, StrictValidation } from '../../common';
import { UUID } from 'crypto';
import { JwtGuardStrict, RoleGuard, RoleType } from '../../core';
import { SchoolOwnerGuard } from '../../school/guards/school-owner.guard';

import { IdsDto } from '../../common/dto/ids.dto';
import { CurriculumSchoolService } from '../services/curriculum-school.service';
import { SchoolAccessService } from '../../school-access/school-access.service';
import { Context } from '../../context';
import { CourseGetDto } from '../course/dto/course.dto';
import {
  UnitCreateDto,
  UnitGetDto,
  UnitUpdateDto,
} from '../units/dto/unit-dto';
import { LessonCreateDto, LessonEditDto } from '../lessons/dto/lessons.dto';
import {
  QuestionBulkCreateDto,
  QuestionCreateDto,
  QuestionEditDto,
  QuestionGetDto,
} from '../questions/dto/question.dto';
import { CurriculumService } from '../services/curriculum.service';

@Controller('curriculum/school')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class CurriculumSchoolController {
  constructor(
    // writes / management
    private readonly service: CurriculumSchoolService,
    // reads — context-free; this controller resolves the school scope + asserts
    private readonly content: CurriculumService,
    private readonly access: SchoolAccessService,
    private readonly ctx: Context,
  ) {}

  // Full course → unit → lesson tree (active lessons only, no questions) for
  // this school within the given track
  @Get('tree/:trackId')
  async getTree(@Param('trackId', ParseUUIDPipe) trackId: UUID) {
    await this.access.assertTrackAccess(this.ctx.school.id, trackId);
    return this.content.getCurriculumTree({
      trackId,
      schoolId: this.ctx.school.id,
    });
  }

  // Courses
  @Get('courses/:trackId')
  async getCourses(
    @Param('trackId', ParseUUIDPipe) trackId: UUID,
    @Query() params: CourseGetDto,
  ) {
    await this.access.assertTrackAccess(this.ctx.school.id, trackId);
    return this.content.getCourses({ title: params.title, trackId });
  }

  //units
  @Get('units/:courseId')
  async getUnits(
    @Query() params: UnitGetDto,
    @Param('courseId', ParseUUIDPipe) courseId: UUID,
  ) {
    await this.access.assertCourseAccess(this.ctx.school.id, courseId);
    return this.content.getUnits({
      schoolId: this.ctx.school.id,
      courseId,
      title: params.title,
    });
  }

  @Post('units')
  async createUnit(@Body() params: UnitCreateDto) {
    return await this.service.createUnit({
      ...params,
    });
  }

  @Post('units/order/:courseId')
  async changeUnitOrder(
    @Param('courseId', ParseUUIDPipe) courseId: UUID,
    @Body() params: IdsDto,
  ) {
    return await this.service.changeUnitOrder(courseId, params.ids);
  }

  @Delete('units/:id')
  async deleteUnit(@Param('id', ParseUUIDPipe) id: UUID) {
    await this.service.deleteUnit(id);
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() params: UnitUpdateDto,
  ) {
    return this.service.updateUnit(id, params);
  }

  // lessons
  @Get('lessons/:unitId')
  async getLessons(@Param('unitId', ParseUUIDPipe) unitId: UUID) {
    await this.access.assertUnitAccess(this.ctx.school.id, unitId);
    return this.content.getLessons({ schoolId: this.ctx.school.id, unitId });
  }

  @Post('lessons')
  async createLesson(@Body() params: LessonCreateDto) {
    return await this.service.createLesson(params);
  }

  @Patch('lessons/:id')
  async updateLesson(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() params: LessonEditDto,
  ) {
    return this.service.updateLesson(id, params);
  }

  @Delete('lessons/:id')
  async deleteLesson(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.deleteLesson(id);
  }

  @Post('lessons/order/:unitId')
  async changeLessonOrder(
    @Param('unitId', ParseUUIDPipe) unitId: UUID,
    @Body() params: IdsDto,
  ) {
    return await this.service.changeLessonOrder(unitId, params.ids);
  }

  // questions
  @Get('questions')
  async getQuestions(@Query() params: QuestionGetDto) {
    const schoolId = this.ctx.school.id;
    // with an explicit target we assert access first; without one the
    // service itself hides questions of revoked tracks
    if (
      (!params.lessonId && !params.courseId) ||
      (params.lessonId && params.courseId)
    ) {
      throw new BadRequestException(
        'Exactly on of lessonId , courseId must be provided.',
      );
    }
    if (params.lessonId) {
      await this.access.assertLessonAccess(schoolId, params.lessonId);
    }
    if (params.courseId) {
      await this.access.assertCourseAccess(schoolId, params.courseId);
    }
    return this.content.getQuestionsByCriteria({ params, schoolId });
  }

  @Get('questions/:id')
  async getQuestion(@Param('id', ParseUUIDPipe) id: UUID) {
    await this.access.assertQuestionAccess(this.ctx.school.id, id);
    return await this.content.getQuestion({ id, schoolId: this.ctx.school.id });
  }

  @Post('questions')
  @UseInterceptors(FileInterceptor('image'))
  async createQuestion(
    @Body() params: QuestionCreateDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File,
  ) {
    return await this.service.createQuestion(params, image);
  }

  // JSON only — bulk creation has no image support
  @Post('questions/bulk')
  async createQuestions(@Body() params: QuestionBulkCreateDto) {
    return await this.service.createQuestions(params);
  }

  @Patch('questions/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateQuestion(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() params: QuestionEditDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File,
  ) {
    return this.service.updateQuestion(id, params, image);
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.deleteQuestion(id);
  }

  // bulk delete via POST — DELETE request bodies get dropped by some
  // proxies/clients, and this route mutates more than one resource anyway
  @Post('questions/bulk-delete')
  async deleteQuestions(@Body() params: IdsDto) {
    return await this.service.deleteQuestions(params.ids);
  }

  // daily challenge
  @Get('daily-challenge')
  async getTodayDailyChallenge() {
    return await this.service.getTodayDailyChallenge();
  }

  @Post('daily-challenge')
  async createTodayDailyChallenge() {
    return await this.service.createTodayDailyChallenge();
  }
}
