import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Question } from './questions.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
export class QuestionOption {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column()
  isCorrect: boolean;

  @ManyToOne(() => Question, (q) => q.options, { onDelete: 'CASCADE' })
  question: Question;

  @RelationId((o: QuestionOption) => o.question)
  questionId: UUID;

  @ManyToOne(() => School)
  school: School;

  @RelationId((o: QuestionOption) => o.school)
  schoolId: UUID;
}
