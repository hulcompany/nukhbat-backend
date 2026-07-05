import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entity/questions.entity';
import { QuestionOption } from './entity/question-options.entity';
import { QuestionMatch } from './entity/question-match.entity';
import { QuestionService } from './questions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, QuestionOption, QuestionMatch]),
  ],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}
