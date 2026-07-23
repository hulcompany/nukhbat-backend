import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { SavedQuestionService } from './saved-question.service';
import { SaveQuestionDto } from './dto/saved-question.dto';
import { Context, ReqContext } from '../../context';
import { JwtGuardStrict } from '../../core';
import { SubscriptionGuard } from '../../subscription/guard/subscription.guard';

@Controller('learning/saved-questions')
@UseGuards(JwtGuardStrict, SubscriptionGuard())
export class SavedQuestionController {
  constructor(
    private readonly service: SavedQuestionService,
    private readonly ctxt: Context,
  ) {}

  @Post()
  async save(@Body() dto: SaveQuestionDto) {
    await this.service.save(this.ctxt.student!.id, dto.questionId);
  }

  @Delete()
  async unSave(@Body() dto: SaveQuestionDto) {
    await this.service.remove({
      questionId: dto.questionId,
      studentProfile: { id: this.ctxt.student!.id },
    });
  }

  @Get()
  async getSaved() {
    await this.service.findAll(this.ctxt.student!.id);
  }
}
