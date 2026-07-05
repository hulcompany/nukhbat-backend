/**
 * End-to-end test of the book + file lifecycle against the REAL stack:
 * disk provider, dev Postgres (DBLINK from .env), the app_file_soft_delete
 * trigger and the FilePgListener LISTEN/NOTIFY cleanup.
 *
 * Requires: dev Postgres up with the trigger migration applied.
 * Files are stored under ./file-test (sample source: file-test/sample.jpg).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { join } from 'path';
const FILE_TEST_DIR = join(__dirname, '../../../file-test');
// must be set before FileDiskProvider is instantiated (it reads it at construction)
process.env.FILE_STORE = FILE_TEST_DIR;

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'node:fs/promises';
import { DataSource } from 'typeorm';
import { AppFile, FileStatus } from '../../file/entity/app-file.entity';
import { FileService } from '../../file/file.service';
import { FileDiskProvider } from '../../file/provider/file.disk.provider';
import { FileProvider } from '../../file/provider/file.provider';
import { School } from '../../school/entity/school.entity';
import { BookService } from './book.services';
import { Book } from './entity/book.entity';

jest.setTimeout(30000);

async function exists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  cond: () => Promise<boolean>,
  timeoutMs = 15000,
  intervalMs = 250,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

describe('Book file lifecycle (e2e, real DB + disk)', () => {
  let ds: DataSource;
  let moduleRef: TestingModule;
  let bookService: BookService;
  let school: School;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url: process.env.DBLINK,
      entities: [join(__dirname, '../../**/*.entity.{ts,js}')],
      synchronize: false,
    });
    await ds.initialize();

    moduleRef = await Test.createTestingModule({
      providers: [
        BookService,
        FileService,
        { provide: FileProvider, useValue: new FileDiskProvider() },
        { provide: DataSource, useValue: ds },
        { provide: getRepositoryToken(Book), useValue: ds.getRepository(Book) },
        {
          provide: getRepositoryToken(AppFile),
          useValue: ds.getRepository(AppFile),
        },
      ],
    }).compile();

    bookService = moduleRef.get(BookService);

    school = await ds
      .getRepository(School)
      .save(ds.getRepository(School).create({ name: 'book-file-e2e school' }));

    // give the FilePgListener a moment to register LISTEN before we
    // trigger any NOTIFY, otherwise the soft-delete event is lost
    await new Promise((r) => setTimeout(r, 1000));
  });

  afterAll(async () => {
    if (school) {
      // cascades to any leftover books
      await ds.getRepository(School).delete({ id: school.id });
    }
    // stops the pg LISTEN client via FileService.onModuleDestroy
    await moduleRef?.close();
    await ds?.destroy();
  });

  let book: Book;
  let appFile: AppFile;
  let diskPath: string;

  it('stores the uploaded file on disk and attaches it to the book as used', async () => {
    const buffer = await fs.readFile(join(FILE_TEST_DIR, 'sample.jpg'));
    const upload = {
      originalname: 'sample.jpg',
      mimetype: 'image/jpeg',
      buffer,
    } as Express.Multer.File;

    book = await bookService.createBook({
      params: { name: 'file lifecycle e2e book' },
      file: upload,
      ctxt: { school } as any,
    });

    expect(book.id).toBeDefined();
    expect(book.attachment).toBeDefined();

    appFile = (await ds
      .getRepository(AppFile)
      .findOne({ where: { id: book.attachment } }))!;
    expect(appFile).not.toBeNull();
    expect(appFile.status).toBe(FileStatus.used);

    diskPath = join(FILE_TEST_DIR, appFile.key);
    await expect(exists(diskPath)).resolves.toBe(true);

    const stored = await fs.readFile(diskPath);
    expect(stored.equals(buffer)).toBe(true);
  });

  it('deleting the book soft-removes the file and the PG trigger erases it from disk', async () => {
    await bookService.deleteBook({ id: book.id });

    await expect(
      ds.getRepository(Book).findOne({ where: { id: book.id } }),
    ).resolves.toBeNull();

    // NOTIFY app_file_soft_delete -> FilePgListener -> cleanUp -> disk unlink
    const gone = await waitFor(async () => !(await exists(diskPath)));
    expect(gone).toBe(true);

    // cleanUp also hard-deletes the app_file row
    const rowGone = await waitFor(async () => {
      const row = await ds
        .getRepository(AppFile)
        .findOne({ where: { id: appFile.id }, withDeleted: true });
      return row === null;
    });
    expect(rowGone).toBe(true);
  });
});
