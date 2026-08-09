import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  RelationId,
  Index,
} from 'typeorm';
import { UUID } from 'crypto';
import { School } from '../../../school/entity/school.entity';
import { Question } from './questions.entity';


@Entity()
@Index('uq_question_fill_blank_index', ['question', 'index'], {
  unique: true,
})
export class QuestionFillBlank {

  @PrimaryGeneratedColumn('uuid')
  id: UUID;


  /**
   * ترتيب الفراغ داخل نص السؤال
   * يبدأ من 0
   */
  @Column('int')
  index: number;


  /**
   * الإجابات المقبولة لهذا الفراغ
   */
  @Column('simple-json')
  answers: string[];


  @ManyToOne(() => Question, q => q.fillBlanks, {
    onDelete: 'CASCADE',
  })
  question: Question;


  @RelationId((f: QuestionFillBlank) => f.question)
  questionId: UUID;


  @ManyToOne(() => School, {
    onDelete: 'CASCADE',
  })
  school: School;


  @RelationId((f: QuestionFillBlank) => f.school)
  schoolId: UUID;
}