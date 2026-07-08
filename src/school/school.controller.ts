import {
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
import { ImageFileValidatorPipeline, StrictValidation } from '../common';
import { UUID } from 'crypto';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { SchoolOwnerGuard } from './guards/school-owner.guard';
import {
  BookCreateDto,
  BookEditDto,
  CourseGetDto,
  UnitCreateDto,
  UnitGetDto,
  UnitUpdateDto,
} from '../learning/dto';
import { LessonCreateDto, LessonEditDto } from '../learning/dto';

import {
  QuestionBulkCreateDto,
  QuestionCreateDto,
  QuestionEditDto,
  QuestionGetDto,
} from '../learning/dto';
import { IdsDto } from '../common/dto/ids.dto';
import { LearningSchoolService } from '../learning/learning-school.service';
import { SchoolEditDto } from './dto/school.dto';
import { Context } from '../context';
import { SchoolService } from './school.service';
import { BookFileValidatorPipeline } from './pipeline/book.file.validator.pipeline';

@Controller('school/me')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class SchoolController {
  constructor(
    private readonly service: LearningSchoolService,
    private readonly ctxt: Context,
    private readonly schoolService: SchoolService,
  ) {}

  @Patch()
  @UseInterceptors(FileInterceptor('image'))
  async edit(
    @Body() body: SchoolEditDto,
    @UploadedFile() image?: Express.Multer.File | null,
  ) {
    return await this.schoolService.edit(
      {
        owner: { id: this.ctxt.user.id },
      },
      body,
      image,
    );
  }

  @Get()
  async getMySchool() {
    return await this.schoolService.findOneOrFail({
      owner: { id: this.ctxt.user.id },
    });
  }

  @Delete('image')
  async deleteMyImage() {
    return await this.schoolService.deleteImage({
      owner: { id: this.ctxt.user.id },
    });
  }

  // Books
  @Get('books')
  async getSchoolBooks() {
    return await this.service.getSchoolBooks();
  }

  @Post('books')
  @UseInterceptors(FileInterceptor('attachment'))
  async createBook(
    @Body() body: BookCreateDto,
    @UploadedFile(new BookFileValidatorPipeline(true))
    attachment: Express.Multer.File,
  ) {
    return await this.service.createBook(body, attachment);
  }

  @Patch('books/:id')
  @UseInterceptors(FileInterceptor('attachment'))
  async editBook(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: BookEditDto,
    @UploadedFile(new BookFileValidatorPipeline(false))
    attachment?: Express.Multer.File,
  ) {
    return await this.service.editBook(id, body, attachment);
  }

  @Delete('books/:id')
  async deleteSchoolBook(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.deleteSchoolBook(id);
  }

  // Courses
  @Get('courses/:trackId')
  async getCourses(
    @Param('trackId', ParseUUIDPipe) trackId: UUID,
    @Query() params: CourseGetDto,
  ) {
    return this.service.getCourses(trackId, {
      title: params.title,
    });
  }

  //units
  @Get('units/:courseId')
  async getUnits(
    @Query() params: UnitGetDto,
    @Param('courseId', ParseUUIDPipe) courseId: UUID,
  ) {
    return this.service.getUnits(courseId, params);
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
    return this.service.getLessons(unitId);
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
    return this.service.getQuestions(params);
  }

  @Get('questions/:id')
  async getQuestion(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.service.getQuestion(id);
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

  @Post('questions/order/:lessonId')
  async changeQuestionOrder(
    @Param('lessonId', ParseUUIDPipe) lessonId: UUID,
    @Body() params: IdsDto,
  ) {
    return await this.service.changeQuestionOrder(lessonId, params.ids);
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
