import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Question } from './questions.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
export class QuestionTrueOrFalse {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('boolean')
  value: boolean;

  @OneToOne(() => Question, (q) => q.matchingItems, { onDelete: 'CASCADE' })
  question: Question;

  @RelationId((m: QuestionTrueOrFalse) => m.question)
  questionId: UUID;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  school: School;

  @RelationId((m: QuestionTrueOrFalse) => m.school)
  schoolId: UUID;
}
