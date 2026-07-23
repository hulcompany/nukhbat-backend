import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ unique: true })
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}
