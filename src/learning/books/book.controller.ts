// import {
//   Controller,
//   Get,
//   Post,
//   Patch,
//   Delete,
//   Param,
//   Body,
//   UploadedFile,
//   UseInterceptors,
//   ParseUUIDPipe,
//   UseGuards,
//   UsePipes,
//   ValidationPipe,
// } from '@nestjs/common';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { UUID } from 'crypto';
// import { JwtGuardStrict } from '../../core/auth';
// import { Context } from '../../context';
// import { SchoolOwnerGuard } from '../../school/guards/school-owner.guard';
// import { BookService } from './book.services';
// import { BookCreateDto, BookEditDto } from './dto/book.dto';
// import { ImageFileValidatorPipeline, StrictValidation } from '../../common';
// import { RoleGuard, RoleType } from '../../core';

// @Controller('learning/books')
// export class BookController {
//   constructor(
//     private readonly bookService: BookService,
//     private readonly ctxt: Context,
//   ) {}

//   @Get('')
//   async getSchoolBooks() {
//     return await this.bookService.findBooks({
//       school: { id: this.ctxt.school.id },
//     });
//   }

//   @Post('')
//   @UseInterceptors(FileInterceptor('image'))
//   async createBook(
//     @Body() body: BookCreateDto,
//     @UploadedFile(new ImageFileValidatorPipeline(true))
//     image: Express.Multer.File,
//   ) {
//     return await this.bookService.createBook(body, image);
//   }

//   @Patch(':id')
//   @UseInterceptors(FileInterceptor('image'))
//   async editBook(
//     @Param('id', ParseUUIDPipe) id: UUID,
//     @Body() body: BookEditDto,
//     @UploadedFile() image?: Express.Multer.File,
//   ) {
//     return await this.bookService.editBook(id, body, image);
//   }

//   @Delete(':id')
//   async deleteSchoolBook(@Param('id', ParseUUIDPipe) id: UUID) {
//     return await this.bookService.deleteBook({
//       id: id,
//       school: { id: this.ctxt.school.id },
//     });
//   }
// }
