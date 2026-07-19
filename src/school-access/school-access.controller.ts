import {
  Body,
  Controller,
  Delete,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../core';

import { SchoolAccessService } from './school-access.service';
import { SchoolAccessDto } from './dto/school-access.dto';

@Controller('school-access')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
@UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
export class SchoolAccessController {
  constructor(private readonly schoolAccessService: SchoolAccessService) {}

  @Post()
  async grant(@Body() dto: SchoolAccessDto) {
    await this.schoolAccessService.grantAccess(dto);

    return {
      message: 'Access granted',
    };
  }

  @Delete()
  async revoke(@Body() dto: SchoolAccessDto) {
    await this.schoolAccessService.revokeAccess(dto);

    return {
      message: 'Access revoked',
    };
  }
}
