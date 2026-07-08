import {
  ForbiddenException,
  // Inject,
  Injectable,
  NotFoundException,
  // Scope,
} from '@nestjs/common';
import {
  DataSource,
  // DeepPartial,
  // EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { School } from './entity/school.entity';
import { applyPsqlFilter, BasePaginationModel, transaction } from 'core';
import { FileService } from '../file/file.service';
import { UUID } from 'crypto';
import { SchoolCreateDto, SchoolEditDto } from './dto/school.dto';
import { SchoolGetDto } from './dto/school.get.dto';
import { CoreService } from '../core/core.service';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleType } from '../core';

@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(School) private readonly repo: Repository<School>,
    private readonly ds: DataSource,
    private readonly files: FileService,
    // private readonly context: Context,
    private readonly coreService: CoreService,
  ) {}

  async findOne(params: FindOptionsWhere<School>) {
    return await this.repo.findOne({
      where: params,
      relations: { schoolAccess: { track: true } },
    });
  }

  async findOneOrFail(params: FindOptionsWhere<School>) {
    const user = await this.repo.findOne({
      where: params,
      relations: {
        schoolAccess: {
          track: true,
        },
      },
    });
    if (!user) {
      throw new NotFoundException('School not found');
    }
    return user;
  }
  async edit(
    findOpts: FindOptionsWhere<School>,
    params: SchoolEditDto,
    image?: Express.Multer.File | null,
  ) {
    let old = await this.findOneOrFail(findOpts);
    let fileIds: UUID[] = [];
    return await transaction(
      this.ds,
      async (em) => {
        let newImage = await this.files.replace({
          em: this.ds.manager,
          old: old.logo,
          store: image,
          folder: 'school',
        });
        if (newImage) {
          fileIds.push(newImage);
        }
        if (params?.name) {
          old.name = params.name;
        }
        old.logo = newImage;
        await em.getRepository(School).save(old);
        return await em.getRepository(School).findOneBy({ id: old.id });
      },
      {
        onError: async () => {
          await this.files.cleanUp(fileIds);
        },
      },
    );
  }

  // remove the school logo — tri-state replace with a null store erases it
  async deleteImage(findOpts: FindOptionsWhere<School>) {
    return await this.edit(findOpts, {}, null);
  }

  async delete(id: UUID) {
    let res = await this.repo.delete({ id: id });
    if (!res.affected) {
      throw new NotFoundException();
    }
  }

  async getByCriteria(params: SchoolGetDto) {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.owner', 'user')
      .leftJoinAndSelect('s.schoolAccess', 'sa')
      .leftJoinAndSelect('sa.track', 't');
    applyPsqlFilter({
      queryBuilder: qb,
      query: params,
      options: {
        name: {
          regExp: { regexp: 'contains' },
        },
      },
    });
    const [data, count] = await qb.getManyAndCount();
    const mapped = data.map((school) => ({
      ...school,
      tracks: school.schoolAccess?.map((sa) => sa.track) ?? [],
      schoolAccess: undefined, // optional cleanup
    }));
    return new BasePaginationModel({
      list: mapped,
      totalRecords: count,
      skip: params.skip,
      limit: params.limit,
    });
  }

  async createSchool(params: SchoolCreateDto, image?: Express.Multer.File) {
    let schoolImage;
    return await transaction(this.ds, async (em) => {
      let res = await this.coreService.createUser(
        {
          email: params.email,
          name: params.name,
          password: params.password,
          role: RoleType.contentWriter,
        },
        em,
      );
      if (!res.isCompleted || !res.emailVerfied) {
        throw new ForbiddenException(
          'Email Already Exists but it need to be completed and verified',
        );
      }
      if (image) {
        schoolImage = await this.files.store(image, 'school');
        await this.files.use({ id: schoolImage?.id, dm: em });
      }
      let school = em.getRepository(School).create({
        logo: schoolImage?.id,
        name: params.name,
        owner: { id: res.id },
      });
      await em.getRepository(School).save(school);
      return em.getRepository(School).findOneBy({ id: school.id });
    });
  }
}
