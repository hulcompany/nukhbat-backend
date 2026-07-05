import { UUID } from 'node:crypto';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum FileStatus {
  used = 'used',
  unUsed = 'unused',
}

@Entity()
export class AppFile {
  @PrimaryGeneratedColumn('uuid')
  id!: UUID;
  @Column('text')
  key!: string;
  @Column('text')
  type!: string;
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
  @Column({
    type: 'enum',
    enum: Object.values(FileStatus),
    default: FileStatus.unUsed,
  })
  status!: FileStatus;
}
