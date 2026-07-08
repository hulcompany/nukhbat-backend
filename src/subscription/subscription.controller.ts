import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { SchoolOwnerGuard } from '../school/guards/school-owner.guard';
import { StrictValidation } from '../common';
import { Context } from '../context';
import { SubscriptionService } from './service/subscription.service';
import { SubscriptionKeyService } from './service/subscription-key.service';
import {
  SubscribeDto,
  SubscribeFreeTrialDto,
  SubscriptionGetDto,
  SubscriptionKeyCreateManyDto,
  SubscriptionKeyGetDto,
  SubscriptionKeySchoolGetDto,
} from './dto/subscription.dto';
import { IdsDto } from '../common/dto/ids.dto';

@Controller('subscription')
@UseGuards(JwtGuardStrict)
@StrictValidation()
export class SubscriptionController {
  constructor(
    private readonly service: SubscriptionService,
    private readonly keys: SubscriptionKeyService,
    private readonly ctxt: Context,
  ) {}

  @Post('subscribe')
  @UseGuards(RoleGuard([RoleType.student]))
  async subscribe(@Body() body: SubscribeDto) {
    return await this.service.subscribe({
      key: body.key,
      userId: this.ctxt.user.id,
    });
  }

  @Post('freeTrial')
  @UseGuards(RoleGuard([RoleType.student]))
  async freeTrial(@Body() body: SubscribeFreeTrialDto) {
    return await this.service.freeTrial(this.ctxt.user.id, body.trackId);
  }

  // the caller's own latest subscription (live or expired). Now that expiry
  // lives on Subscription (not the profile), the client reads it here to show
  // remaining time / prompt a renewal.
  @Get('me')
  @UseGuards(RoleGuard([RoleType.student]))
  async getMySubscription() {
    return await this.service.findLatestByUser(this.ctxt.user.id);
  }

  // admin: paginate/filter every subscription (userId, type, status)
  @Get()
  @UseGuards(RoleGuard([RoleType.admin]))
  async getSubscriptions(@Query() query: SubscriptionGetDto) {
    return await this.service.getByCriteria(query);
  }

  // owner view: pinned to their school; the DTO has no schoolId field
  @Get('keys/school')
  @UseGuards(RoleGuard([RoleType.contentWriter]), SchoolOwnerGuard)
  async getKeysSchool(@Query() query: SubscriptionKeySchoolGetDto) {
    return await this.keys.getByCriteria({
      ...query,
      schoolId: this.ctxt.school.id,
    });
  }

  @Get('keys')
  @UseGuards(RoleGuard([RoleType.admin]))
  async getKeys(@Query() query: SubscriptionKeyGetDto) {
    return await this.keys.getByCriteria(query);
  }

  @Post('keys')
  @UseGuards(RoleGuard([RoleType.admin]))
  async createKeys(@Body() body: SubscriptionKeyCreateManyDto) {
    return await this.keys.createMany({
      trackId: body.trackId,
      count: body.count,
      schoolId: body.schoolId,
    });
  }

  @Delete('keys/:id')
  @UseGuards(RoleGuard([RoleType.admin]))
  async deleteKey(@Param('id', ParseUUIDPipe) id: UUID) {
    return await this.keys.delete({ id: id });
  }

  // bulk delete via POST — DELETE request bodies get dropped by some
  // proxies/clients, and this route mutates more than one resource anyway
  @Post('keys/bulk-delete')
  @UseGuards(RoleGuard([RoleType.admin]))
  async deleteKeys(@Body() body: IdsDto) {
    return await this.keys.deleteMany(body.ids);
  }
}
