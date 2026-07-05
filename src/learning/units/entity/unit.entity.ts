import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from '../../course/entity/course.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
@Index(['courseId', 'index', 'schoolId'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column()
  title: string;

  @Column('uuid')
  courseId: UUID;

  @ManyToOne(() => Course)
  course: Course;

  @Column('uuid')
  schoolId: UUID;

  @ManyToOne(() => School)
  school: School;

  @Column('int')
  index: number;
}
