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
import { QuestionClassifyType } from './enum/question-classify.type';

@Entity()
@Index('uq_question_classify_question_index', ['question', 'index'], {
  unique: true,
})
export class QuestionClassify {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column({
    type: 'enum',
    enum: QuestionClassifyType,
  })
  type: QuestionClassifyType;

  // 0-based position exactly as sent by the creator.
  // Never rely on database row order.
  @Column('int')
  index: number;

  // Only for ITEM rows.
  // Points to the index of the correct CATEGORY row.
  // null for CATEGORY rows.
  @Column('int', { nullable: true })
  correctCategoryIndex: number | null;

  @ManyToOne(() => Question, (q) => q.classifyItems, {
    onDelete: 'CASCADE',
  })
  question: Question;

  @RelationId((c: QuestionClassify) => c.question)
  questionId: UUID;

  @ManyToOne(() => School, {
    onDelete: 'CASCADE',
  })
  school: School;

  @RelationId((c: QuestionClassify) => c.school)
  schoolId: UUID;
}
