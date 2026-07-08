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
import { Track } from '../../learning/tracks/entity/track.entity';

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

  @CreateDateColumn()
  createdAt: Date;
}
