import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { UUID } from 'crypto';
import { BasePaginationDto } from 'core';

// deviceToken is carried in both subscribe and unsubscribe requests — the
// client owns the FCM token and hands it to us on each call.
export class DeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  deviceToken: string;
}

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: UUID;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class NotificationGetDto extends BasePaginationDto {}

export class StatsDto {
  @IsUUID('4', { each: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty()
  ids: UUID[];
}
