import { Exclude, Expose, Transform } from 'class-transformer';
import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleType } from '../../role/enum/role.type';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name?: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  password?: string;

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

  @Column('uuid', { nullable: true })
  @Exclude()
  trackId?: UUID | null;

  @Expose()
  get isCompleted() {
    if (this.password && this.email && this.name) {
      return true;
    }
    return false;
  }
}
