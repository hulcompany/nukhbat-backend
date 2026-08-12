import { UUID } from 'crypto';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Question } from './questions.entity';
import { QuestionOption } from './question-options.entity';
import { School } from '../../../school/entity/school.entity';

@Entity()
export class QuestionOptionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text' , {nullable: true})
  text?: string;

  @Column('int', { nullable: true })
  index?: number;

  @ManyToOne(() => Question, (q) => q.optionsGroups, { onDelete: 'CASCADE' })
  question: Question;

  @OneToMany(() => QuestionOption, (o) => o.group, { onDelete: 'CASCADE' })
  options: QuestionOption[];

  @ManyToOne(() => School)
  school: School;

  @RelationId((o: QuestionOptionGroup) => o.school)
  schoolId: UUID;

  @RelationId((o: QuestionOptionGroup) => o.question)
  questionId: UUID;
}
