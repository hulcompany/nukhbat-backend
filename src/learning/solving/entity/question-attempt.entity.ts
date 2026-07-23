import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from '../../../student/entity/student-profile.entity';
import { LessonAttempt } from './lesson-attempt.entity';
import { Question, QuestionType, QuestionVerdict } from '../../../curriculum';

// One row per graded question within a LessonAttempt — the granular trace.
// Expendable by design: a hard FK to Question means deleting the question
// cascades these away, but the parent LessonAttempt keeps its aggregate marks,
// so history/stats survive; you just lose the drill-down on a gone question.
//
// A question deleted mid-flight (between /start and /solve) is skipped at
// persist — no row here — but still counted in the LessonAttempt totals + XP.
@Entity()
// "how has this student done on this question" — mastery over time
@Index(['studentId', 'questionId'])
export class QuestionAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @ManyToOne(() => LessonAttempt, (v) => v.questionAttempts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  lessonAttempt: LessonAttempt;

  @Column('uuid')
  lessonAttemptId: UUID;

  @ManyToOne(() => StudentProfile, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  student: StudentProfile;

  @Column('uuid')
  studentId: UUID;

  @ManyToOne(() => Question, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  question: Question;

  @Column('uuid')
  questionId: UUID;

  // snapshot of the question's type — lets review render this row without
  // touching the (possibly changed or deleted) live question
  @Column({ type: 'enum', enum: QuestionType })
  questionType: QuestionType;

  // --- marks (frozen at solve) ---
  // this question's raw score / max (for MATCH, partial: correct pairs / total)
  @Column('int')
  score: number;

  @Column('int')
  total: number;

  // score == total
  @Column('boolean')
  isCorrect: boolean;

  // the frozen verdict object from checkAnswers for this one question — embeds
  // what the student picked AND the correct answer, so it's a complete
  // "your answer vs. correct" record with no recompute against live rows
  @Column('jsonb')
  result: QuestionVerdict;

  @CreateDateColumn()
  createdAt: Date;
}
