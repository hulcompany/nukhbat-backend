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
          phoneNumber: params.phoneNumber,
        },
        em,
      );
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

  async getStatistics(schoolId: UUID) {
    const result = await this.ds.query(
      `
    SELECT
      (
        SELECT COUNT(*)
        FROM student_profile sp
        WHERE sp."schoolId" = $1
      ) AS total_students,

      (
        SELECT COUNT(*)
        FROM student_profile sp
        WHERE sp."schoolId" = $1
        AND sp.active = false
      ) AS blocked_students,

      (
        SELECT COUNT(*)
        FROM student_profile sp
        WHERE sp."schoolId" = $1
        AND sp.active = true
      ) AS active_students,

      (
        SELECT COUNT(*)
        FROM subscription s
        INNER JOIN student_profile sp
          ON sp.id = s."studentProfileId"
        WHERE sp."schoolId" = $1
        AND s."expireDate" > NOW()
      ) AS active_subscriptions,

      (
        SELECT COUNT(*)
        FROM subscription s
        INNER JOIN student_profile sp
          ON sp.id = s."studentProfileId"
        WHERE sp."schoolId" = $1
        AND s."expireDate" <= NOW()
      ) AS expired_subscriptions,

      (
        SELECT COUNT(*)
        FROM subscription_key sk
        WHERE sk."schoolId" = $1
        AND sk."usedById" IS NULL
      ) AS unused_keys,

      (
        SELECT COUNT(DISTINCT sa."studentId")
        FROM student_activity sa
        INNER JOIN student_profile sp
          ON sp.id = sa."studentId"
        WHERE sp."schoolId" = $1
        AND sa.date = CURRENT_DATE
      ) AS opened_today_students,

      (
        SELECT COUNT(*)
        FROM student_profile sp
        WHERE sp."schoolId" = $1
        AND NOT EXISTS (
          SELECT 1
          FROM student_activity sa
          WHERE sa."studentId" = sp.id
          AND sa.date = CURRENT_DATE
        )
      ) AS not_opened_today_students
    `,
      [schoolId],
    );

    return {
      totalStudents: Number(result[0].total_students),
      blockedStudents: Number(result[0].blocked_students),
      activeStudents: Number(result[0].active_students),
      activeSubscriptions: Number(result[0].active_subscriptions),
      expiredSubscriptions: Number(result[0].expired_subscriptions),
      unusedKeys: Number(result[0].unused_keys),
      openedTodayStudents: Number(result[0].opened_today_students),
      notOpenedTodayStudents: Number(result[0].not_opened_today_students),
    };
  }
}
