import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID, UUID } from 'crypto';
import { AppConfig } from '../../conf';
import { QuestionSnapshot } from './types/question-snapshot.type';

// Redis-backed store for the frozen lesson snapshots that bridge /start and
// /solve. Each snapshot is the answer-key-bearing copy of a lesson's questions;
// /solve grades against it, then removes it. TTL-bounded so abandoned attempts
// clean themselves up.
@Injectable()
export class SnapshotsService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // one namespace so keys are easy to scan/flush
  private key(snapshotId: UUID) {
    return `qsnap:${snapshotId}`;
  }

  // freeze a snapshot under a fresh id and return it; the caller hands the id
  // to the client, which passes it back on /solve. Expires after
  // LESSON_SNAPSHOT_TTL_SEC.
  async addQuestionSnapshot(data: QuestionSnapshot): Promise<UUID> {
    const snapshotId = randomUUID();
    await this.redis.set(
      this.key(snapshotId),
      JSON.stringify(data),
      'EX',
      AppConfig.LESSON_SNAPSHOT_TTL_SEC,
    );
    return snapshotId;
  }

  // null when the id is unknown or the snapshot has expired
  async getQuestionSnapshot(
    snapshotId: UUID,
  ): Promise<QuestionSnapshot | null> {
    const raw = await this.redis.get(this.key(snapshotId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as QuestionSnapshot;
  }

  // called after a successful /solve; idempotent (del on a missing key is a
  // no-op)
  async removeQuestionSnapshot(snapshotId: UUID): Promise<void> {
    await this.redis.del(this.key(snapshotId));
  }
}
