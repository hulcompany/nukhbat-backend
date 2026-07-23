import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from './entity/book.entity';
import { DataSource, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { BookEditDto } from './dto/book.dto';
import { transaction } from 'core';
import { UUID } from 'crypto';
import { FileService } from '../file/file.service';

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    private readonly files: FileService,
    private readonly ds: DataSource,
  ) {}
  async createBook(params: {
    file: Express.Multer.File;
    params: DeepPartial<Book>;
  }) {
    let attach;
    return await transaction(
      this.ds,
      async (em) => {
        let entity = em.getRepository(Book).create(params.params);
        attach = await this.files.store(params.file, 'learning/books');
        attach = await this.files.use({ id: attach.id, dm: em });
        entity.attachment = attach.id;
        let book = await em.getRepository(Book).save(entity);
        return book;
      },
      {
        onError: async () => {
          if (attach?.id) {
            await this.files.cleanUp([attach.id]);
          }
        },
      },
    );
  }

  async editBook(params: {
    filters: FindOptionsWhere<Book>;
    params: BookEditDto;
    file?: Express.Multer.File;
  }) {
    let attachIds: UUID[] = [];
    return await transaction(
      this.ds,
      async (em) => {
        let old = await this.findBookOrFail(params.filters);
        let newFile = await this.files.replace({
          em: em,
          old: old?.attachment,
          store: params.file,
          folder: 'learning/books',
        });
        if (newFile) {
          attachIds.push(newFile);
          old.attachment = newFile;
        }
        if (params?.params.name) {
          old.name = params.params.name;
        }
        let book = await em.getRepository(Book).save(old);
        return book;
      },
      {
        onError: async () => {
          await this.files.cleanUp(attachIds);
        },
      },
    );
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
      let curr = await this.findBookOrFail(filters);
      await this.files.softRemove(curr.attachment, em);
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
