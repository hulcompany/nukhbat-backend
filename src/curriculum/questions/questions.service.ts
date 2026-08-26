import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';
import { applyPsqlFilter, BasePaginationModel, transaction } from 'core';
import { FileService } from '../../file/file.service';
import { LessonUsed } from '../lessons/entity/lesson-used.entity';
import { LessonStatusType } from '../lessons/entity/lesson.status.type';
import { DailyChallengeUsedQuestions } from '../daily-challenge/entity/daily-challenge-used-questions.entity';
import { todayDateString } from '../daily-challenge/daily-challenge.service';
import {
  AdminQuestionGetDto,
  QuestionCreateDto,
  QuestionEditDto,
  QuestionGetDto,
} from './dto/question.dto';
import { QuestionPurpose } from './entity/enum/question-purpose.type';
import { QuestionType } from './entity/enum/question.type';
import { Question } from './entity/questions.entity';
import { QuestionOptionsService } from './components/question-options.service';
import { QuestionClassifyService } from './components/question-classify.service';
import { QuestionFillBlankService } from './components/question-fill-blanks.service';
import { QuestionMatchService } from './components/question-match.service';
import { QuestionOrderService } from './components/question-order.service';
import { QuestionTrueOrFalseService } from './components/question-true-or-false.service';
import { QuestionComponentService } from './components/question-component.service';
import {
  QuestionMap,
  QuestionVerdict,
  QuestionVerdictResult,
} from './types/question-verdict.type';

type QuestionImages = {
  question?: Express.Multer.File | null;
};

const questionOrder: FindOptionsOrder<Question> = {
  optionsGroups: { index: 'ASC' },
  matchingItems: { index: 'ASC' },
  classifyItems: { index: 'ASC' },
  orderItems: { sort: 'ASC' },
  fillBlanks: { index: 'ASC' },
};

