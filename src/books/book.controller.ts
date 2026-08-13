import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { BookService } from './book.services';
import { BookCreateDto, BookEditDto } from './dto/book.dto';
import { Context } from '../context';
import { SubscriptionGuard } from '../subscription/guard/subscription.guard';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { StrictValidation } from '../common';
import { SchoolOwnerGuard } from '../school/guards/school-owner.guard';

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
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async createBook(@Body() body: BookCreateDto) {
    return await this.bookService.createBook({
      params: body,
      schoolId: this.ctxt.school.id,
    });
  }

  @Patch('school/:id')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async editBook(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: BookEditDto,
  ) {
    return await this.bookService.editBook({
      id: id,
      schoolId: this.ctxt.school.id,
      params: body,
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
