import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  RelationId,
  Index,
} from 'typeorm';
import { UUID } from 'crypto';
import { Question } from './questions.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
@Index('uq_question_order_question_index', ['question', 'index'], {
  unique: true,
})
export class QuestionOrder {

  @PrimaryGeneratedColumn('uuid')
  id: UUID;


  @Column('text')
  text: string;

  @Column('int')
  sort: number;

  @Column('int')
  index: number;


  @ManyToOne(() => Question, q => q.orderItems, {
    onDelete: 'CASCADE',
  })
  question: Question;


  @RelationId((o: QuestionOrder) => o.question)
  questionId: UUID;


  @ManyToOne(() => School, {
    onDelete: 'CASCADE',
  })
  school: School;


  @RelationId((o: QuestionOrder) => o.school)
  schoolId: UUID;
}