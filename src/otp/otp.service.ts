import { BadRequestException, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import * as bc from 'bcrypt';
import { UUID } from 'node:crypto';
import { ErrorCommonCodes } from 'core';
import { Otp, OtpReason } from './entity/otp';
import { AppConfig } from '../conf';
export class OtpService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  readonly expire = 20 * 60 * 1000;

  async findOtp(usageId: UUID, reason: OtpReason): Promise<Otp | null> {
    let res = await this.redis.get(usageId + '.' + reason);

    if (!res) {
      return null;
    }
    return Otp.fromRedis(res);
  }

  async sendOtp(usageId: UUID, reason: OtpReason) {
    let oldOtp = await this.findOtp(usageId, reason);

    if (oldOtp) {
      let time = AppConfig.OTP_SEPERATIONS[oldOtp.attempts - 1];
      let diff = new Date().getTime() - oldOtp.issuedAt;
      if (diff < time) {
        return { nextAttempt: new Date(oldOtp.issuedAt + time), sent: false };
      }
      if (oldOtp.attempts >= 5) {
        oldOtp.attempts = 1;
      } else {
        oldOtp.attempts++;
      }
      time = AppConfig.OTP_SEPERATIONS[oldOtp.attempts - 1];
      oldOtp.issuedAt = new Date().getTime();
      oldOtp.hash = await bc.hash('123456', 10);
      await this.redis.set(usageId, oldOtp.toRedis());
      await this.redis.expire(`${usageId}.${reason}`, 24 * 60 * 60 * 1000);
      return { nextAttempt: new Date(oldOtp.issuedAt + time), sent: true };
    }
    let newOtp = new Otp({
      usageId: usageId,
      reason: reason,
      issuedAt: new Date().getTime(),
      hash: await bc.hash('123456', 10),
      attempts: 1,
    });
    await this.redis.set(`${usageId}.${reason}`, newOtp.toRedis());
    await this.redis.expire(`${usageId}.${reason}`, 24 * 60 * 60 * 1000);
    return {
      nextAttempt: new Date(
        newOtp.issuedAt + AppConfig.OTP_SEPERATIONS[newOtp.attempts - 1],
      ),
      sent: true,
    };
  }

  async verifyOtp(usageId: UUID, reason: OtpReason, code: string) {
    let res = await this.redis.get(`${usageId}.${reason}`);
    if (!res) {
      throw new BadRequestException({
        message: 'Error code',
        code: ErrorCommonCodes.wrongOtp,
      });
    }
    let otp = Otp.fromRedis(res);
    let expire = new Date(otp.issuedAt + this.expire);
    if (new Date() > expire) {
      throw new BadRequestException({
        message: 'Code Expired',
        code: ErrorCommonCodes.wrongOtp,
      });
    }
    if (!(await bc.compare(code, otp.hash))) {
      throw new BadRequestException({
        message: 'Code Wrong',
        code: ErrorCommonCodes.wrongOtp,
      });
    }
  }

  async deleteOtp(id: UUID, reason: OtpReason) {
    await this.redis.del(`${id}.${reason}`);
    return true;
  }
}
