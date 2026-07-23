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

@Controller('books')
@UseGuards(JwtGuardStrict)
@StrictValidation()
export class BookController {
  constructor(
    private readonly bookService: BookService,
    private readonly ctxt: Context,
  ) {}

  @Get('school')
  @UseGuards(RoleGuard([RoleType.contentWriter]))
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
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(RoleGuard([RoleType.contentWriter]))
  async createBook(
    @Body() body: BookCreateDto,
    @UploadedFile(new ImageFileValidatorPipeline(true))
    image: Express.Multer.File,
  ) {
    return await this.bookService.createBook({
      params: { ...body, school: { id: this.ctxt.school.id } },
      file: image,
    });
  }

  @Patch('school/:id')
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(RoleGuard([RoleType.contentWriter]))
  async editBook(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: BookEditDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return await this.bookService.editBook({
      filters: { id: id, school: { id: this.ctxt.school.id } },
      params: body,
      file: image,
    });
  }

  @Delete('school/:id')
  @UseGuards(RoleGuard([RoleType.contentWriter]))
  async deleteSchoolBook(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.bookService.deleteBook({
      id: id,
      school: { id: this.ctxt.school.id },
    });
  }
}
