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
import { DailyChallenge, QuestionVerdict } from '../../../curriculum';

// One row per (student, daily challenge): a student may attempt a given day's
// challenge exactly once (enforced by the unique index). The graded verdict is
// frozen here at solve time so review reads never recompute against the live
// pool questions — same self-contained-snapshot rule as LessonAttempt.
@Index(['dailyChallengeId', 'studentId'], { unique: true })
@Entity()
export class SolvedDailyChallenges {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @ManyToOne(() => DailyChallenge, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  dailyChallenge: DailyChallenge;

  @Column('uuid')
  dailyChallengeId: UUID;

  @ManyToOne(() => StudentProfile, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  student: StudentProfile;

  @Column('uuid')
  studentId: UUID;

  // fully-correct count / graded count, frozen at solve
  @Column('int')
  score: number;

  @Column('int')
  total: number;

  // the frozen per-question verdicts (each answer vs. the correct answer) —
  // same shape stored in QuestionAttempt.result, so review needs no recompute
  @Column('jsonb')
  verdict: QuestionVerdict[];

  @CreateDateColumn()
  date: Date;
}
