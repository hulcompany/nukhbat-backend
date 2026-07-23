import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Track } from '../../tracks/entity/track.entity';
import { UUID } from 'crypto';

@Entity()
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column()
  title: string;

  @Column('uuid')
  trackId: UUID;

  @ManyToOne(() => Track)
  track: Track;

  @CreateDateColumn()
  createdAt: Date;
}
