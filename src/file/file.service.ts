import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppFile, FileStatus } from './entity/app-file.entity';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { UUID } from 'node:crypto';
import { transaction } from 'core';
import { FilePgListener } from './file.pg.listener';
import { FileProvider } from './provider/file.provider';

@Injectable()
export class FileService implements OnModuleDestroy {
  private readonly fileListener: FilePgListener;
  constructor(
    @InjectRepository(AppFile) private readonly repo: Repository<AppFile>,
    private readonly ds: DataSource,
    private readonly provider: FileProvider,
  ) {
    this.fileListener = new FilePgListener(process.env.DBLINK!, async (v) => {
      await this.cleanUp([v.id]);
    });
    this.fileListener.start();
  }

  async onModuleDestroy() {
    await this.fileListener.stop();
  }

  async getById(id: UUID) {
    let file = await this.repo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException();
    }
    if (await this.provider.exists(file.key)) {
      return file;
    }
    await this.repo.delete({ id: id });
    throw new NotFoundException();
  }

  async store(
    file: Express.Multer.File | undefined | null,
    folder: string,
  ): Promise<AppFile | undefined | null> {
    if (!file) return undefined;

    return await transaction(this.ds, async (em) => {
      let key = this.provider.generateKey(folder, file.originalname);
      let entity = em.getRepository(AppFile).create({
        key: key,
        type: file.mimetype,
        status: FileStatus.unUsed,
      });
      await em.getRepository(AppFile).save(entity);
      await this.provider.store({
        data: file.buffer,
        key: key,
      });
      return entity;
    });
  }

  async softRemove(id: UUID, dm?: EntityManager) {
    let fRep = dm?.getRepository(AppFile) || this.repo;
    let res = await fRep.findOneBy({ id });
    if (res) {
      await fRep.softRemove(res);
    }
  }

  // tri-state: undefined = keep current file, null = remove it, file = swap it
  async replace(params: {
    old?: UUID | null;
    store?: Express.Multer.File | null;
    em?: EntityManager;
    folder: string;
  }) {
    if (params.store === undefined) {
      return undefined;
    }
    if (params.old) {
      await this.softRemove(params.old, params.em);
    }
    if (params.store === null) {
      return null;
    }
    let stored = await this.store(params.store, params.folder);
    return stored!.id;
  }

  async use(params: { id: UUID; dm?: EntityManager }) {
    let fRep = params.dm?.getRepository(AppFile) || this.repo;
    let res = await fRep.findOneBy({ id: params.id });
    if (!res) {
      throw new NotFoundException();
    }
    return await fRep.save({ ...res, status: FileStatus.used });
  }

  async cleanUp(fileIds: string[]) {
    if (!fileIds.length) return;

    const files = await this.repo
      .createQueryBuilder('file')
      .withDeleted()
      .where('file.id IN (:...ids)', { ids: fileIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('file.status != :used', { used: FileStatus.used }).orWhere(
            'file.deletedAt IS NOT NULL',
          );
        }),
      )
      .getMany();

    await this.deleteFiles(files);
  }

  async cleanUpAll() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const files = await this.repo
      .createQueryBuilder('file')
      .withDeleted()
      .where(
        new Brackets((qb) => {
          qb.where('file.status != :used', { used: FileStatus.used }).orWhere(
            'file.deletedAt IS NOT NULL',
          );
        }),
      )
      .andWhere('file.createdAt < :cutoff', { cutoff })
      .getMany();

    await this.deleteFiles(files);
  }

  private async deleteFiles(files: AppFile[]) {
    for (const file of files) {
      try {
        await this.provider.delete(file.key);
        await this.repo.remove(file);
      } catch (e) {
        console.log('Error deleting file from disk/db');
        console.log(e);
      }
    }
  }
}
