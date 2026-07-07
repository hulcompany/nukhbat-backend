import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../core/user/entity/user.entity';
import { SchoolAccess } from '../../learning/school-access/entity/school-access.entity';
import { Exclude, Expose } from 'class-transformer';

@Entity()
@Index('uq_def_school', ['id', 'default'], {
  unique: true,
  where: '"default" IS NOT NULL AND "default" = True',
})
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
  @Column('boolean', { default: false })
  default: boolean;

  @Expose()
  get allowedTracks() {
    return this.schoolAccess?.map((e) => e.track);
  }

  get allowedTrackIds() {
    return this.schoolAccess?.map((e) => e.track.id);
  }
}
