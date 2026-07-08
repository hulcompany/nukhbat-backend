import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { StrictValidation } from '../common';
import { Context } from '../context';
import { StudentProfileService } from './service/student-profile.service';
import { StudentGuard } from './guard/student.guard';
import {
  StudentActivationEditDto,
  StudentProfileGetDto,
  StudentProfileSchoolGetDto,
} from './dto/student.dto';
import { UUID } from 'crypto';
import { SchoolOwnerGuard } from '../school/guards/school-owner.guard';

@Controller('student')
@UseGuards(JwtGuardStrict)
@StrictValidation()
export class StudentController {
  constructor(
    private readonly profiles: StudentProfileService,
    private readonly ctxt: Context,
  ) {}

  // one profile per student (single school + track, never changes).
  // Bare guard: expired/deactivated students can still read their own
  // profile (so the client can prompt a renewal). school + track are
  // eager, so the guard-loaded profile already carries them.
  @Get('profile')
  @UseGuards(RoleGuard([RoleType.student]), StudentGuard())
  async getMyProfile() {
    return this.ctxt.student;
  }

  @Get('school')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async getStudents(@Query() query: StudentProfileSchoolGetDto) {
    return await this.profiles.getByCriteria({
      params: { ...query, schoolId: this.ctxt.school.id },
    });
  }

  @Get('school/:id')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async getStudent(@Param('id', ParseUUIDPipe) id: UUID) {
    // schoolId in the filter makes a foreign profile read as not-found
    return await this.profiles.findOneOrFail(
      { id: id, schoolId: this.ctxt.school.id },
      { user: true, track: true },
    );
  }

  // only the owning school activates/deactivates its students — schoolId
  // in the filter makes a foreign profile read as not-found
  @Patch('school/activation/:id')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async editStudent(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: StudentActivationEditDto,
  ) {
    return await this.profiles.update(
      { id: id, schoolId: this.ctxt.school.id },
      { active: body.active },
    );
  }

  @Get('')
  @UseGuards(RoleGuard([RoleType.admin]))
  async getAdminStudents(@Query() query: StudentProfileGetDto) {
    return await this.profiles.getByCriteria({
      params: query,
    });
  }

  @Get(':id')
  @UseGuards(RoleGuard([RoleType.admin]))
  async getAdminStudent(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.profiles.findOneOrFail(
      { id: id },
      { user: true, track: true },
    );
  }
}
