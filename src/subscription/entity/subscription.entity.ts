import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { StudentProfile } from '../../student/entity/student-profile.entity';

export enum SubscriptionType {
  freeTrial = 'freeTrial',
  paid = 'paid',
}

// The access window lives here (not on StudentProfile): one row per grant,
// so a profile accumulates a history of trial → paid → renewals. "Currently
// subscribed" = a row for this profile whose expireDate is still in the future.
@Entity()
@Index(['studentProfileId', 'expireDate'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'enum', enum: SubscriptionType })
  type: SubscriptionType;

  @Column('timestamptz')
  expireDate: Date;

  // school + track are NOT duplicated here — StudentProfile is the single
  // source of truth for them (immutable, first-touch)
  @Column('uuid')
  studentProfileId: UUID;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  studentProfile: StudentProfile;

  @CreateDateColumn()
  createdAt: Date;

  @Expose()
  get isExpired() {
    return this.expireDate < new Date();
  }
}
