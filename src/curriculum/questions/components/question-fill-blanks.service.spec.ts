import { Question } from '../entity/questions.entity';
import { QuestionFillBlankService } from './question-fill-blanks.service';

describe('QuestionFillBlankService', () => {
  const service = new QuestionFillBlankService({} as any);

  it('accepts the current text-field placeholder format', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {index: 0, width: 100, textDirection: ltr, hint: "Enter x", contentLength: 3}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).not.toThrow();
  });

  it('accepts nullable text-field properties', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {index: 0, width: null, textDirection: rtl, hint: null, contentLength: null}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).not.toThrow();
  });

  it('accepts text-field properties in any order', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {hint: "Enter x", contentLength: 3, textDirection: ltr, index: 0, width: 100}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).not.toThrow();
  });

  it('accepts text-field properties regardless of letter case', () => {
    expect(() =>
      service.validate({
        text: '{{TEXTFIELD: {Index: 0, WIDTH: NULL, textdirection: RTL, Hint: NULL, ContentLength: 3}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).not.toThrow();
  });

  it('rejects text-fields with missing or duplicated properties', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {index: 0, width: 100, textDirection: ltr, hint: null}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).toThrow();

    expect(() =>
      service.validate({
        text: '{{textField: {index: 0, Index: 1, width: 100, textDirection: ltr, hint: null, contentLength: 3}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).toThrow();
  });

  it('rejects text-fields whose property values have the wrong type', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {index: ltr, width: 100, textDirection: 3, hint: null, contentLength: null}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).toThrow();
  });

  it('does not read properties out of a quoted hint', () => {
    expect(() =>
      service.validate({
        text: '{{textField: {hint: "index: 9, width: 4", index: 0, width: 100, textDirection: ltr, contentLength: null}}}',
        data: [{ index: 0, answers: ['x'] }],
      }),
    ).not.toThrow();
  });

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
