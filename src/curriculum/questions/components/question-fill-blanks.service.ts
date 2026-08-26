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

/**
 * خصائص الـ text-field المطلوبة (بحروف صغيرة للمقارنة غير الحساسة لحالة الأحرف)
 */
const TEXT_FIELD_PROPS = [
  'index',
  'width',
  'textdirection',
  'hint',
  'contentlength',
] as const;

/** القيم المسموحة لأي خاصية: null أو رقم أو ltr/rtl أو نص بين علامتي اقتباس */
const TEXT_FIELD_VALUE = String.raw`(?:null|\d+|ltr|rtl|"(?:\\.|[^"\\])*")`;
const TEXT_FIELD_PROP = String.raw`\s*[A-Za-z]+\s*:\s*${TEXT_FIELD_VALUE}\s*`;

const TEXT_FIELD_CANDIDATE_PATTERN = /\{\{\s*textField\b/gi;

/** الترتيب غير مهم: أي خاصية يمكن أن تأتي في أي موضع، وحالة الأحرف غير مهمة */
const TEXT_FIELD_PATTERN = new RegExp(
  String.raw`\{\{\s*textField\s*:\s*\{(${TEXT_FIELD_PROP}(?:,${TEXT_FIELD_PROP})*)\}\s*\}\}`,
  'gi',
);

const TEXT_FIELD_PROP_PATTERN = new RegExp(
  String.raw`([A-Za-z]+)\s*:\s*(${TEXT_FIELD_VALUE})`,
  'gi',
);

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

    const textFieldCandidates = [...text.matchAll(TEXT_FIELD_CANDIDATE_PATTERN)];
    const textFields = [...text.matchAll(TEXT_FIELD_PATTERN)];

    if (textFieldCandidates.length !== textFields.length) {
      throw new BadRequestException('Text-field placeholder syntax is invalid');
    }
    if (textFields.length !== data.length) {
      throw new BadRequestException(
        'Text-field placeholder count must match blank count',
      );
    }

    const placeholders = textFields.map((match) =>
      this.parseTextFieldProps(match[1]),
    );

    const placeholderIndexes = placeholders.map(
      (placeholder) => placeholder.index,
    );
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

    for (const placeholder of placeholders) {
      const { width, contentLength } = placeholder;
      if (
        (width !== null && (!Number.isInteger(width) || width <= 0)) ||
        (contentLength !== null &&
          (!Number.isInteger(contentLength) || contentLength < 0))
      ) {
        throw new BadRequestException('Text-field dimensions are invalid');
      }
    }
  }

  /**
   * يقرأ خصائص الـ text-field بغض النظر عن ترتيبها أو حالة أحرفها
   */
  private parseTextFieldProps(body: string) {
    const props = new Map<string, string>();

    for (const [, key, value] of body.matchAll(TEXT_FIELD_PROP_PATTERN)) {
      const normalizedKey = key.toLowerCase();
      if (props.has(normalizedKey)) {
        throw new BadRequestException(
          'Text-field properties must not be duplicated',
        );
      }
      props.set(normalizedKey, value);
    }

    if (
      props.size !== TEXT_FIELD_PROPS.length ||
      TEXT_FIELD_PROPS.some((prop) => !props.has(prop))
    ) {
      throw new BadRequestException('Text-field placeholder syntax is invalid');
    }

    const index = props.get('index') as string;
    const width = props.get('width') as string;
    const textDirection = (props.get('textdirection') as string).toLowerCase();
    const hint = props.get('hint') as string;
    const contentLength = props.get('contentlength') as string;

    if (
      !/^\d+$/.test(index) ||
      !/^(null|\d+)$/i.test(width) ||
      !/^(ltr|rtl)$/.test(textDirection) ||
      !/^(null|")/i.test(hint) ||
      !/^(null|\d+)$/i.test(contentLength)
    ) {
      throw new BadRequestException('Text-field placeholder syntax is invalid');
    }

    return {
      index: Number(index),
      width: /^null$/i.test(width) ? null : Number(width),
      textDirection,
      hint: /^null$/i.test(hint) ? null : hint,
      contentLength: /^null$/i.test(contentLength)
        ? null
        : Number(contentLength),
    };
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
