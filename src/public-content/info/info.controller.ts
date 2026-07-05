import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtGuard, RoleGuard, RoleType } from '../../core';
import { InfoService } from './info.service';
import { InfoDto } from './dto/info.dto';

@Controller('public-content/info')
@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    whitelist: true,
    transform: true,
  }),
)
export class InfoController {
  constructor(private readonly service: InfoService) {}
  @Get()
  async get() {
    return await this.service.getInfo();
  }

  @Post()
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  async set(@Body() dto: InfoDto) {
    return this.service.saveInfo(dto);
  }
}
