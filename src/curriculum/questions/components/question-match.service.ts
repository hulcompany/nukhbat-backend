import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionMatch } from '.././entity/question-match.entity';
import {
  QuestionMatchAnswer,
  QuestionMatchResult,
  QuestionMatchVerdict,
} from './../types/question-match.types';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from '.././components/question-component.service';
import { QuestionMatchType } from '.././entity/enum/question-match.type';
import { QuestionMatchDto } from '../dto/question-match.dto';
import { Question } from '../entity/questions.entity';

@Injectable()
export class QuestionMatchService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }
  validate(matches: QuestionMatchDto[]) {
    if (!matches?.length) {
      throw new BadRequestException('Match question should have items');
    }
    let matchCount = matches.filter(
      (e) => e.type == QuestionMatchType.match,
    ).length;
    let baseCount = matches.filter(
      (e) => e.type == QuestionMatchType.base,
    ).length;
    if (!baseCount || !matchCount || matchCount < baseCount) {
      throw new BadRequestException('Matches should be >= Bases');
    }
    const usedIndexes = new Set<number>();
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].type != QuestionMatchType.base) {
        continue;
      }
      const correctIndex = matches[i].correctIndex;
      if (
        correctIndex === undefined ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= matches.length
      ) {
        throw new BadRequestException('Base correct index is wrong');
      }
      if (usedIndexes.has(correctIndex)) {
        throw new BadRequestException('Match Can Be Used For Only One Base');
      }
      if (matches[correctIndex].type == QuestionMatchType.base) {
        throw new BadRequestException('Correct Answer Should Be Match Only');
      }
      usedIndexes.add(correctIndex);
    }
  }
  async verdict(
    question: Question,
    answer?: QuestionMatchAnswer[] | null,
  ): Promise<QuestionMatchResult> {
    const data = question.matchingItems ?? [];

    const bases = data.filter((e) => e.type === QuestionMatchType.base);

    const matches = data.filter((e) => e.type === QuestionMatchType.match);
    if (!bases.length || !matches.length) {
      throw new BadRequestException('Question has invalid matching data');
    }

    // validate submitted ids belong to this question
    const submittedBaseIds = new Set<UUID>();
    const submittedMatchIds = new Set<UUID>();
    for (const a of answer ?? []) {
      const baseExists = bases.some((b) => b.id === a.baseId);
      const matchExists = matches.some((m) => m.id === a.matchId);

      if (!baseExists) {
        throw new BadRequestException('Base not found');
      }

      if (!matchExists) {
        throw new BadRequestException('Match not found');
      }
      if (submittedBaseIds.has(a.baseId) || submittedMatchIds.has(a.matchId)) {
        throw new BadRequestException(
          'Each base and match can only be submitted once',
        );
      }
      submittedBaseIds.add(a.baseId);
      submittedMatchIds.add(a.matchId);
    }

    const verdicts: QuestionMatchVerdict[] = bases.map((base) => {
      const submitted = (answer ?? []).find((a) => a.baseId === base.id);

      const correctMatch =
        base.correctIndex == null
          ? undefined
          : matches.find((m) => m.index === base.correctIndex);

      if (!submitted) {
        return {
          verdict: false,
          answeredBase: base,
          baseCorrectMatch: correctMatch,
        };
      }

      const answeredMatch = matches.find((m) => m.id === submitted.matchId);

      const matchCorrectBase = answeredMatch
        ? bases.find((b) => b.correctIndex === answeredMatch.index)
        : undefined;

      return {
        verdict: !!answeredMatch && answeredMatch.index === base.correctIndex,

        answeredBase: base,
        answeredMatch,
        baseCorrectMatch: correctMatch,
        matchCorrectBase,
      };
    });

    return {
      verdict: verdicts.every((item) => item.verdict),
      skipped: !answer?.length,
      verdicts,
    };
  }

  hideAnswers(question: Question) {
    return {
      ...question,
      matchingItems: question.matchingItems?.map(
        ({ correctIndex, ...item }) => item,
      ),
    };
  }

  async create(
    data: { id: UUID; schoolId: UUID; matches: QuestionMatchDto[] },
    em?: EntityManager,
  ) {
    let repo =
      em?.getRepository(QuestionMatch) || this.ds.getRepository(QuestionMatch);
    this.validate(data.matches);
    await repo.save(
      data.matches.map((item, index) =>
        repo.create({
          question: { id: data.id },
          school: { id: data.schoolId },
          index,
          correctIndex: item.correctIndex ?? null,
          type: item.type,
          text: item.text,
        }),
      ),
    );
  }
  async deleteByIds(ids: UUID[], em?: EntityManager) {
    let repo =
      em?.getRepository(QuestionMatch) || this.ds.getRepository(QuestionMatch);
    await repo.delete(ids);
  }
}
