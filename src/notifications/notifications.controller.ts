import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuardStrict, RoleGuard, RoleType } from '../core';
import { StrictValidation } from '../common';
import { Context } from '../context';
import { NotificationsService } from './notifications.service';
import {
  DeviceTokenDto,
  NotificationGetDto,
  SendNotificationDto,
} from './dto/notification.dto';

@Controller('notifications')
@UseGuards(JwtGuardStrict)
@StrictValidation()
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly ctxt: Context,
  ) {}

  // Register the caller's device token so future notifications reach it.
  @Post('subscribe')
  async subscribe(@Body() body: DeviceTokenDto) {
    return await this.service.subscribe(this.ctxt.user.id, body.deviceToken);
  }

  // Remove the caller's device token.
  @Post('unsubscribe')
  async unsubscribe(@Body() body: DeviceTokenDto) {
    return await this.service.unsubscribe(this.ctxt.user.id, body.deviceToken);
  }

  // The caller's own notifications, paginated.
  @Get('me')
  async getMyNotifications(@Query() query: NotificationGetDto) {
    return await this.service.getMyNotifications(this.ctxt.user.id, query);
  }

  // Admin: send a notification to a specific user.
  @Post('send')
  @UseGuards(RoleGuard([RoleType.admin]))
  async send(@Body() body: SendNotificationDto) {
    return await this.service.send(body);
  }
}
