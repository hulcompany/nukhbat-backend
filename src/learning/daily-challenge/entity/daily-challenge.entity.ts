import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { School } from '../../../school/entity/school.entity';
import { Track } from '../../tracks/entity/track.entity';
import { DailyChallengeUsedQuestions } from './daily-challenge-used-questions.entity';

// one challenge per (school, track) per day — a school with access to
// three tracks gets three challenges each day
@Entity()
@Index(['school.id', 'track.id', 'date'], { unique: true })
export class DailyChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('date')
  date: string;

  @ManyToOne(() => School, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  school: UUID | School;

  @ManyToOne(() => Track, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  track: Track;

  @OneToMany(() => DailyChallengeUsedQuestions, (v) => v.challenge)
  usedQuestions: DailyChallengeUsedQuestions[];
}
