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
import { FaqService } from './faq.service';
import { JwtGuard, RoleGuard, RoleType } from '../../core';
import { FaqCreateDto, FaqEditDto } from './dto/faq.dto';
import { UUID } from 'crypto';

@Controller('public-content/faqs')
@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    whitelist: true,
    transform: true,
  }),
)
export class FaqController {
  constructor(private readonly service: FaqService) {}

  @Post('')
  @UseGuards(JwtGuard, RoleGuard([RoleType.admin]))
  create(@Body() dto: FaqCreateDto) {
    return this.service.createFaq(dto);
  }

  @Get('')
  getAll() {
    return this.service.getAllFaqs();
  }

  @Patch(':id')
  edit(@Param('id', new ParseUUIDPipe()) id: UUID, @Body() dto: FaqEditDto) {
    return this.service.edit(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: UUID) {
    return this.service.delete(id);
  }
}
