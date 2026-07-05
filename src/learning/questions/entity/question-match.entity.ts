import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Question } from './questions.entity';
import { School } from '../../../school/entity/school.entity';
import { QuestionMatchType } from './enum/question-match.type';

@Entity()
export class QuestionMatch {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column({ type: 'enum', enum: QuestionMatchType })
  type: QuestionMatchType;

  // Only set on BASE rows → points to the correct MATCH row.
  // null on MATCH rows, and null on a BASE that matches nothing.
  @ManyToOne(() => QuestionMatch, { nullable: true, onDelete: 'SET NULL' })
  correctMatch: QuestionMatch | null;

  @Column('uuid', { nullable: true })
  correctMatchId: UUID | null;

  @ManyToOne(() => Question, (q) => q.matchingItems, { onDelete: 'CASCADE' })
  question: Question;

  @RelationId((m: QuestionMatch) => m.question)
  questionId: UUID;

  @ManyToOne(() => School)
  school: School;

  @RelationId((m: QuestionMatch) => m.school)
  schoolId: UUID;
}