import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsOrder,
  FindOptionsSelect,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { Question } from './entity/questions.entity';
import { LessonUsed } from '../lessons/entity/lesson-used.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AdminQuestionGetDto,
  QuestionCreateDto,
  QuestionEditDto,
  QuestionGetDto,
} from './dto/question.dto';
import { UUID } from 'crypto';
import { QuestionType } from './entity/enum/question.type';
import { QuestionMatchDto } from './dto/question-match.dto';
import { QuestionMatchType } from './entity/enum/question-match.type';
import { QuestionOption } from './entity/question-options.entity';
import { QuestionMatch } from './entity/question-match.entity';
import { QuestionOptionDto } from './dto/question-option.dto';
import { FileService } from '../../file/file.service';
import { LessonStatusType } from '../lessons/entity/lesson.status.type';
import { applyPsqlFilter, BasePaginationModel, transaction } from 'core';
import { QuestionPurpose } from './entity/enum/question-purpose.type';
import { DailyChallengeUsedQuestions } from '../daily-challenge/entity/daily-challenge-used-questions.entity';
import { todayDateString } from '../daily-challenge/daily-challenge.service';
import { MatchVerdict, QuestionVerdict } from './types/question-verdict.type';

type QuestionImages = {
  question?: Express.Multer.File | null;
  // options?: (Express.Multer.File | null | undefined)[];
};

