import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UUID } from 'crypto';
import { Lesson } from './lesson.entity';

// One row per lesson. A lesson becomes "used" the moment a student has any
// attempt on it (pass or fail) — from then on its content is frozen: no
// draft-revert, no adding/editing/removing questions. Only deleting the
// lesson (or its unit) and reordering stay allowed.
@Entity()
export class LessonUsed {
  @PrimaryColumn('uuid')
  lessonId: UUID;

  @OneToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @Column('boolean', { default: false })
  used: boolean;
}
