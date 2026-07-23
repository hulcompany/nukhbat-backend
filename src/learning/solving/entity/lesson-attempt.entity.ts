import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionAttempt } from './question-attempt.entity';
import { StudentProfile } from '../../../student/entity/student-profile.entity';
import { Lesson } from '../../../curriculum';

// One row per /solve. The self-contained review record: its marks and title
// snapshot stay readable even after the lesson's questions change, and it
// survives everything except the lesson itself being deleted (CASCADE).
//
// Marks are frozen here at solve time, never recomputed on read — editing a
// question later can't rewrite a past attempt's score.
@Entity()
// "my attempts on this lesson" — attemptNumber lookup + the completed EXISTS
// that gates XP (see SolveLessonsService).
@Index(['studentId', 'lessonId'])
// school leaderboard / per-track rollups without walking the curriculum tree.
@Index(['schoolId', 'trackId'])
export class LessonAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @ManyToOne(() => StudentProfile, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  student: StudentProfile;

  @Column('uuid')
  studentId: UUID;

  @ManyToOne(() => Lesson, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  lesson: Lesson;

  @Column('uuid')
  lessonId: UUID;

  // --- scope, denormalized as plain uuid (copied from the profile/curriculum
  // at solve time; no FK, so rollups survive a curriculum reorg) ---
  @Column('uuid')
  schoolId: UUID;

  @Column('uuid')
  trackId: UUID;

  @Column('uuid')
  courseId: UUID;

  @Column('uuid')
  unitId: UUID;

  // --- snapshot for review display ---
  // the lesson title as it read when solved
  @Column()
  lessonTitle: string;

  // --- marks (frozen at solve, never recomputed) ---
  // 1-based, per (student, lesson). Keeps climbing on every retry regardless
  // of completion.
  @Column('int')
  attemptNumber: number;

  // # questions graded in this attempt
  @Column('int')
  questionsTotal: number;

  // fully-correct count. completed = questionsCorrect == questionsTotal
  @Column('int')
  questionsCorrect: number;

  // Σ per-question raw score / Σ per-question max — the answer-level accuracy
  // metric (partial credit, e.g. 3-of-4 matches)
  @Column('int')
  score: number;

  @Column('boolean')
  completed: boolean;

  // XP this attempt actually granted (0 once the lesson was already completed
  // once). The ledger stays the source of truth; this is denormalized for
  // review display.
  @Column('int', { default: 0 })
  xpAwarded: number;

  @OneToMany(() => QuestionAttempt, (v) => v.lessonAttempt)
  questionAttempts: QuestionAttempt[];

  @CreateDateColumn()
  createdAt: Date;
}
