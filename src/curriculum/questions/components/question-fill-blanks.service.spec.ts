import { Question } from '../entity/questions.entity';
import { QuestionFillBlankService } from './question-fill-blanks.service';

describe('QuestionFillBlankService', () => {
  const service = new QuestionFillBlankService({} as any);

  it('grades submitted answers without surrounding-space or case sensitivity', async () => {
    const question = {
      fillBlanks: [{ index: 0, answers: ['  Correct Answer  '] }],
    } as Question;

    const result = await service.verdict(question, [
      { index: 0, answer: '  cOrReCt AnSwEr  ' },
    ]);

    expect(result.verdict).toBe(true);
    expect(result.verdicts[0]).toMatchObject({
      answer: 'cOrReCt AnSwEr',
      verdict: true,
    });
  });
});
