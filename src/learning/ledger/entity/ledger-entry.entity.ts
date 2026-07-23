import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from '../../../student/entity/student-profile.entity';

// Append-only reward ledger — the durable source of truth for XP and gems.
// Attempt rows cascade away when their lesson/question is deleted, so rewards
// can't live there; here the source is stored as a plain uuid + name snapshot
// (NO FK), so a granted reward survives the content being deleted or moved.
//
// A row is never mutated or removed (except with the student). The cached
// `xp`/`gems` counters on StudentProfile are SUM()s over this table, written
// in the same transaction as the insert.
@Entity()
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @ManyToOne(() => StudentProfile, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  student: StudentProfile;

  @Column('uuid')
  studentId: UUID;

  // the source's title as it read when granted — keeps the ledger readable
  // after the lesson/unit is renamed or gone
  @Column()
  sourceName: string;

  // both columns present on every row; the reason decides which is non-zero,
  // so the profile counters are a flat SUM(xp) / SUM(gems)
  @Column('int', { default: 0 })
  xp: number;

  @Column('int', { default: 0 })
  gems: number;

  // scope for leaderboards / rollups without joining, same as LessonAttempt
  @Column('uuid')
  schoolId: UUID;

  @Column('uuid')
  trackId: UUID;

  // the "date" of the reward
  @CreateDateColumn()
  createdAt: Date;
}
