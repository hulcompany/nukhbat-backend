import { BadRequestException } from '@nestjs/common';
import { Question, QuestionType } from '../../curriculum';

export function assertFullQuestionComponents(questions: Question[]) {
  for (const question of questions) {
    let complete = false;
    switch (question.type) {
      case QuestionType.OPTIONS:
        complete =
          question.optionsGroups?.length > 0 &&
          question.optionsGroups.every((group) => group.options?.length > 0);
        break;
      case QuestionType.MATCH:
        complete = question.matchingItems?.length > 0;
        break;
      case QuestionType.TRUE_FALSE:
        complete = Boolean(question.trueOrFalse);
        break;
      case QuestionType.classify:
        complete = question.classifyItems?.length > 0;
        break;
      case QuestionType.order:
        complete = question.orderItems?.length > 0;
        break;
      case QuestionType.fillBlanks:
        complete = question.fillBlanks?.length > 0;
        break;
    }

    if (!complete) {
      throw new BadRequestException(
        `Question ${question.id} does not have complete components`,
      );
    }
  }
}
