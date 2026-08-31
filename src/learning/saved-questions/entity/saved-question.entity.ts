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

// A question the student answered wrong in a lesson, kept for practice. One row per
// (student, question) — the unique index keeps a repeated mistake at one row,
// and both sides CASCADE so deleting the student or the question clears it.
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

  // no eager load: the saved list is read as per-course counts, and solving
  // reloads the questions through CurriculumService for the full shape
  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  question: Question;

  @CreateDateColumn()
  createdAt: Date;
}
