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
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { Question } from './entity/questions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
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
import { ReqContext } from '../../context';
import { QuestionPurpose } from './entity/enum/question-purpose.type';
import { DailyChallengeUsedQuestions } from '../daily-challenge/entity/daily-challenge-used-questions.entity';
import { todayDateString } from '../daily-challenge/daily-challenge.service';
import { AdminQuestionGetDto } from '../dto/learning-admin.dto';

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
    private readonly files: FileService,
    private readonly ds: DataSource,
  ) {}

  async find(filter: FindOptionsWhere<Question>) {
    return await this.repo.find({ where: filter, order: matchOrder });
  }

  // paginated list. With an explicit lessonId/courseId the caller has
  // already asserted access; without one, every school question is
  // returned EXCEPT those hanging off a track the school can't use
  // (lesson OR course must be null or lead to an allowed track).
  // Admin callers pass schoolId directly (no ctxt) — school scoping is
  // then a plain filter and the track-access clauses are skipped.
  async getByCriteria(params: {
    params: QuestionGetDto | AdminQuestionGetDto;
    ctxt?: ReqContext;
    schoolId?: UUID;
    trackId?: UUID;
    filter?: any;
  }) {
    const query = params.params;
    const schoolId = params.ctxt?.school?.id ?? params.schoolId;

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
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async create(params: {
    params: QuestionCreateDto;
    images?: QuestionImages;
    ctxt: ReqContext;
  }) {
    this.assertDtos(params.params);
    const lessonRef =
      params.params.purpose == QuestionPurpose.lesson
        ? { id: params.params.lessonId }
        : null;
    // and only they attach to a course
    const courseRef =
      params.params.purpose == QuestionPurpose.dailyChallenge
        ? { id: params.params.courseId }
        : null;
    let options = this.getNewOptions(params.params, params.ctxt.school!.id);
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
            school: { id: params.ctxt.school?.id },
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
  async createMany(params: { params: QuestionCreateDto[]; ctxt: ReqContext }) {
    // validate everything before the first write — getNewOptions is where
    // the option/match checks live, so it has to run out here too
    let prepared = params.params.map((dto) => {
      this.assertDtos(dto);
      return { dto, children: this.getNewOptions(dto, params.ctxt.school!.id) };
    });
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
            school: { id: params.ctxt.school?.id },
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
          type: params.params.type,
          // pass the whole new list to replace; [] clears; undefined keeps
          ...(params.params.tips !== undefined
            ? { tips: params.params.tips }
            : {}),
          // the school relation isn't loaded here; schoolId is the @RelationId
          ...this.getNewOptions(params.params, question.schoolId!),
        };
        if (params.params.type) {
          await this.cleanQuestion(question, em);
        }
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
    params: QuestionCreateDto | QuestionEditDto,
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

  // every edit replaces the answer key wholesale, so this wipes all three
  // shapes regardless of the old type
  private async cleanQuestion(question: Question, em: EntityManager) {
    await em
      .getRepository(Question)
      .update({ id: question.id }, { trueOrFalseAnswer: null });
    await em
      .getRepository(QuestionMatch)
      .delete({ question: { id: question.id } });
    // options are eager, so the old rows are already loaded on `question`
    for (let o of question.options ?? []) {
      if (o.imageId) await this.files.softRemove(o.imageId, em);
    }
    await em
      .getRepository(QuestionOption)
      .delete({ question: { id: question.id } });
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
