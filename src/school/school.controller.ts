import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StrictValidation } from '../common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { SchoolOwnerGuard } from './guards/school-owner.guard';
import { SchoolEditDto } from './dto/school.dto';
import { Context } from '../context';
import { SchoolService } from './school.service';

@Controller('school/me')
@UseGuards(
  JwtGuardStrict,
  RoleGuard([RoleType.contentWriter]),
  SchoolOwnerGuard,
)
@StrictValidation()
export class SchoolController {
  constructor(
    private readonly ctxt: Context,
    private readonly schoolService: SchoolService,
  ) {}

  @Patch()
  @UseInterceptors(FileInterceptor('image'))
  async edit(
    @Body() body: SchoolEditDto,
    @UploadedFile() image?: Express.Multer.File | null,
  ) {
    return await this.schoolService.edit(
      {
        owner: { id: this.ctxt.user.id },
      },
      body,
      image,
    );
  }

  @Get()
  async getMySchool() {
    return await this.schoolService.findOneOrFail({
      owner: { id: this.ctxt.user.id },
    });
  }

  @Delete('image')
  async deleteMyImage() {
    return await this.schoolService.deleteImage({
      owner: { id: this.ctxt.user.id },
    });
  }
}
