import { UUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Question } from './questions.entity';
import { QuestionOption } from './question-options.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
@Index('uq_question_option_group_question_index', ['question', 'index'], {
  unique: true,
})
export class QuestionOptionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text', { nullable: true })
  text?: string | null;

  @Column('int')
  index: number;

  @ManyToOne(() => Question, (q) => q.optionsGroups, { onDelete: 'CASCADE' })
  question: Question;

  @OneToMany(() => QuestionOption, (o) => o.group, {
    eager: true,
    cascade: ['insert', 'remove'],
  })
  options: QuestionOption[];

  @ManyToOne(() => School)
  school: School;

  @RelationId((o: QuestionOptionGroup) => o.school)
  schoolId: UUID;

  @RelationId((o: QuestionOptionGroup) => o.question)
  questionId: UUID;
}
