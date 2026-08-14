import { UUID } from 'crypto';
import {
  Check,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Course } from '../../course/entity/course.entity';
import { Lesson } from '../../lessons/entity/lesson.entity';
import { QuestionMatch } from './question-match.entity';
import { QuestionType } from './enum/question.type';
import { QuestionPurpose } from './enum/question-purpose.type';
import { School } from '../../../school/entity/school.entity';
import { QuestionClassify } from './question-class.entity';
import { QuestionOrder } from './question-order.entity';
import { QuestionFillBlank } from './question-fill-blank.entity';
import { QuestionOptionGroup } from './question-options-group.entity';
import { QuestionTrueOrFalse } from './question-true-or-false.entity';

@Entity()
@Check(
  'chk_question_lesson_xor_course',
  '("lessonId" IS NOT NULL AND "courseId" IS NULL) OR ("lessonId" IS NULL AND "courseId" IS NOT NULL)',
)
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
  })
  type: QuestionType;

  @Column({
    type: 'enum',
    enum: QuestionPurpose,
    default: QuestionPurpose.lesson,
  })
  purpose: QuestionPurpose;

  // null for dailyChallenge questions — they live in the school's pool
  @ManyToOne(() => Lesson, (l) => l.questions, { nullable: true })
  lesson: Lesson | null;

  @RelationId((q: Question) => q.lesson)
  lessonId: UUID | null;

  // only set for dailyChallenge questions — ties a pool question to the
  // course whose challenge slice it can appear in; lesson questions get
  // their course through the lesson chain instead
  @ManyToOne(() => Course, { nullable: true })
  course: Course | null;

  @RelationId((q: Question) => q.course)
  courseId: UUID | null;

  @OneToMany(() => QuestionOptionGroup, (o) => o.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  optionsGroups: QuestionOptionGroup[];

  @OneToOne(() => QuestionTrueOrFalse, (o) => o.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  trueOrFalse: QuestionTrueOrFalse;
  @OneToMany(() => QuestionClassify, (o) => o.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  classifyItems: QuestionClassify[];

  @OneToMany(() => QuestionMatch, (m) => m.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  matchingItems: QuestionMatch[];

  @OneToMany(() => QuestionOrder, (m) => m.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  orderItems: QuestionOrder[];

  @OneToMany(() => QuestionFillBlank, (m) => m.question, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: ['remove', 'soft-remove', 'insert'],
  })
  fillBlanks: QuestionFillBlank[];

  @Column('uuid', { nullable: true })
  imageId?: UUID | null;

  @ManyToOne(() => School, { nullable: true })
  school?: School;

  @RelationId((q: Question) => q.school)
  schoolId?: UUID;

  // free-form hints shown to the student; not an answer key. Orderless, no
  // ids — an edit replaces the whole list wholesale (empty array clears it).
  @Column('text', { array: true, default: () => "'{}'" })
  tips: string[];
}
