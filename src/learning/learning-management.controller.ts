import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../core';
import { UUID } from 'crypto';
import { SchoolAccessService } from './school-access/school-access.service';

@Controller('learning/admin')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
@UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
export class LearningManagementController {
  constructor(private service: SchoolAccessService) {}
  @Post('schoolAccess/:schoolId/:trackId')
  async assignTrack(
    @Param('schoolId') schoolId: UUID,
    @Param('trackId') trackId: UUID,
  ) {
    return this.service.allow({ schoolId: schoolId, trackId: trackId });
  }

  @Delete('schoolAccess/:schoolId/:trackId')
  async unAssignTrack(
    @Param('schoolId') schoolId: UUID,
    @Param('trackId') trackId: UUID,
  ) {
    return this.service.unAllow({ schoolId: schoolId, trackId: trackId });
  }
}
