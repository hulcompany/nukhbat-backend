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
import { Question } from '../../../curriculum/questions/entity/questions.entity';

// A student's personal bookmark of a question to revisit. One row per
// (student, question) — the unique index makes save idempotent, and both
// sides CASCADE so deleting the student or the question clears the bookmark.
@Entity()
@Index(['studentProfileId', 'questionId'], { unique: true })
export class SavedQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  studentProfileId: UUID;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  studentProfile: StudentProfile;

  @Column('uuid')
  questionId: UUID;

  // eager so the saved list/detail hand back the full question (options,
  // matchingItems come along via the question's own eager relations)
  @ManyToOne(() => Question, { onDelete: 'CASCADE', eager: true })
  question: Question;

  @CreateDateColumn()
  createdAt: Date;
}
