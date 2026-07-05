import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import { DataSource } from 'typeorm';
import { FileService } from '../../file/file.service';
import { BookService } from './book.services';
import { Book } from './entity/book.entity';

const schoolId = '11111111-1111-4111-8111-111111111111' as UUID;
const bookId = '22222222-2222-4222-8222-222222222222' as UUID;
const fileId = '33333333-3333-4333-8333-333333333333' as UUID;
const newFileId = '44444444-4444-4444-8444-444444444444' as UUID;

const upload = {
  originalname: 'book.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('pdf'),
} as Express.Multer.File;

describe('BookService', () => {
  let service: BookService;
  let repo: { findOne: jest.Mock; find: jest.Mock };
  let files: {
    store: jest.Mock;
    use: jest.Mock;
    replace: jest.Mock;
    softRemove: jest.Mock;
    cleanUp: jest.Mock;
  };
  let txRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let em: { getRepository: jest.Mock };
  let qr: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: any;
  };

  const ctxt = { school: { id: schoolId } } as any;

  beforeEach(async () => {
    txRepo = { create: jest.fn(), save: jest.fn(), delete: jest.fn() };
    em = { getRepository: jest.fn().mockReturnValue(txRepo) };
    qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: em,
    };
    repo = { findOne: jest.fn(), find: jest.fn() };
    files = {
      store: jest.fn(),
      use: jest.fn(),
      replace: jest.fn(),
      softRemove: jest.fn(),
      cleanUp: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BookService,
        { provide: getRepositoryToken(Book), useValue: repo },
        { provide: FileService, useValue: files },
        { provide: DataSource, useValue: { createQueryRunner: () => qr } },
      ],
    }).compile();

    service = module.get(BookService);
  });

  describe('createBook', () => {
    it('stores the file, marks it used and saves the book scoped to the school', async () => {
      const entity: any = { name: 'Algebra' };
      txRepo.create.mockReturnValue(entity);
      files.store.mockResolvedValue({ id: fileId });
      files.use.mockResolvedValue({ id: fileId });
      txRepo.save.mockImplementation(async (e) => ({ ...e, id: bookId }));

      const res = await service.createBook({
        params: { name: 'Algebra' },
        file: upload,
        ctxt,
      });

      expect(txRepo.create).toHaveBeenCalledWith({ name: 'Algebra' });
      expect(files.store).toHaveBeenCalledWith(upload, 'learning/books');
      expect(files.use).toHaveBeenCalledWith({ id: fileId, dm: em });
      expect(txRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Algebra',
          school: { id: schoolId },
          attachment: fileId,
        }),
      );
      expect(res).toEqual(expect.objectContaining({ id: bookId }));
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(files.cleanUp).not.toHaveBeenCalled();
    });

    it('rolls back and cleans up the stored file when saving fails', async () => {
      txRepo.create.mockReturnValue({ name: 'Algebra' });
      files.store.mockResolvedValue({ id: fileId });
      files.use.mockResolvedValue({ id: fileId });
      txRepo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.createBook({ params: { name: 'Algebra' }, file: upload, ctxt }),
      ).rejects.toThrow('db down');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(files.cleanUp).toHaveBeenCalledWith([fileId]);
      expect(qr.release).toHaveBeenCalled();
    });

    it('does not attempt cleanup when storing the file itself fails', async () => {
      txRepo.create.mockReturnValue({ name: 'Algebra' });
      files.store.mockRejectedValue(new Error('disk full'));

      await expect(
        service.createBook({ params: { name: 'Algebra' }, file: upload, ctxt }),
      ).rejects.toThrow('disk full');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(files.cleanUp).not.toHaveBeenCalled();
    });
  });

  describe('editBook', () => {
    const existing = () => ({
      id: bookId,
      name: 'Old name',
      attachment: fileId,
    });

    it('renames without touching the attachment when no file is sent', async () => {
      repo.findOne.mockResolvedValue(existing());
      files.replace.mockResolvedValue(undefined);
      txRepo.save.mockImplementation(async (e) => e);

      const res = await service.editBook({
        filters: { id: bookId },
        params: { name: 'New name' },
      });

      expect(files.replace).toHaveBeenCalledWith({
        em: em,
        old: fileId,
        store: undefined,
        folder: 'learning/books',
      });
      expect(res).toEqual(
        expect.objectContaining({ name: 'New name', attachment: fileId }),
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(files.cleanUp).not.toHaveBeenCalled();
    });

    it('swaps the attachment when a new file is sent', async () => {
      repo.findOne.mockResolvedValue(existing());
      files.replace.mockResolvedValue(newFileId);
      txRepo.save.mockImplementation(async (e) => e);

      const res = await service.editBook({
        filters: { id: bookId },
        params: {},
        file: upload,
      });

      expect(files.replace).toHaveBeenCalledWith({
        em: em,
        old: fileId,
        store: upload,
        folder: 'learning/books',
      });
      expect(res).toEqual(
        expect.objectContaining({ name: 'Old name', attachment: newFileId }),
      );
    });

    it('throws NotFoundException and rolls back when the book does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.editBook({ filters: { id: bookId }, params: { name: 'x' } }),
      ).rejects.toThrow(NotFoundException);

      expect(txRepo.save).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('cleans up the newly stored file when saving fails', async () => {
      repo.findOne.mockResolvedValue(existing());
      files.replace.mockResolvedValue(newFileId);
      txRepo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.editBook({ filters: { id: bookId }, params: {}, file: upload }),
      ).rejects.toThrow('db down');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(files.cleanUp).toHaveBeenCalledWith([newFileId]);
    });
  });

  describe('deleteBook', () => {
    it('soft-removes the attachment and deletes the book', async () => {
      repo.findOne.mockResolvedValue({
        id: bookId,
        name: 'Algebra',
        attachment: fileId,
      });
      txRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteBook({ id: bookId });

      expect(files.softRemove).toHaveBeenCalledWith(fileId, em);
      expect(txRepo.delete).toHaveBeenCalledWith({ id: bookId });
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException and rolls back when nothing was deleted', async () => {
      repo.findOne.mockResolvedValue({
        id: bookId,
        name: 'Algebra',
        attachment: fileId,
      });
      txRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteBook({ id: bookId })).rejects.toThrow(
        NotFoundException,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException before touching files when the book does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deleteBook({ id: bookId })).rejects.toThrow(
        NotFoundException,
      );
      expect(files.softRemove).not.toHaveBeenCalled();
      expect(txRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('finders', () => {
    it('findBook returns the repository result as-is', async () => {
      const book = { id: bookId };
      repo.findOne.mockResolvedValue(book);

      await expect(service.findBook({ id: bookId })).resolves.toBe(book);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: bookId } });
    });

    it('findBook returns null when nothing matches', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBook({ id: bookId })).resolves.toBeNull();
    });

    it('findBookOrFail throws NotFoundException when nothing matches', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBookOrFail({ id: bookId })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findBooks forwards school-scoped filters', async () => {
      const list = [{ id: bookId }];
      repo.find.mockResolvedValue(list);

      const res = await service.findBooks({ school: { id: schoolId } });

      expect(repo.find).toHaveBeenCalledWith({
        where: { school: { id: schoolId } },
      });
      expect(res).toBe(list);
    });
  });
});
