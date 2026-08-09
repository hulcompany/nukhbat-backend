import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionMatch } from './entity/question-match.entity';
import {
  QuestionMatchAnswer,
  QuestionMatchVerdict,
} from './types/question-match.types';
import { DataSource, EntityManager } from 'typeorm';
import { UUID } from 'crypto';
import { QuestionComponentService } from './question-component.service';
import { QuestionMatchDto } from './dto/question-match.dto';
import { QuestionMatchType } from './entity/enum/question-match.type';

@Injectable()
class QuestionMatchService extends QuestionComponentService {
  constructor(private readonly ds: DataSource) {
    super();
  }
  validate(matches: QuestionMatch[]) {
    let matchCount = matches.filter(
      (e) => e.type == QuestionMatchType.match,
    ).length;
    let baseCount = matches.filter(
      (e) => e.type == QuestionMatchType.base,
    ).length;
    if (matchCount < baseCount) {
      throw new BadRequestException('Matches should be >= Bases');
    }
    let usedIndicies: number[] = [];
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].type != QuestionMatchType.base) {
        continue;
      }
      if (matches[i].correctIndex! >= matches.length) {
        throw new BadRequestException('Base correct index is wrong');
      }
      if (usedIndicies.includes(matches[i].correctIndex!)) {
        throw new BadRequestException('Match Can Be Used For Only One Base');
      }
      if (matches[matches[i].correctIndex!].type == QuestionMatchType.base) {
        throw new BadRequestException('Correct Answer Should Be Match Only');
      }
      usedIndicies.push(matches[i].correctIndex!);
    }
  }
  async verdict(id: UUID, answer: QuestionMatchAnswer[]) {
    const data = await this.ds.getRepository(QuestionMatch).find({
      where: { questionId: id },
      order: { index: 'ASC' },
    });

    const bases = data.filter((e) => e.type === QuestionMatchType.base);

    const matches = data.filter((e) => e.type === QuestionMatchType.match);

    // validate submitted ids belong to this question
    for (const a of answer) {
      const baseExists = bases.some((b) => b.id === a.baseId);
      const matchExists = matches.some((m) => m.id === a.matchId);

      if (!baseExists) {
        throw new NotFoundException('Base not found');
      }

      if (!matchExists) {
        throw new NotFoundException('Match not found');
      }
    }

    const verdicts: QuestionMatchVerdict[] = bases.map((base) => {
      const submitted = answer.find((a) => a.baseId === base.id);

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

    return verdicts;
  }
  async create(data: QuestionMatch[], em?: EntityManager) {
    let repo =
      em?.getRepository(QuestionMatch) || this.ds.getRepository(QuestionMatch);
    this.validate(data);
    await repo.insert(data);
  }
  async deleteByIds(ids: UUID[], em?: EntityManager) {
    let repo =
      em?.getRepository(QuestionMatch) || this.ds.getRepository(QuestionMatch);
    await repo.delete(ids);
  }
}
