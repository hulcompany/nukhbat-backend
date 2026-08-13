import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entity/questions.entity';
import { QuestionOption } from './entity/question-options.entity';
import { QuestionMatch } from './entity/question-match.entity';
import { QuestionOptionGroup } from './entity/question-options-group.entity';
import { QuestionClassify } from './entity/question-class.entity';
import { QuestionOrder } from './entity/question-order.entity';
import { QuestionFillBlank } from './entity/question-fill-blank.entity';
import { QuestionTrueOrFalse } from './entity/question-true-or-false.entity';
import { LessonUsed } from '../lessons/entity/lesson-used.entity';
import { QuestionService } from './questions.service';
import { QuestionOptionsService } from './components/question-options.service';
import { QuestionClassifyService } from './components/question-classify.service';
import { QuestionFillBlankService } from './components/question-fill-blanks.service';
import { QuestionMatchService } from './components/question-match.service';
import { QuestionOrderService } from './components/question-order.service';
import { QuestionTrueOrFalseService } from './components/question-true-or-false.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Question,
      QuestionOption,
      QuestionOptionGroup,
      QuestionMatch,
      QuestionClassify,
      QuestionOrder,
      QuestionFillBlank,
      QuestionTrueOrFalse,
      LessonUsed,
    ]),
  ],
  providers: [
    QuestionService,
    QuestionOptionsService,
    QuestionClassifyService,
    QuestionFillBlankService,
    QuestionMatchService,
    QuestionOrderService,
    QuestionTrueOrFalseService,
  ],
  exports: [QuestionService],
})
export class QuestionModule {}
