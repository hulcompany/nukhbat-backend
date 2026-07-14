import { Exclude } from 'class-transformer';
import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  // UpdateDateColumn,
} from 'typeorm';
import { RoleType } from '../../role/enum/role.type';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  // unique across users; nullable because signup only has an email until the
  // profile is completed (Postgres allows many NULLs in a unique index)
  @Column({ type: 'varchar', length: 32, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password: string;

  @Column({ default: false })
  emailVerfied: boolean;

  @Column({
    type: 'enum',
    enum: Object.values(RoleType),
    default: RoleType.student,
  })
  role!: string;

  @Column('uuid', { nullable: true })
  profileImage?: UUID | null;

  @CreateDateColumn()
  createdAt: Date;

  // @Column('uuid', { nullable: true })
  // @Exclude()
  // trackId?: UUID | null;
}
