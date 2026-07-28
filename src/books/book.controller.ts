import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UUID } from 'crypto';
import { BookService } from './book.services';
import { BookCreateDto, BookEditDto } from './dto/book.dto';
import { Context } from '../context';
import { ImageFileValidatorPipeline } from '../common/pipe/image.file.validator.pipeline';
import { SubscriptionGuard } from '../subscription/guard/subscription.guard';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { StrictValidation } from '../common';
import { SchoolOwnerGuard } from '../school/guards/school-owner.guard';
import { BookFileValidatorPipeline } from './pipeline/book.file.validator.pipeline';

@Controller('books')
@UseGuards(JwtGuardStrict)
@StrictValidation()
export class BookController {
  constructor(
    private readonly bookService: BookService,
    private readonly ctxt: Context,
  ) {}

  @Get('school')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async getSchoolBooks() {
    return await this.bookService.findBooks({
      school: { id: this.ctxt.school.id },
    });
  }

  @Get('student')
  @UseGuards(RoleGuard([RoleType.student]), SubscriptionGuard())
  async getStudentBooks() {
    return await this.bookService.findBooks({
      school: { id: this.ctxt.student!.schoolId! },
    });
  }

  @Post('school')
  @UseInterceptors(FileInterceptor('attachment'))
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async createBook(
    @Body() body: BookCreateDto,
    @UploadedFile(new BookFileValidatorPipeline())
    attachment: Express.Multer.File,
  ) {
    return await this.bookService.createBook({
      params: { ...body, school: { id: this.ctxt.school.id } },
      file: attachment,
    });
  }

  @Patch('school/:id')
  @UseInterceptors(FileInterceptor('attachment'))
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async editBook(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: BookEditDto,
    @UploadedFile(new BookFileValidatorPipeline())
    attachment?: Express.Multer.File,
  ) {
    return await this.bookService.editBook({
      filters: { id: id, school: { id: this.ctxt.school.id } },
      params: body,
      file: attachment,
    });
  }

  @Delete('school/:id')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async deleteSchoolBook(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.bookService.deleteBook({
      id: id,
      school: { id: this.ctxt.school.id },
    });
  }
}
