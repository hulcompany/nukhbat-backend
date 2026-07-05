import { UUID } from 'crypto';
import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { School } from '../../../school/entity/school.entity';
import { Track } from '../../tracks/entity/track.entity';

@Entity()
@Unique(['school', 'track'])
export class SchoolAccess {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;
  @ManyToOne(() => School)
  school: School;
  @ManyToOne(() => Track)
  track: Track;
}
