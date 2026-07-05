import { UUID } from 'crypto';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../core/user/entity/user.entity';
import { SchoolAccess } from '../../learning/school-access/entity/school-access.entity';
import { Exclude, Expose } from 'class-transformer';

@Entity()
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;
  @Column('text')
  name: string;
  @Column('uuid', { nullable: true })
  logo?: UUID | null;
  @OneToOne(() => User, { eager: true })
  @JoinColumn()
  owner: User;
  @OneToMany(() => SchoolAccess, (v) => v.school)
  @Exclude()
  schoolAccess: SchoolAccess[];

  @Expose()
  get allowedTracks() {
    return this.schoolAccess?.map((e) => e.track);
  }

  get allowedTrackIds() {
    return this.schoolAccess?.map((e) => e.track.id);
  }
}
