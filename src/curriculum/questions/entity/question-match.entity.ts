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
import { QuestionMatchType } from './enum/question-match.type';

@Entity()
// (question, index) not (index, question): the query is always
// WHERE questionId = ? ORDER BY index — equality column first, sort last
@Index('uq_question_match_question_index', ['question', 'index'], {
  unique: true,
})
export class QuestionMatch {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column({ type: 'enum', enum: QuestionMatchType })
  type: QuestionMatchType;

  // 0-based position within this question's matchingItems, exactly as sent.
  // Stored rather than inferred from row order, which Postgres never
  // guarantees — the delete-and-reinsert every edit does would drift it.
  @Column('int')
  index: number;

  // Only set on BASE rows → the `index` of the correct MATCH row of this
  // question. null on MATCH rows, and on a BASE that matches nothing.
  // Refers to a value, not a row position, so it survives any read order.
  @Column('int', { nullable: true })
  correctIndex: number | null;

  @ManyToOne(() => Question, (q) => q.matchingItems, { onDelete: 'CASCADE' })
  question: Question;

  @RelationId((m: QuestionMatch) => m.question)
  questionId: UUID;

  @ManyToOne(() => School)
  school: School;

  @RelationId((m: QuestionMatch) => m.school)
  schoolId: UUID;
}
