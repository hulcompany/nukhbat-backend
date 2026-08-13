import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID, UUID } from 'crypto';
import { Question } from '../../curriculum/questions/entity/questions.entity';
import {
  QuestionSnapshot,
  QuestionSnapshotContext,
} from './types/question-snapshot.type';
import { AppConfig } from '../../conf';

// const SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;

// Redis-backed store for frozen question snapshots.
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

  async addQuestionSnapshot(
    questions: Question[],
    context: QuestionSnapshotContext,
  ): Promise<UUID> {
    const snapshotId = randomUUID();
    const snapshot: QuestionSnapshot = {
      id: snapshotId,
      questions,
      ...context,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(
      this.key(snapshotId),
      JSON.stringify(snapshot),
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
