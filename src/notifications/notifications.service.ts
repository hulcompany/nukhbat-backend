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
import { AppEvent, DailyReportNotificationEvent, OnEvent } from '../event';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    private readonly firebase: FirebaseService,
  ) {}

  async subscribe(userId: UUID, token: string) {
    await this.deviceTokens
      .createQueryBuilder()
      .insert()
      .values({ userId, token })
      .orIgnore()
      .execute();
  }

  async unsubscribe(userId: UUID, token: string) {
    await this.deviceTokens.delete({ userId, token });
  }

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
    try {
      const tokens = (
        await this.deviceTokens.find({
          where: { userId: In(userIds) },
          select: { token: true },
        })
      ).map((d) => d.token);

      if (tokens.length) {
        let messaging = this.firebase.getMessaging();
        await messaging.sendEach(
          tokens.map((e) => ({
            token: e,
            notification: {
              title: dto.title,
              body: dto.description,
            },
          })),
        );
      }
    } catch (e) {
      console.log(e);
    }
    return notifications;
  }

  async sendToTopic(
    topic: NotificationTopic,
    payload: { title: string; description: string },
  ) {
    try {
      let messaging = this.firebase.getMessaging();
      await messaging.send({
        notification: {
          title: payload.title,
          body: payload.description,
        },
        topic: topic,
      });
    } catch (e) {
      console.log(e);
    }
  }

  async getNotificationStats(userId: UUID) {
    return {
      unRead: await this.notifications.count({
        where: { userId: userId, isRead: false },
      }),
      unOpen: await this.notifications.count({
        where: { userId: userId, isOpen: false },
      }),
      total: await this.notifications.count({
        where: { userId: userId },
      }),
    };
  }

  async readNotifications(userId: UUID, ids: UUID[]) {
    await this.notifications.update(
      { userId: userId, id: In(ids) },
      { isRead: true },
    );
  }

  async openNotifications(userId: UUID, ids: UUID[]) {
    await this.notifications.update(
      { userId: userId, id: In(ids) },
      { isRead: true, isOpen: true },
    );
  }

  @OnEvent(AppEvent.DailyReportNotification)
  async onDailyReport(event: DailyReportNotificationEvent) {
    await this.send({
      userId: event.userIds as UUID[],
      title: event.title,
      description: event.description,
    });
  }
}
