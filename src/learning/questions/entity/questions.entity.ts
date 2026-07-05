import { UUID } from 'crypto';
import {
  Check,
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Course } from '../../course/entity/course.entity';
import { Lesson } from '../../lessons/entity/lesson.entity';
import { QuestionOption } from './question-options.entity';
import { QuestionMatch } from './question-match.entity';
import { QuestionType } from './enum/question.type';
import { QuestionPurpose } from './enum/question-purpose.type';
import { School } from '../../../school/entity/school.entity';

@Entity()
@Index('uq_question_school_lesson_index', ['school', 'lesson', 'index'], {
  unique: true,
  where: '"schoolId" IS NOT NULL AND "lessonId" IS NOT NULL',
})
@Index('uq_question_global_lesson_index', ['lesson', 'index'], {
  unique: true,
  where: '"schoolId" IS NULL AND "lessonId" IS NOT NULL',
})
@Index('uq_question_school_course_index', ['school', 'course', 'index'], {
  unique: true,
  where: '"courseId" IS NOT NULL AND "lessonId" IS NULL',
})
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

  @Column()
  index: number;

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

  @OneToMany(() => QuestionOption, (o) => o.question, { eager: true })
  options: QuestionOption[];

  @OneToMany(() => QuestionMatch, (m) => m.question, { eager: true })
  matchingItems: QuestionMatch[];

  @Column('uuid', { nullable: true })
  imageId?: UUID | null;

  @ManyToOne(() => School , {nullable: true})
  school?: School;

  @RelationId((q: Question) => q.school)
  schoolId?: UUID;
}
