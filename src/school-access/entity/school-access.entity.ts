import { UUID } from 'crypto';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { School } from '../../school/entity/school.entity';
import { Track } from '../../learning/tracks/entity/track.entity';

// Plain schoolId/trackId columns drive the access checks (no relation load
// needed), while the ManyToOne sides let callers that list a school's tracks
// join through `school`/`track`. Both map the SAME columns via @JoinColumn.
@Entity()
@Unique(['schoolId', 'trackId'])
export class SchoolAccess {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  schoolId: UUID;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column('uuid')
  trackId: UUID;

  @ManyToOne(() => Track)
  @JoinColumn({ name: 'trackId' })
  track: Track;
}
