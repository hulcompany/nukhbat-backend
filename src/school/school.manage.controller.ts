import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchoolCreateDto, SchoolEditDto } from './dto/school.dto';
import { SchoolGetDto } from './dto/school.get.dto';
import { UUID } from 'crypto';
import { JwtGuardStrict } from '../core/auth';
import { SchoolService } from './school.service';
import { ImageFileValidatorPipeline } from '../common';
import { RoleGuard, RoleType } from '../core';

@UseGuards(JwtGuardStrict, RoleGuard([RoleType.admin]))
@Controller('school/manage')
@UsePipes(
  new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  }),
)
export class SchoolManageController {
  constructor(private readonly schoolService: SchoolService) {}
  @Get()
  async getByCriteria(@Query() query: SchoolGetDto) {
    return await this.schoolService.getByCriteria(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.schoolService.findOne({ id });
  }

  @UseInterceptors(FileInterceptor('image'))
  @Patch(':id')
  async editSchool(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() body: SchoolEditDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File | null,
  ) {
    return await this.schoolService.edit({ id }, body, image);
  }

  @UseInterceptors(FileInterceptor('image'))
  @Post()
  async createSchool(
    @Body() body: SchoolCreateDto,
    @UploadedFile(new ImageFileValidatorPipeline(false))
    image?: Express.Multer.File,
  ) {
    return await this.schoolService.createSchool(body, image);
  }

  @Delete(':id/image')
  async removeSchoolImage(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.schoolService.deleteImage({ id });
  }
}
