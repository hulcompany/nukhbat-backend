import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Track } from '../../learning/tracks/entity/track.entity';
import { School } from '../../school/entity/school.entity';
import { Subscription } from './subscription.entity';

@Entity()
@Index(['schoolId', 'trackId'])
export class SubscriptionKey {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  // generated server-side, never client-supplied
  @Column({ unique: true })
  key: string;

  // single-use: null while available, set to the redeeming Subscription on
  // use (the key row is kept for audit, not deleted). SET NULL if that
  // subscription is ever deleted so the key isn't orphaned.
  @Column('uuid', { nullable: true })
  usedById: UUID | null;

  @ManyToOne(() => Subscription, { nullable: true, onDelete: 'SET NULL' })
  usedBy: Subscription | null;

  @Column('uuid')
  trackId: UUID;

  @ManyToOne(() => Track)
  track: Track;

  @Column('uuid')
  schoolId: UUID;

  @ManyToOne(() => School)
  school: School;

  @CreateDateColumn()
  createdAt: Date;
}
