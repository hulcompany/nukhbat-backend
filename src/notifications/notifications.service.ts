import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UUID } from 'crypto';
import { BasePaginationModel, SortType } from 'core';

import { Notification } from './entity/notification.entity';
import { DeviceToken } from './entity/device-token.entity';
import { NotificationGetDto } from './dto/notification.dto';
import { NotificationTopic } from './enum/notification-topic.enum';
import { FirebaseService } from '../firebase/firebase-service';
import {
  AppEvent,
  DailyReportNotificationEvent,
  OnEvent,
} from '../event';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    private readonly firebase: FirebaseService,
  ) {}

  // Register a device token for the caller. Idempotent: re-subscribing the same
  // (userId, token) pair is a no-op rather than an error, so a client that
  // resends its token on every launch never trips the unique constraint.
  async subscribe(userId: UUID, token: string) {
    await this.deviceTokens
      .createQueryBuilder()
      .insert()
      .values({ userId, token })
      .orIgnore()
      .execute();
  }

  // Drop a device token for the caller (e.g. on logout / token refresh).
  async unsubscribe(userId: UUID, token: string) {
    await this.deviceTokens.delete({ userId, token });
  }

  // The caller's notifications, newest first, paginated.
  async getMyNotifications(userId: UUID, query: NotificationGetDto) {
    const [list, totalRecords] = await this.notifications.findAndCount({
      where: { userId },
      order: { createdAt: query.sort ?? SortType.Desc },
      skip: query.skip ?? 0,
      take: query.limit ?? 10,
    });

    return new BasePaginationModel({
      list,
      totalRecords,
      skip: query.skip,
      limit: query.limit,
    });
  }

  // Persist a notification for one user or many, then push it to every device
  // those users have registered. `userId` accepts a single id or a list so the
  // same path serves the admin "send to one user" endpoint and fan-out from
  // domain events (e.g. the daily report to a whole track). If nobody has a
  // registered device token we still keep the records and simply return them —
  // there is nothing to deliver.
  async send(dto: {
    userId: UUID | UUID[];
    title: string;
    description: string;
  }) {
    const userIds = Array.isArray(dto.userId) ? dto.userId : [dto.userId];
    if (!userIds.length) return [];

    const notifications = await this.notifications.save(
      userIds.map((userId) =>
        this.notifications.create({
          userId,
          title: dto.title,
          description: dto.description,
        }),
      ),
    );

    const tokens = (
      await this.deviceTokens.find({
        where: { userId: In(userIds) },
        select: { token: true },
      })
    ).map((d) => d.token);

    // firebase impl kept empty for now — space for the real push here.
    // if (tokens.length) {
    //   await this.firebase.sendToTokens(tokens, {
    //     title: dto.title,
    //     body: dto.description,
    //   });
    // }
    void tokens;

    return notifications;
  }

  // Broadcast to a topic. No persistence and no per-user tokens involved —
  // the push provider owns topic membership.
  async sendToTopic(
    topic: NotificationTopic,
    payload: { title: string; description: string },
  ) {
    // firebase impl kept empty for now — space for the real topic push here.
    // await this.firebase.sendToTopic(topic, {
    //   title: payload.title,
    //   body: payload.description,
    // });
    void topic;
    void payload;
  }

  // dc -> getIds -> event -> notification: the daily-challenge flow resolves the
  // enrolled students and raises this event; we just persist + deliver.
  @OnEvent(AppEvent.DailyReportNotification)
  async onDailyReport(event: DailyReportNotificationEvent) {
    await this.send({
      userId: event.userIds as UUID[],
      title: event.title,
      description: event.description,
    });
  }
}
