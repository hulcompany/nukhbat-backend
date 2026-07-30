import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

// A single user's device token (FCM registration token). The same user may have
// many devices, so the identity is the (userId, token) pair rather than either
// column alone. `subscribe`/`unsubscribe` add and remove rows here.
@Entity()
@Unique(['userId', 'token'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  @Index()
  userId: UUID;

  @Column('text')
  token: string;

  @CreateDateColumn()
  createdAt: Date;
}
