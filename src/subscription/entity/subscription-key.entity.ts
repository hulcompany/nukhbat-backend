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

@Entity()
@Index(['schoolId', 'trackId'])
export class SubscriptionKey {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  // generated server-side, never client-supplied
  @Column({ unique: true })
  key: string;

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
