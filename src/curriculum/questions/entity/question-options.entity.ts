import { UUID } from 'crypto';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { QuestionOptionGroup } from './question-options-group.entity';

@Entity()
export class QuestionOption {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('text')
  text: string;

  @Column()
  isCorrect: boolean;

  @ManyToOne(() => QuestionOptionGroup, (o) => o.options, {
    onDelete: 'CASCADE',
  })
  group: QuestionOptionGroup;

  @RelationId((o: QuestionOption) => o.group)
  groupId: UUID;
}
