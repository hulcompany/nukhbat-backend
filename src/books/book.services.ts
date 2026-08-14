import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from './entity/book.entity';
import { DataSource, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { BookCreateDto, BookEditDto } from './dto/book.dto';
import { transaction } from 'core';
import { UUID } from 'crypto';
import { FileService } from '../file/file.service';
import { SchoolAccessService } from '../school-access/school-access.service';

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    private readonly schoolAccess: SchoolAccessService,
    private readonly ds: DataSource,
  ) {}
  async createBook(params: { params: BookCreateDto; schoolId: UUID }) {
    await this.schoolAccess.assertLessonAccess(
      params.schoolId,
      params.params.lessonId,
    );
    return await this.bookRepo.save({
      lesson: { id: params.params.lessonId },
      school: { id: params.schoolId },
      name: params.params.name,
      text: params.params.text,
    });
  }

  async editBook(params: { schoolId: UUID; id: UUID; params: BookEditDto }) {
    let book = await this.bookRepo.findOne({
      where: { id: params.id, school: { id: params.schoolId } },
    });
    if (!book) {
      throw new NotFoundException('Book Not Found');
    }
    await this.schoolAccess.assertLessonAccess(params.schoolId, book.lessonId);
    if (params.params.name) {
      book.name = params.params.name;
    }
    if (params.params.text) {
      book.text = params.params.text;
    }
    return await this.bookRepo.save(book);
  }

  async findBook(params: FindOptionsWhere<Book>) {
    let res = await this.bookRepo.findOne({ where: params });
    return res;
  }

  async findBookOrFail(params: FindOptionsWhere<Book>) {
    let res = await this.bookRepo.findOne({ where: params });
    if (!res) {
      throw new NotFoundException();
    }
    return res;
  }

  async deleteBook(filters: FindOptionsWhere<Book>) {
    return await transaction(this.ds, async (em) => {
      let res = await em.getRepository(Book).delete(filters);
      if (!res.affected) {
        throw new NotFoundException();
      }
    });
  }

  async findBooks(params?: FindOptionsWhere<Book>) {
    let res = await this.bookRepo.find({ where: params });
    return res;
  }
}
