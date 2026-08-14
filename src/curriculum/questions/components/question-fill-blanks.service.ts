import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionFillBlankDto } from '../dto/question-blank.dto';
import { QuestionFillBlank } from '../entity/question-fill-blank.entity';
import { Question } from '../entity/questions.entity';
import {
  QuestionFillBlanksAnswer,
  QuestionFillBlanksResult,
  QuestionFillBlanksVerdict,
} from '../types/question-fill-blanks.types';

@Injectable()
export class QuestionFillBlankService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }

  validate(params: { text: string; data: QuestionFillBlankDto[] }) {
    const { text, data } = params;
    if (!data?.length) {
      throw new BadRequestException('Fill blank question should have blanks');
    }

    const indexes = data.map((e) => e.index);

    const uniqueIndexes = new Set(indexes);

    if (uniqueIndexes.size !== indexes.length) {
      throw new BadRequestException('Blank indexes should be unique');
    }

    const sortedIndexes = [...indexes].sort((a, b) => a - b);

    sortedIndexes.forEach((index, position) => {
      if (index !== position) {
        throw new BadRequestException(
          'Blank indexes should start from 0 and be sequential',
        );
      }
    });

    for (const item of data) {
      if (!item.answers?.length) {
        throw new BadRequestException('Blank should have answers');
      }
    }

    const textFieldPattern =
      /\{\{\s*textField\s*:\s*\{\s*width\s*:\s*(\d+)\s*,\s*contentLength\s*:\s*(null|\d+)\s*,\s*index\s*:\s*(\d+)\s*\}\s*\}\}/g;
    const textFieldCandidates = [...text.matchAll(/\{\{\s*textField\b/g)];
    const textFields = [...text.matchAll(textFieldPattern)];

    if (textFieldCandidates.length !== textFields.length) {
      throw new BadRequestException('Text-field placeholder syntax is invalid');
    }
    if (textFields.length !== data.length) {
      throw new BadRequestException(
        'Text-field placeholder count must match blank count',
      );
    }

    const placeholderIndexes = textFields.map((match) => Number(match[3]));
    const uniquePlaceholderIndexes = new Set(placeholderIndexes);
    if (uniquePlaceholderIndexes.size !== placeholderIndexes.length) {
      throw new BadRequestException('Text-field indexes must be unique');
    }

    const blankIndexes = new Set(indexes);
    if (
      placeholderIndexes.some((index) => !blankIndexes.has(index)) ||
      placeholderIndexes.some((index) => !Number.isInteger(index) || index < 0)
    ) {
      throw new BadRequestException(
        'Text-field indexes must match blank indexes',
      );
    }

    for (const match of textFields) {
      const width = Number(match[1]);
      const contentLength = match[2] === 'null' ? null : Number(match[2]);
      if (
        !Number.isInteger(width) ||
        width <= 0 ||
        (contentLength !== null &&
          (!Number.isInteger(contentLength) || contentLength < 0))
      ) {
        throw new BadRequestException('Text-field dimensions are invalid');
      }
    }
  }

  async create(
    data: {
      id: UUID;
      schoolId: UUID;
      text: string;
      data: QuestionFillBlankDto[];
    },
    em?: EntityManager,
  ) {
    const repo =
      em?.getRepository(QuestionFillBlank) ||
      this.ds.getRepository(QuestionFillBlank);

    this.validate(data);

    await repo.save(
      data.data.map((blank) =>
        repo.create({
          question: { id: data.id },
          school: { id: data.schoolId },
          index: blank.index,
          answers: blank.answers.map((answer) => answer.trim()),
        }),
      ),
    );
  }

  async deleteByIds(ids: UUID[], em?: EntityManager) {
    const repo =
      em?.getRepository(QuestionFillBlank) ||
      this.ds.getRepository(QuestionFillBlank);

    await repo.delete(ids);
  }

  async verdict(
    question: Question,
    answer?: QuestionFillBlanksAnswer[] | null,
  ): Promise<QuestionFillBlanksResult> {
    const blanks = [...(question.fillBlanks ?? [])].sort(
      (left, right) => left.index - right.index,
    );
    if (!blanks.length) {
      throw new BadRequestException('Question has no fill blanks');
    }
    const answersByIndex = new Map<number, QuestionFillBlanksAnswer>();
    for (const submitted of answer ?? []) {
      if (answersByIndex.has(submitted.index)) {
        throw new BadRequestException('Only one answer is allowed per blank');
      }
      if (!blanks.some((blank) => blank.index === submitted.index)) {
        throw new BadRequestException('Blank not found');
      }
      answersByIndex.set(submitted.index, submitted);
    }

    const result: QuestionFillBlanksVerdict[] = [];
    for (const blank of blanks) {
      const submitted = answersByIndex.get(blank.index);
      const normalizedAnswer = submitted?.answer.trim().toLowerCase();
      result.push({
        answer: submitted?.answer.trim(),
        correctAnswer: blank.answers,
        index: blank.index,
        verdict:
          normalizedAnswer !== undefined &&
          blank.answers.some(
            (answer) => answer.trim().toLowerCase() === normalizedAnswer,
          ),
      });
    }
    return {
      verdict: result.every((item) => item.verdict),
      skipped: !answer?.length,
      verdicts: result,
    };
  }

  hideAnswers(question: Question) {
    return {
      ...question,
      fillBlanks: question.fillBlanks?.map(({ answers, ...blank }) => blank),
    };
  }
}
