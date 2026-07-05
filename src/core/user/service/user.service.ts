import { setTimeout } from 'timers/promises';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';
import {
  applyPsqlFilter,
  BasePaginationModel,
  hashPassword,
  transaction,
} from 'core';
import { User } from '../entity/user.entity';
import { UserGetDto } from '../dto/user-get.dto';
import { UserResetPasswordDto } from '../dto/user-reset-password.dto';
import { UserForgetPasswordDto } from '../dto/user-forget-password.dto';
import { UserCompleteDto } from '../dto/user-complete.dto';
// import { UserCreateDto } from '../dto/user-create.dto';
import { OtpService } from '../../../otp/otp.service';
import { FileService } from '../../../file/file.service';
import { OtpReason } from '../../../otp/entity/otp';
import { UserMainDto } from '../dto/user-main.dto';
import { RoleType } from '../../role/enum/role.type';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @Inject() private readonly otpService: OtpService,
    private readonly fileService: FileService,
  ) {}

  async findOne(params: FindOptionsWhere<User>) {
    return await this.repo.findOne({ where: params });
  }

  async findOneAndFail(params: FindOptionsWhere<User>) {
    const user = await this.repo.findOne({ where: params });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: UUID,
    data?: DeepPartial<User>,
    image?: Express.Multer.File | null,
  ) {
    let fields = data || {};
    if (fields.password) {
      fields.password = await hashPassword(fields.password, 10);
    }
    delete (fields as any).confirmPassword;
    let fileIds: UUID[] = [];
    return await transaction(
      this.repo.manager.connection,
      async (em) => {
        let curr = await this.findOneAndFail({ id: id });
        let newImage = await this.fileService.replace({
          em,
          old: curr.profileImage || undefined,
          store: image,
          folder: 'users',
        });
        if (newImage) {
          fileIds.push(newImage);
        }
        fields.profileImage = newImage;
        await em.getRepository(User).update({ id }, fields);
        return await em.getRepository(User).findOne({ where: { id } });
      },
      {
        onError: async () => {
          this.fileService.cleanUp(fileIds);
        },
      },
    );
  }

  async completeUser(id: UUID, data: UserCompleteDto) {
    let fields = data || {};
    fields.password = await hashPassword(fields.password, 10);
    let user = await this.repo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isCompleted) {
      throw new BadRequestException('User Already Completed');
    }

    const result = await this.repo.update(
      { id },
      {
        name: fields.name,
        password: fields.password,
      },
    );
    return await this.repo.findOne({ where: { id } });
  }

  async getByCriteria(params?: UserGetDto) {
    const qb = this.repo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    applyPsqlFilter({
      queryBuilder: qb,
      query: params,
      options: {
        name: {
          regExp: { regexp: 'contains' },
        },
        email: {
          regExp: { regexp: 'contains' },
        },
      },
    });

    const [data, count] = await qb.getManyAndCount();

    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: params?.skip,
      limit: params?.limit,
    });
  }

  async signUp(data: Partial<User>) {
    let old = await this.repo.findOne({ where: { email: data.email } });
    if (old?.isCompleted) {
      throw new BadRequestException('Email Already Exists');
    }
    if (old) {
      return old;
    }
    if (data.password) {
      data.password = await hashPassword(data.password!, 10);
    }
    let user = this.repo.create(data);
    user.role = RoleType.student;
    user.emailVerfied = false;
    user = await this.repo.save(user);
    return user;
  }

  async createUser(
    data: UserMainDto & { role?: RoleType },
    em?: EntityManager,
  ) {
    let repo = em?.getRepository(User) || this.repo;
    let old = await repo.findOne({ where: { email: data.email } });
    if (old) {
      throw new BadRequestException('Email Already Exists');
    }
    data.password = await hashPassword(data.password!, 10);
    let user = repo.create(data);
    user.emailVerfied = true;
    user.role = data.role || RoleType.admin;
    user = await repo.save(user);
    return user;
  }

  async requestVerify(id: UUID) {
    let user = await this.repo.findOne({ where: { id: id } });
    if (!user) {
      throw new NotFoundException();
    }
    if (user.emailVerfied) {
      throw new BadRequestException('Email Already Verified');
    }
    let otp = await this.otpService.sendOtp(id, OtpReason.VERIFY);
    return otp;
  }

  async verify(data: { id: UUID; code: string }) {
    await this.otpService.verifyOtp(data.id, OtpReason.VERIFY, data.code);
    await this.otpService.deleteOtp(data.id, OtpReason.VERIFY);
    let user = await this.update(data.id, {
      emailVerfied: true,
    });
    return user;
  }

  async requestChangePassword(params: UserForgetPasswordDto) {
    let user = await this.repo.findOne({ where: { email: params.email } });
    if (!user) {
      throw new BadRequestException({ message: 'Email Is Wrong' });
    }

    let otp = await this.otpService.sendOtp(user.id, OtpReason.RESET_PASSWORD);
    return otp;
  }

  async resetPassword(params: UserResetPasswordDto) {
    let user = await this.findOneAndFail({
      email: params.email,
    });
    await this.otpService.verifyOtp(
      user.id,
      OtpReason.RESET_PASSWORD,
      params.code,
    );
    await this.otpService.deleteOtp(user.id, OtpReason.RESET_PASSWORD);
    await this.update(user.id, {
      password: params.newPassword,
    });
  }
}
