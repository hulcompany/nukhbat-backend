import { Controller, Get } from '@nestjs/common';
import { TrackService } from './tracks/tracks.service';
import { LessonStatusType } from './lessons/entity/lesson.status.type';
import { QuestionType } from './questions/entity/enum/question.type';
import { QuestionMatchType } from './questions/entity/enum/question-match.type';
import { QuestionPurpose } from './questions/entity/enum/question-purpose.type';

@Controller('learning')
export class LearningController {
  constructor(private trackService: TrackService) {}

  @Get('metaData')
  async getMetadata() {
    return {
      lessonStatusType: Object.values(LessonStatusType),
      questionTypes: Object.values(QuestionType),
      questionMatchTypes: Object.values(QuestionMatchType),
      questionPurposeTypes: Object.values(QuestionPurpose),
    };
  }

  @Get('tracks')
  async getAll() {
    return this.trackService.find();
  }
}
