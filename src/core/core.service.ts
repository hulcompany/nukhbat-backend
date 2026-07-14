import { UUID } from 'crypto';
import { UserService } from './user/service/user.service';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserMainDto } from './dto/user-main.dto';
import { RoleType } from './role/enum/role.type';

@Injectable()
export class CoreService {
  constructor(private readonly userService: UserService) {}

  async findUserById(id: UUID) {
    return this.userService.findOneAndFail({ id: id });
  }

  async createUser(
    params: UserMainDto & { role?: RoleType },
    em?: EntityManager,
  ) {
    return this.userService.createUser(params, em);
  }
}
