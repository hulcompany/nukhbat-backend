import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { JwtGuard, RoleGuard, RoleType } from '../core';
import { IdsDto } from '../common/dto/ids.dto';
import { DailyWisementService } from './daily-wisement.service';
import {
  DailyWisementBulkCreateDto,
  DailyWisementCreateDto,
  DailyWisementEditDto,
  DailyWisementGetDto,
} from './dto/daily-wisement.dto';

@Controller('daily-wisement')
@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    whitelist: true,
    transform: true,
  }),
)
export class DailyWisementController {
  constructor(private readonly service: DailyWisementService) {}

  // public: today's wisement (picks one on demand when none is selected)
  @Get('today')
  getToday() {
    return this.service.getToday();
  }

  @Get('')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  getAll(@Query() query: DailyWisementGetDto) {
    return this.service.getByCriteria(query);
  }

  @Post('')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  create(@Body() dto: DailyWisementCreateDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  createMany(@Body() dto: DailyWisementBulkCreateDto) {
    return this.service.createMany(dto.items);
  }

  // bulk delete via POST — DELETE request bodies get dropped by some
  // proxies/clients
  @Post('bulk-delete')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  deleteMany(@Body() dto: IdsDto) {
    return this.service.deleteMany(dto.ids);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  update(
    @Param('id', new ParseUUIDPipe()) id: UUID,
    @Body() dto: DailyWisementEditDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  delete(@Param('id', new ParseUUIDPipe()) id: UUID) {
    return this.service.delete(id);
  }
}