// matchingItems is positional — a base row's correctIndex names a match row's
// `index` — so every read that hands questions back has to order by it, or the
// client pairs them up by array position and gets whatever the heap returned.
// Works through the eager relation and reuses its join (find* family only;
// query builders must addOrderBy themselves).
const matchOrder: FindOptionsOrder<Question> = {
  matchingItems: { index: 'ASC' },
};

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question) private readonly repo: Repository<Question>,
    @InjectRepository(LessonUsed)
    private readonly lessonUsedRepo: Repository<LessonUsed>,
    private readonly files: FileService,
    private readonly ds: DataSource,
  ) {}

  // a lesson freezes once a student attempts it — no adding/editing/removing
  // its questions afterwards. Repo-only (no LessonService) to avoid the
  // LessonService → QuestionService cycle.
  private async assertLessonNotUsed(lessonId: UUID, em?: EntityManager) {
    const repo = em ? em.getRepository(LessonUsed) : this.lessonUsedRepo;
    const row = await repo.findOne({ where: { lessonId, used: true } });
    if (row) {
      throw new BadRequestException(
        'This lesson is in use and its questions can no longer be changed',
      );
    }
  }

  async find(
    filter: FindOptionsWhere<Question>,
    select?: FindOptionsSelect<Question>,
  ) {
    return await this.repo.find({
      where: filter,
      order: matchOrder,
      select: select,
    });
  }

  // paginated list. With an explicit lessonId/courseId the caller has
  // already asserted access; without one, every school question is
  // returned EXCEPT those hanging off a track the school can't use
  // (lesson OR course must be null or lead to an allowed track).
  // Callers pass schoolId explicitly — school scoping is then a plain
  // filter, and the track-access clauses are skipped when it's absent.
  async getByCriteria(params: {
    params: QuestionGetDto | AdminQuestionGetDto;
    schoolId?: UUID;
    trackId?: UUID;
    filter?: any;
  }) {
    const query = params.params;
    const schoolId = params.schoolId;

    // eager relations don't load through a query builder — join them so
    // list items keep the same shape as findOne, and order the matches
    // explicitly since `matchOrder` only reaches the find* family
    const qb = this.repo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .leftJoinAndSelect('q.matchingItems', 'matchingItems')
      .leftJoinAndSelect('q.school', 'school')
      .addOrderBy('matchingItems.index', 'ASC');

    if (schoolId) {
      qb.andWhere('q.school = :schoolId', { schoolId });
    }
    if (query.lessonId) {
      qb.andWhere('q.lesson = :lessonId', { lessonId: query.lessonId });
    }
    if (query.courseId) {
      qb.andWhere('q.course = :courseId', { courseId: query.courseId });
    }
    if (params.trackId) {
      // a question's track comes from its pool course (dailyChallenge)
      // or from lesson → unit → course (lesson questions)
      qb.leftJoin('q.course', 'poolCourse')
        .leftJoin('q.lesson', 'qLesson')
        .leftJoin('qLesson.unit', 'qUnit')
        .leftJoin('qUnit.course', 'lessonCourse')
        .andWhere(
          '(poolCourse.trackId = :trackId OR lessonCourse.trackId = :trackId)',
          { trackId: params.trackId },
        );
    }
    applyPsqlFilter({
      queryBuilder: qb,
      query: query,
      options: {
        title: { regExp: { regexp: 'contains' } },
        lessonId: { skip: true },
        courseId: { skip: true },
        // virtual @RelationId — already applied as q.school above
        schoolId: { skip: true },
        // applied via the course joins above
        trackId: { skip: true },
      },
    });

    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: query.skip,
      limit: query.limit,
    });
  }

  // options/matchingItems come along via eager relations
  async findOne(filter: FindOptionsWhere<Question>) {
    let question = await this.repo.findOne({
      where: filter,
      order: matchOrder,
      relations: {
        course: true,
        lesson: true,
        school: true,
        matchingItems: true,
        options: true,
      },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async create(params: {
    params: QuestionCreateDto;
    images?: QuestionImages;
    schoolId: UUID;
  }) {
    this.assertDtos(params.params);
    if (params.params.purpose == QuestionPurpose.lesson) {
      await this.assertLessonNotUsed(params.params.lessonId!);
    }
    const lessonRef =
      params.params.purpose == QuestionPurpose.lesson
        ? { id: params.params.lessonId }
        : null;
    // and only they attach to a course
    const courseRef =
      params.params.purpose == QuestionPurpose.dailyChallenge
        ? { id: params.params.courseId }
        : null;
    let options = this.getNewOptions(params.params, params.schoolId);
    let fieldIds: UUID[] = [];
    let questionImage = await this.files.store(
      params.images?.question,
      'learning/questions',
    );
    if (questionImage) {
      fieldIds.push(questionImage.id);
    }
    return await transaction(
      this.ds,
      async (em) => {
        let questionRepo = em.getRepository(Question);

        if (questionImage) {
          await this.files.use({ id: questionImage.id, dm: em });
        }

        let question = await questionRepo.save(
          questionRepo.create({
            title: params.params.title,
            type: params.params.type,
            purpose: params.params.purpose,
            lesson: lessonRef,
            course: courseRef,
            school: { id: params.schoolId },
            imageId: questionImage?.id,
            tips: params.params.tips ?? [],
            ...options,
          }),
        );
        return await questionRepo.findOne({
          where: { id: question.id },
          order: matchOrder,
        });
      },
      { onError: async () => await this.files.cleanUp(fieldIds) },
    );
  }

  // all-or-nothing bulk create: any invalid question drops the whole
  // batch (single transaction, no partial inserts). No image support.
  async createMany(params: { params: QuestionCreateDto[]; schoolId: UUID }) {
    // validate everything before the first write — getNewOptions is where
    // the option/match checks live, so it has to run out here too
    let prepared = params.params.map((dto) => {
      this.assertDtos(dto);
      return { dto, children: this.getNewOptions(dto, params.schoolId) };
    });
    for (let { dto } of prepared) {
      if (dto.purpose == QuestionPurpose.lesson) {
        await this.assertLessonNotUsed(dto.lessonId!);
      }
    }
    return await transaction(this.ds, async (em) => {
      let questionRepo = em.getRepository(Question);

      let createdQ: any[] = [];
      for (let { dto, children } of prepared) {
        const lessonRef =
          dto.purpose == QuestionPurpose.lesson ? { id: dto.lessonId } : null;
        const courseRef =
          dto.purpose == QuestionPurpose.dailyChallenge
            ? { id: dto.courseId }
            : null;

        let question = await questionRepo.save(
          questionRepo.create({
            title: dto.title,
            type: dto.type,
            purpose: dto.purpose,
            lesson: lessonRef,
            course: courseRef,
            school: { id: params.schoolId },
            tips: dto.tips ?? [],
            ...children,
          }),
        );
        createdQ.push(question);
      }

      return createdQ;
    });
  }

  async update(params: {
    filter: FindOptionsWhere<Question>;
    params: QuestionEditDto;
    images?: QuestionImages;
  }) {
    let question = await this.repo.findOne({
      where: params.filter,
      relations: { lesson: true },
    });
    if (!question) {
      throw new NotFoundException();
    }
    if (question.lessonId) {
      await this.assertLessonNotUsed(question.lessonId);
    }

    let fileIds: UUID[] = [];
    return await transaction(
      this.ds,
      async (em) => {
        let questionRepo = em.getRepository(Question);

        // swap the image only when a new one was uploaded
        // (undefined = keep current, null = removed, id = swapped)
        let replaced = await this.files.replace({
          em,
          old: question.imageId,
          store: params.images?.question,
          folder: 'learning/questions',
        });
        if (replaced) {
          fileIds.push(replaced);
        }
        let updateFields: DeepPartial<Question> = {
          id: question.id,
          imageId: replaced,
          title: params.params.title,
          tips: params.params.tips,
        };
        await questionRepo.save(updateFields);
        return await questionRepo.findOne({
          where: { id: question.id },
          order: matchOrder,
        });
      },
      { onError: async () => await this.files.cleanUp(fileIds) },
    );
  }

  // The only delete path.
  // `em` joins the caller's transaction — `transaction()` always opens a new
  // one on a new connection, which would deadlock against locks the caller
  // already holds.
  // `skipGuards` is for cascade teardown (deleting a whole lesson or unit),
  // where the lesson is going away so the keep-one rule is moot.
  async deleteQuestions(
    params: FindOptionsWhere<Question>,
    opts?: { em?: EntityManager; skipGuards?: boolean },
  ) {
    return await this.deleteNew(params, opts?.em, opts?.skipGuards);
  }

  async checkAnswers(
    data: {
      id: UUID;
      answer: {
        choiceId?: UUID;
        boolAnswer?: boolean;
        matches?: { baseId: UUID; matchId: UUID }[];
      };
    }[],
    withAnswers: boolean = false,
  ) {
    let ids = data.map((e) => e.id);
    let questions = await this.repo.find({
      where: { id: In(ids) },
      order: matchOrder,
      relations: {
        lesson: true,
        school: true,
        matchingItems: true,
        course: true,
        options: true,
      },
    });
    if (questions.length != ids.length) {
      throw new NotFoundException('Questions not found');
    }
    let k: {
      answer: {
        choiceId?: UUID;
        boolAnswer?: boolean;
        matches?: { baseId: UUID; matchId: UUID }[];
      };
      question: Question;
    }[] = [];
    for (const q of questions) {
      let withIds = data.find((e) => e.id == q.id)!;
      k.push({ question: q, answer: withIds.answer });
    }
    return this.checkAnswerHelper(k, withAnswers);
  }

  async checkAnswerHelper(
    params: {
      question: Question;
      answer: {
        choiceId?: UUID;
        boolAnswer?: boolean;
        matches?: { baseId: UUID; matchId: UUID }[];
      };
    }[],
    withAnswers: boolean = false,
  ) {
    let res: QuestionVerdict[] = [];
    for (const data of params) {
      let question = data.question;
      let answer = data.answer;
      if (question.type == QuestionType.OPTIONS) {
        let option = question.options.find((e) => e.id == answer.choiceId);
        if (!option) {
          throw new BadRequestException('Option not found');
        }

        res.push({
          id: question.id,
          title: question.title,
          type: question.type,
          choiceVerdict: {
            answered: option,
            verdict: option.isCorrect,
            correctOption: question.options.find((e) => e.isCorrect),
          },
        });
        continue;
      }
      if (question.type == QuestionType.TRUE_FALSE) {
        let verdict = question.trueOrFalseAnswer == answer.boolAnswer;
        res.push({
          id: question.id,
          title: question.title,
          type: question.type,
          trueOrFalseVerdict: {
            answered: answer.boolAnswer == true,
            correct: verdict,
            correctAnswer: withAnswers
              ? question.trueOrFalseAnswer == true
              : undefined,
          },
        });
        continue;
      }
      if (question.type == QuestionType.MATCH) {
        let matches = question.matchingItems.filter(
          (e) => e.type == QuestionMatchType.match,
        );
        let bases = question.matchingItems.filter(
          (e) => e.type == QuestionMatchType.base,
        );
        // no submitted pairs (missing/empty `matches`) → no verdicts → the
        // question scores as wrong via the `passed` filter below (never a 500)
        let submitted = answer.matches ?? [];
        let matchVerdicts: MatchVerdict[] = [];
        for (let i = 0; i < submitted.length; i++) {
          let base = bases.find((e) => e.id == submitted[i].baseId);
          if (!base) {
            throw new BadRequestException('Base not found');
          }
          let match = matches.find((e) => e.id == submitted[i].matchId);
          if (!match) {
            throw new BadRequestException('Match not found');
          }
          // correctIndex is the `index` value of the correct match row, not a
          // position in the filtered `matches` array — resolve it by value
          let correct = question.matchingItems.find(
            (e) => e.index == base!.correctIndex,
          );
          // the base this match is the correct answer for (its correctIndex
          // names this match's index) — null if the match pairs with nothing
          let matchCorrectBase = bases.find(
            (b) => b.correctIndex == match!.index,
          );
          matchVerdicts.push({
            verdict: match.id == correct?.id,
            answeredBase: base,
            answeredMatch: match,
            baseCorrectMatch: withAnswers ? correct : undefined,
            matchCorrectBase: withAnswers ? matchCorrectBase : undefined,
          });
        }
        res.push({
          id: question.id,
          title: question.title,
          type: question.type,
          matchVerdicts: matchVerdicts,
        });
        continue;
      }
    }
    let passed = res.filter((e) => {
      if (e.choiceVerdict) {
        return e.choiceVerdict.verdict;
      }
      if (e.trueOrFalseVerdict) {
        return e.trueOrFalseVerdict.correct;
      }
      if (e.matchVerdicts?.length) {
        return e.matchVerdicts.every((e) => e.verdict == true);
      }
      return false;
    }).length;
    return { verdict: res, passed: passed, total: res.length };
  }

  // Student-facing view of a lesson's questions: strips every answer key —
  // the correct-option flag, the true/false answer, and each base's
  // correctIndex — leaving text/type/order intact so the client can render
  // and answer. Returns plain objects; the entities are left untouched.
  hideAnswers(questions: Question[]) {
    return questions.map((q) => {
      const { trueOrFalseAnswer, options, matchingItems, ...rest } = q;
      return {
        ...rest,
        options: options?.map(({ isCorrect, ...o }) => o),
        matchingItems: matchingItems?.map(({ correctIndex, ...m }) => m),
      };
    });
  }

  private async deleteNew(
    params: FindOptionsWhere<Question>,
    em?: EntityManager,
    skipGuards?: boolean,
  ) {
    let repo = em?.getRepository(Question) || this.repo;
    let questions = await repo.find({
      where: params,
      relations: { lesson: { questions: true } },
    });
    if (!questions.length) return;

    if (!skipGuards) {
      // a used lesson's questions are frozen — can't be removed. Skipped on
      // cascade teardown (skipGuards), so deleting the lesson itself still works.
      for (let lessonId of new Set(
        questions.map((q) => q.lessonId).filter((id): id is UUID => !!id),
      )) {
        await this.assertLessonNotUsed(lessonId, em);
      }
      // pool questions are frozen only while TODAY's challenge uses them, and
      // one used question stops the whole delete. Rows in past challenges just
      // cascade away with the question.
      let usedTodayDC = await this.ds
        .getRepository(DailyChallengeUsedQuestions)
        .find({
          where: {
            question: { id: In(questions.map((e) => e.id)) },
            challenge: { date: todayDateString() },
          },
          relations: { question: true },
        });
      if (usedTodayDC.length) {
        throw new BadRequestException(
          "Cannot delete a question used by today's daily challenge: " +
            usedTodayDC.map((u) => u.question.id).join(', '),
        );
      }
      // a published lesson must keep a question — set it to draft first
      for (let q of questions) {
        if (
          q.lesson?.questions.length == 1 &&
          q.lesson?.status == LessonStatusType.published
        ) {
          throw new BadRequestException(
            'Cannot delete the last question of a published lesson',
          );
        }
      }
    }

    let run = async (em: EntityManager) => {
      // soft-remove owned images (trigger erases them from disk on commit)
      await this.files.softRemove(
        questions.map((q) => q.imageId!).filter((id) => !!id),
        em,
      );
      // CASCADE removes the option/match rows
      await em.getRepository(Question).remove(questions);
    };
    return em ? await run(em) : await transaction(this.ds, run);
  }

  private checkMatch(matches: QuestionMatchDto[]) {
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
      if (matches[i].correctIndex >= matches.length) {
        throw new BadRequestException('Base correct index is wrong');
      }
      if (usedIndicies.includes(matches[i].correctIndex)) {
        throw new BadRequestException('Match Can Be Used For Only One Base');
      }
      if (matches[matches[i].correctIndex].type == QuestionMatchType.base) {
        throw new BadRequestException('Correct Answer Should Be Match Only');
      }
      usedIndicies.push(matches[i].correctIndex);
    }
  }

  private checkOptions(options: QuestionOptionDto[]) {
    if (options.filter((e) => e.isCorrect).length != 1) {
      throw new BadRequestException('Only One Option Is Correct');
    }
  }

  private getNewOptions(
    params: QuestionCreateDto,
    schoolId: UUID,
  ): DeepPartial<Question> {
    if (params.type == QuestionType.TRUE_FALSE) {
      return {
        trueOrFalseAnswer: params.correctAnswer!,
      };
    }
    if (params.type == QuestionType.OPTIONS) {
      this.checkOptions(params.options!);

      return {
        options: params.options!.map((e) => ({
          text: e.text,
          isCorrect: e.isCorrect,
          school: { id: schoolId! },
        })),
      };
    }
    if (params.type == QuestionType.MATCH) {
      this.checkMatch(params.matchingItems!);

      return {
        // index is the position as sent — correctIndex on a base row points
        // at one of these values, so the pairing can't drift with row order
        matchingItems: params.matchingItems!.map((e, i) => ({
          text: e.text,
          type: e.type,
          index: i,
          correctIndex: e.correctIndex ?? null,
          school: { id: schoolId! },
        })),
      };
    }
    return {};
  }

  private assertDtos(params: QuestionCreateDto) {
    if (params.purpose == QuestionPurpose.dailyChallenge && params.lessonId) {
      throw new BadRequestException(
        'Daily challenge questions cannot have a lesson',
      );
    }
    if (params.purpose == QuestionPurpose.lesson && params.courseId) {
      throw new BadRequestException(
        'Lesson questions cannot have a course — it comes from the lesson',
      );
    }
  }
}