const questionRelations: FindOptionsRelations<Question> = {
  course: true,
  lesson: true,
  school: true,
  optionsGroups: { options: true },
  trueOrFalse: true,
  classifyItems: true,
  matchingItems: true,
  orderItems: true,
  fillBlanks: true,
};

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question) private readonly repo: Repository<Question>,
    @InjectRepository(LessonUsed)
    private readonly lessonUsedRepo: Repository<LessonUsed>,
    private readonly files: FileService,
    private readonly ds: DataSource,
    private readonly options: QuestionOptionsService,
    private readonly classify: QuestionClassifyService,
    private readonly fillBlanks: QuestionFillBlankService,
    private readonly match: QuestionMatchService,
    private readonly order: QuestionOrderService,
    private readonly trueOrFalse: QuestionTrueOrFalseService,
  ) {}

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
    return this.repo.find({
      where: filter,
      select,
      relations: questionRelations,
      order: questionOrder,
    });
  }

  async getByCriteria(params: {
    params: QuestionGetDto | AdminQuestionGetDto;
    schoolId?: UUID;
    trackId?: UUID;
    filter?: any;
  }) {
    const query = params.params;

    /**
     * المرحلة الأولى: جلب معرفات صفحة النتائج فقط.
     * لا نضم هنا أي علاقة متعددة (options/blanks/...) ولا نرتب بأعمدتها،
     * لأن TypeORM يضيف أعمدة الترتيب إلى الـ DISTINCT الخاص بالترقيم
     * فيستهلك السؤال الواحد عدة أسطر من الـ limit ونحصل على أسئلة أقل من المطلوب.
     */
    const idsQb = this.repo
      .createQueryBuilder('q')
      .leftJoin('q.lesson', 'lesson')
      .orderBy('q.id', 'ASC');

    if (params.schoolId) {
      idsQb.andWhere('q.school = :schoolId', { schoolId: params.schoolId });
    }
    if (query.lessonId) {
      idsQb.andWhere('q.lesson = :lessonId', { lessonId: query.lessonId });
    }
    if (query.courseId) {
      idsQb.andWhere('q.course = :courseId', { courseId: query.courseId });
    }
    if (params.trackId) {
      idsQb
        .leftJoin('q.course', 'poolCourse')
        .leftJoin('lesson.unit', 'qUnit')
        .leftJoin('qUnit.course', 'lessonCourse')
        .andWhere(
          '(poolCourse.trackId = :trackId OR lessonCourse.trackId = :trackId)',
          { trackId: params.trackId },
        );
    }

    applyPsqlFilter({
      queryBuilder: idsQb,
      query,
      options: {
        title: { regExp: { regexp: 'contains' } },
        lessonId: { skip: true },
        courseId: { skip: true },
        schoolId: { skip: true },
        trackId: { skip: true },
      },
    });

    const [page, count] = await idsQb.getManyAndCount();
    const ids = page.map((question) => question.id);

    /**
     * المرحلة الثانية: تحميل أسئلة الصفحة كاملة بمكوناتها بدون أي ترقيم
     */
    const loaded = ids.length
      ? await this.repo.find({
          where: { id: In(ids) },
          relations: questionRelations,
          order: questionOrder,
        })
      : [];
    const loadedById = new Map(
      loaded.map((question) => [question.id, question]),
    );
    const data = ids
      .map((id) => loadedById.get(id))
      .filter(Boolean) as Question[];

    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: query.skip,
      limit: query.limit,
    });
  }

  async findOne(filter: FindOptionsWhere<Question>) {
    const question = await this.repo.findOne({
      where: filter,
      relations: questionRelations,
      order: questionOrder,
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
    this.validateComponent(params.params);
    if (params.params.purpose === QuestionPurpose.lesson) {
      await this.assertLessonNotUsed(params.params.lessonId!);
    }

    const questionImage = await this.files.store(
      params.images?.question,
      'learning/questions',
    );
    const fieldIds = questionImage ? [questionImage.id] : [];

    return transaction(
      this.ds,
      async (em) => {
        if (questionImage) {
          await this.files.use({ id: questionImage.id, dm: em });
        }
        return this.createQuestion(
          params.params,
          params.schoolId,
          em,
          questionImage?.id,
        );
      },
      { onError: async () => await this.files.cleanUp(fieldIds) },
    );
  }

  async createMany(params: { params: QuestionCreateDto[]; schoolId: UUID }) {
    for (const dto of params.params) {
      this.assertDtos(dto);
      this.validateComponent(dto);
      if (dto.purpose === QuestionPurpose.lesson) {
        await this.assertLessonNotUsed(dto.lessonId!);
      }
    }

    return transaction(this.ds, async (em) => {
      const questions: Question[] = [];
      for (const dto of params.params) {
        questions.push(await this.createQuestion(dto, params.schoolId, em));
      }
      return questions;
    });
  }

  async update(params: {
    filter: FindOptionsWhere<Question>;
    params: QuestionEditDto;
    images?: QuestionImages;
  }) {
    const question = await this.repo.findOne({
      where: params.filter,
      relations: { lesson: true, fillBlanks: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    if (question.lessonId) {
      await this.assertLessonNotUsed(question.lessonId);
    }
    if (params.params.title !== undefined) {
      if (question.type === QuestionType.fillBlanks) {
        this.fillBlanks.validate({
          text: params.params.title,
          data: question.fillBlanks,
        });
      } else if (/\{\{\s*textField\b/.test(params.params.title)) {
        throw new BadRequestException(
          'Text-field placeholders are only allowed for fill-blank questions',
        );
      }
    }

    const fileIds: UUID[] = [];
    return transaction(
      this.ds,
      async (em) => {
        const imageId = await this.files.replace({
          em,
          old: question.imageId,
          store: params.images?.question,
          folder: 'learning/questions',
        });
        if (imageId) {
          fileIds.push(imageId);
        }

        await em.getRepository(Question).save({
          id: question.id,
          imageId,
          title: params.params.title,
          tips: params.params.tips,
        });
        return this.findOneWithManager(question.id, em);
      },
      { onError: async () => this.files.cleanUp(fileIds) },
    );
  }

  async deleteQuestions(
    params: FindOptionsWhere<Question>,
    opts?: { em?: EntityManager; skipGuards?: boolean },
  ) {
    return this.deleteNew(params, opts?.em, opts?.skipGuards);
  }

  async checkAnswerHelper(
    params: QuestionMap[],
  ): Promise<QuestionVerdictResult> {
    const verdicts: QuestionVerdict[] = [];
    for (const { question, answer } of params) {
      const result = await this.getComponent(question.type).verdict(
        question,
        this.getComponentAnswer(question.type, answer),
      );
      verdicts.push({
        id: question.id,
        title: question.title,
        type: question.type,
        verdict: result.verdict,
        isSkipped: result.skipped,
        result,
      });
    }
    let passed = verdicts.filter((item) => item.verdict).length;
    let total = verdicts.length;
    return {
      verdicts: verdicts,
      correct: passed,
      total: total,
      skipped: verdicts.filter((item) => item.isSkipped).length,
      score: passed / total,
      passed: passed === total,
    };
  }

  hideAnswers(questions: Question[]) {
    return questions.map((question) =>
      this.getComponent(question.type).hideAnswers(question),
    );
  }

  private async createQuestion(
    dto: QuestionCreateDto,
    schoolId: UUID,
    em: EntityManager,
    imageId?: UUID,
  ) {
    const question = await em.getRepository(Question).save(
      em.getRepository(Question).create({
        title: dto.title,
        type: dto.type,
        purpose: dto.purpose,
        lesson:
          dto.purpose === QuestionPurpose.lesson ? { id: dto.lessonId } : null,
        course:
          dto.purpose === QuestionPurpose.dailyChallenge
            ? { id: dto.courseId }
            : null,
        school: { id: schoolId },
        imageId,
        tips: dto.tips ?? [],
      }),
    );
    await this.createComponent({ dto, questionId: question.id, schoolId, em });
    return this.findOneWithManager(question.id, em);
  }

  private async createComponent(params: {
    dto: QuestionCreateDto;
    questionId: UUID;
    schoolId: UUID;
    em: EntityManager;
  }) {
    const { dto, questionId, schoolId, em } = params;
    switch (dto.type) {
      case QuestionType.OPTIONS:
        return this.options.create(
          { id: questionId, schoolId, groups: dto.optionGroups! },
          em,
        );
      case QuestionType.MATCH:
        return this.match.create(
          { id: questionId, schoolId, matches: dto.matchingItems! },
          em,
        );
      case QuestionType.TRUE_FALSE:
        return this.trueOrFalse.create(
          { id: questionId, schoolId, data: dto.correctAnswer },
          em,
        );
      case QuestionType.classify:
        return this.classify.create(
          { id: questionId, schoolId, data: dto.classify! },
          em,
        );
      case QuestionType.order:
        return this.order.create(
          { id: questionId, schoolId, data: dto.orders! },
          em,
        );
      case QuestionType.fillBlanks:
        return this.fillBlanks.create(
          { id: questionId, schoolId, text: dto.title, data: dto.fillBlanks! },
          em,
        );
    }
    throw new BadRequestException('Unsupported question type');
  }

  private validateComponent(dto: QuestionCreateDto) {
    this.assertComponentPayload(dto);
    if (
      dto.type !== QuestionType.fillBlanks &&
      /\{\{\s*textField\b/.test(dto.title)
    ) {
      throw new BadRequestException(
        'Text-field placeholders are only allowed for fill-blank questions',
      );
    }

    switch (dto.type) {
      case QuestionType.OPTIONS:
        this.options.validate(dto.optionGroups!);
        return;
      case QuestionType.MATCH:
        this.match.validate(dto.matchingItems!);
        return;
      case QuestionType.TRUE_FALSE:
        this.trueOrFalse.validate(dto.correctAnswer);
        return;
      case QuestionType.classify:
        this.classify.validate(dto.classify!);
        return;
      case QuestionType.order:
        this.order.validate(dto.orders!);
        return;
      case QuestionType.fillBlanks:
        this.fillBlanks.validate({ text: dto.title, data: dto.fillBlanks! });
        return;
    }
    throw new BadRequestException('Unsupported question type');
  }

  private getComponent(type: QuestionType): QuestionComponentService {
    switch (type) {
      case QuestionType.OPTIONS:
        return this.options;
      case QuestionType.MATCH:
        return this.match;
      case QuestionType.TRUE_FALSE:
        return this.trueOrFalse;
      case QuestionType.classify:
        return this.classify;
      case QuestionType.order:
        return this.order;
      case QuestionType.fillBlanks:
        return this.fillBlanks;
    }
    // throw new BadRequestException('Unsupported question type');
  }

  private getComponentAnswer(type: QuestionType, answer: any) {
    answer ??= {};
    this.assertAnswerPayload(type, answer);
    switch (type) {
      case QuestionType.OPTIONS:
        return answer.options ?? [];
      case QuestionType.MATCH:
        return answer.matches ?? [];
      case QuestionType.TRUE_FALSE:
        return { answered: answer.boolAnswer };
      case QuestionType.classify:
        return answer.classify ?? [];
      case QuestionType.order:
        return answer.orders ?? [];
      case QuestionType.fillBlanks:
        return answer.fillBlanks ?? [];
    }
    throw new BadRequestException('Unsupported question type');
  }

  private assertAnswerPayload(type: QuestionType, answer: any) {
    const answerFields: Record<QuestionType, string> = {
      [QuestionType.OPTIONS]: 'options',
      [QuestionType.MATCH]: 'matches',
      [QuestionType.TRUE_FALSE]: 'boolAnswer',
      [QuestionType.classify]: 'classify',
      [QuestionType.order]: 'orders',
      [QuestionType.fillBlanks]: 'fillBlanks',
    };
    const expectedField = answerFields[type];
    for (const field of Object.values(answerFields)) {
      if (field !== expectedField && answer[field] !== undefined) {
        throw new BadRequestException(
          `${field} is not allowed for ${type} answers`,
        );
      }
    }
  }

  private assertComponentPayload(dto: QuestionCreateDto) {
    const componentFields: Record<QuestionType, keyof QuestionCreateDto> = {
      [QuestionType.OPTIONS]: 'optionGroups',
      [QuestionType.MATCH]: 'matchingItems',
      [QuestionType.TRUE_FALSE]: 'correctAnswer',
      [QuestionType.classify]: 'classify',
      [QuestionType.order]: 'orders',
      [QuestionType.fillBlanks]: 'fillBlanks',
    };
    const expectedField = componentFields[dto.type];
    for (const field of Object.values(componentFields)) {
      if (field !== expectedField && dto[field] !== undefined) {
        throw new BadRequestException(
          `${String(field)} is not allowed for ${dto.type} questions`,
        );
      }
    }
  }

  private async findOneWithManager(id: UUID, em: EntityManager) {
    const question = await em.getRepository(Question).findOne({
      where: { id },
      relations: questionRelations,
      order: questionOrder,
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  private async deleteNew(
    params: FindOptionsWhere<Question>,
    em?: EntityManager,
    skipGuards?: boolean,
  ) {
    const repo = em?.getRepository(Question) || this.repo;
    const questions = await repo.find({
      where: params,
      relations: { lesson: { questions: true } },
    });
    if (!questions.length) return;

    if (!skipGuards) {
      for (const lessonId of new Set(
        questions
          .map((question) => question.lessonId)
          .filter(Boolean) as UUID[],
      )) {
        await this.assertLessonNotUsed(lessonId, em);
      }
      const usedToday = await (em ?? this.ds.manager)
        .getRepository(DailyChallengeUsedQuestions)
        .find({
          where: {
            question: { id: In(questions.map((question) => question.id)) },
            challenge: { date: todayDateString() },
          },
          relations: { question: true },
        });
      if (usedToday.length) {
        throw new BadRequestException(
          "Cannot delete a question used by today's daily challenge: " +
            usedToday.map((used) => used.question.id).join(', '),
        );
      }
      for (const question of questions) {
        if (
          question.lesson?.questions.length === 1 &&
          question.lesson.status === LessonStatusType.published
        ) {
          throw new BadRequestException(
            'Cannot delete the last question of a published lesson',
          );
        }
      }
    }

    const run = async (manager: EntityManager) => {
      await this.files.softRemove(
        questions.map((question) => question.imageId!).filter(Boolean),
        manager,
      );
      await manager.getRepository(Question).remove(questions);
    };
    return em ? run(em) : transaction(this.ds, run);
  }

  private assertDtos(params: QuestionCreateDto) {
    if (params.purpose === QuestionPurpose.dailyChallenge && params.lessonId) {
      throw new BadRequestException(
        'Daily challenge questions cannot have a lesson',
      );
    }
    if (params.purpose === QuestionPurpose.lesson && params.courseId) {
      throw new BadRequestException(
        'Lesson questions cannot have a course - it comes from the lesson',
      );
    }
  }
}
