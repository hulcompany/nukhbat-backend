import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../core/user/entity/user.entity';
import { School } from '../../school/entity/school.entity';
import { Track } from '../../curriculum/tracks/entity/track.entity';

@Entity()
// hey claude here is one profile per user
@Index(['userId'], { unique: true })
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  userId: UUID;

  @ManyToOne(() => User)
  user: User;

  // only the owning school toggles this; false blocks the StudentGuard.
  // The access window (expiry) lives on Subscription, not here.
  @Column({ default: true })
  active: boolean;

  @Column('uuid')
  schoolId: UUID;

  @ManyToOne(() => School, { eager: true })
  school: School;

  @Column('uuid')
  trackId: UUID;

  @ManyToOne(() => Track, { eager: true })
  track: Track;

  // cached counters — the running totals of the reward ledger (SUM(xp) /
  // SUM(gems) over LedgerEntry). Source of truth is the ledger; these are
  // updated in the same transaction as each ledger insert, for cheap reads.
  @Column('int', { default: 0 })
  xp: number;

  @Column('int', { default: 0 })
  gems: number;

  @CreateDateColumn()
  createdAt: Date;
}
