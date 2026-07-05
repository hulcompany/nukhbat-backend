export enum OtpReason {
  RESET_PASSWORD = 'Reset-Password',
  VERIFY = 'Verify',
}

export class Otp {
  usageId: string;

  hash: string;

  issuedAt: number;

  attempts: number;

  reason: OtpReason;

  constructor(params: {
    usageId: string;
    hash: string;
    issuedAt?: number;
    attempts?: number;
    reason: OtpReason;
  }) {
    this.usageId = params.usageId;
    this.hash = params.hash;
    this.issuedAt = params.issuedAt ?? Date.now();
    this.attempts = this.attempts ?? 1;
    this.reason = params.reason;
  }

  static fromRedis(raw: string): Otp {
    const obj = JSON.parse(raw);

    return new Otp({
      usageId: obj.userId,
      hash: obj.hash,
      issuedAt: obj.issuedAt,
      attempts: obj.attempts,
      reason: obj.reason,
    });
  }

  toRedis(): string {
    return JSON.stringify({
      userId: this.usageId,
      hash: this.hash,
      issuedAt: this.issuedAt,
      attempts: this.attempts,
      reason: this.reason,
    });
  }
}
