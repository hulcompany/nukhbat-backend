import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Unit } from '../../units/entity/unit.entity';
import { UUID } from 'crypto';
import { School } from '../../../school/entity/school.entity';
import { LessonStatusType } from './lesson.status.type';
import { Question } from '../../questions/entity/questions.entity';
import { Exclude } from 'class-transformer';

@Index(['schoolId', 'unitId', 'index'])
@Entity()
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @ManyToOne(() => Unit)
  unit: Unit;

  @Column('uuid')
  unitId: UUID;

  @Column('int')
  index: number;

  @ManyToOne(() => School)
  school: School;

  @Column('uuid')
  schoolId: UUID;

  @Column({
    enum: Object.values(LessonStatusType),
    type: 'enum',
    default: LessonStatusType.draft,
  })
  status: LessonStatusType;

  @OneToMany(() => Question, (q) => q.lesson)
  @Exclude()
  questions: Question[];

  // Transient (not a column): true once a student has any attempt on the
  // lesson, so its content is frozen. Stamped by LessonService reads from the
  // LessonUsed table; undefined on lessons fetched through other paths.
  used?: boolean;
}
