import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// A notification addressed to a single user. This is the persisted record the
// user reads back through `GET me`; actual delivery to devices happens through
// the (currently stubbed) firebase layer and is not reflected here.
@Entity()
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column()
  title: string;

  @Column('uuid')
  @Index()
  userId: UUID;

  @Column('text')
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
