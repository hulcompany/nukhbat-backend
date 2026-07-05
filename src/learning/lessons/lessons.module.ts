import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './entity/lesson.entity';
import { LessonService } from './lessons.service';
import { QuestionModule } from '../questions/questions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson]), QuestionModule],
  providers: [LessonService],
  exports: [LessonService],
})
export class LessonModule {}
