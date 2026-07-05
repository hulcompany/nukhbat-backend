import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class DailyWisement {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column({ default: false })
  selected: boolean;

  @Column({ default: false })
  usedPreviously: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
