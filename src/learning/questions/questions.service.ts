import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
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
import { Course } from '../course/entity/course.entity';
import { Lesson } from '../lessons/entity/lesson.entity';
import { ReqContext } from '../../context';
import { QuestionPurpose } from './entity/enum/question-purpose.type';
import { DailyChallengeUsedQuestions } from '../daily-challenge/entity/daily-challenge-used-questions.entity';
import { todayDateString } from '../daily-challenge/daily-challenge.service';

type QuestionImages = {
  question?: Express.Multer.File | null;
  // options?: (Express.Multer.File | null | undefined)[];
};

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question) private readonly repo: Repository<Question>,
    private readonly files: FileService,
    private readonly ds: DataSource,
  ) {}

  async find(filter: FindOptionsWhere<Question>) {
    return await this.repo.find({
      where: filter,
      order: { index: 'ASC' },
    });
  }

  // paginated list. With an explicit lessonId/courseId the caller has
  // already asserted access; without one, every school question is
  // returned EXCEPT those hanging off a track the school can't use
  // (lesson OR course must be null or lead to an allowed track).
  // Admin callers pass schoolId directly (no ctxt) — school scoping is
  // then a plain filter and the track-access clauses are skipped.
  async getByCriteria(params: {
    params: QuestionGetDto;
    ctxt?: ReqContext;
    schoolId?: UUID;
    filter?: any;
  }) {
    const query = params.params;
    const schoolId = params.ctxt?.school?.id ?? params.schoolId;

    // eager relations don't load through a query builder — join them so
    // list items keep the same shape as findOne
    const qb = this.repo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .leftJoinAndSelect('q.matchingItems', 'matchingItems')
      .leftJoinAndSelect('q.school', 'school')
      .orderBy('q.index', 'ASC');

    if (schoolId) {
      qb.andWhere('q.school = :schoolId', { schoolId });
    }
    if (query.lessonId) {
      qb.andWhere('q.lesson = :lessonId', { lessonId: query.lessonId });
    }
    if (query.courseId) {
      qb.andWhere('q.course = :courseId', { courseId: query.courseId });
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
    let question = await this.repo.findOne({ where: filter });
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
    const purpose = params.params.purpose ?? QuestionPurpose.lesson;
    if (purpose == QuestionPurpose.dailyChallenge && params.params.lessonId) {
      throw new BadRequestException(
        'Daily challenge questions cannot have a lesson',
      );
    }
    if (purpose == QuestionPurpose.lesson && params.params.courseId) {
      throw new BadRequestException(
        'Lesson questions cannot have a course — it comes from the lesson',
      );
    }
    if (purpose == QuestionPurpose.lesson) {
      let lesson = await this.ds
        .getRepository(Lesson)
        .findOne({ where: { id: params.params.lessonId } });

      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
      if (lesson?.status == LessonStatusType.active) {
        throw new BadRequestException('No adding questions to active lesson.');
      }
    } else {
      let courseExists = await this.ds
        .getRepository(Course)
        .exists({ where: { id: params.params.courseId } });
      if (!courseExists) {
        throw new NotFoundException('Course not found');
      }
    }
    // dailyChallenge questions never attach to a lesson, even if one was sent
    const lessonRef =
      purpose == QuestionPurpose.lesson ? { id: params.params.lessonId } : null;
    // and only they attach to a course
    const courseRef =
      purpose == QuestionPurpose.dailyChallenge
        ? { id: params.params.courseId }
        : null;
    if (params.params.type == QuestionType.MATCH) {
      this.checkMatch(params.params.matchingItems!);
    } else {
      this.checkOptions(params.params.options!);
    }
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

        // index is unique per (school, lesson): use max+1, not count+1,
        // so gaps left by deletions can't collide. The daily-challenge
        // pool (NULL lesson) counts per course, though the DB can't
        // enforce it there
        let last = await questionRepo.find({
          where: {
            school: { id: params.ctxt.school?.id },
            lesson: lessonRef ? { id: params.params.lessonId } : IsNull(),
            course: courseRef ? { id: params.params.courseId } : IsNull(),
          },
          order: { index: 'DESC' },
          take: 1,
        });
        let nextIndex = (last[0]?.index ?? 0) + 1;

        if (questionImage) {
          await this.files.use({ id: questionImage.id, dm: em });
        }

        let question = await questionRepo.save(
          questionRepo.create({
            title: params.params.title,
            type: params.params.type,
            purpose: purpose,
            index: nextIndex,
            lesson: lessonRef,
            course: courseRef,
            school: { id: params.ctxt.school?.id },
            imageId: questionImage?.id,
          }),
        );

        if (params.params.type == QuestionType.OPTIONS) {
          await this.insertOptions(
            em,
            params.params.options!,
            question.id,
            params.ctxt.school?.id,
          );
        } else {
          await this.insertMatches(
            em,
            params.params.matchingItems!,
            question.id,
            params.ctxt.school?.id,
          );
        }

        return await questionRepo.findOne({ where: { id: question.id } });
      },
      { onError: async () => await this.files.cleanUp(fieldIds) },
    );
  }

  // all-or-nothing bulk create: any invalid question drops the whole
  // batch (single transaction, no partial inserts). No image support.
  async createMany(params: { params: QuestionCreateDto[]; ctxt: ReqContext }) {
    let items = params.params.map((dto) => ({
      dto,
      purpose: dto.purpose ?? QuestionPurpose.lesson,
    }));

    // validate everything before the first write
    for (let { dto, purpose } of items) {
      if (purpose == QuestionPurpose.dailyChallenge && dto.lessonId) {
        throw new BadRequestException(
          'Daily challenge questions cannot have a lesson',
        );
      }
      if (purpose == QuestionPurpose.lesson && dto.courseId) {
        throw new BadRequestException(
          'Lesson questions cannot have a course — it comes from the lesson',
        );
      }
      if (dto.type == QuestionType.MATCH) {
        this.checkMatch(dto.matchingItems!);
      } else {
        this.checkOptions(dto.options!);
      }
    }

    // existence/lock checks, one query per entity type
    let lessonIds = [
      ...new Set(
        items
          .filter((i) => i.purpose == QuestionPurpose.lesson)
          .map((i) => i.dto.lessonId!),
      ),
    ];
    if (lessonIds.length) {
      let lessons = await this.ds
        .getRepository(Lesson)
        .find({ where: { id: In(lessonIds) } });
      if (lessons.length != lessonIds.length) {
        let found = new Set(lessons.map((l) => l.id));
        throw new NotFoundException(
          'Lesson not found ' + lessonIds.find((id) => !found.has(id)),
        );
      }
      let active = lessons.find((l) => l.status == LessonStatusType.active);
      if (active) {
        throw new BadRequestException('No adding questions to active lesson.');
      }
    }
    let courseIds = [
      ...new Set(
        items
          .filter((i) => i.purpose == QuestionPurpose.dailyChallenge)
          .map((i) => i.dto.courseId!),
      ),
    ];
    if (courseIds.length) {
      let courses = await this.ds
        .getRepository(Course)
        .find({ where: { id: In(courseIds) } });
      if (courses.length != courseIds.length) {
        let found = new Set(courses.map((c) => c.id));
        throw new NotFoundException(
          'Course not found ' + courseIds.find((id) => !found.has(id)),
        );
      }
    }

    return await transaction(this.ds, async (em) => {
      let questionRepo = em.getRepository(Question);

      // per-target max+1, then count up locally within the batch
      let nextIndex = new Map<string, number>();
      let createdIds: UUID[] = [];
      for (let { dto, purpose } of items) {
        const lessonRef =
          purpose == QuestionPurpose.lesson ? { id: dto.lessonId } : null;
        const courseRef =
          purpose == QuestionPurpose.dailyChallenge
            ? { id: dto.courseId }
            : null;
        const key = lessonRef
          ? 'lesson:' + dto.lessonId
          : 'course:' + dto.courseId;
        if (!nextIndex.has(key)) {
          let last = await questionRepo.find({
            where: {
              school: { id: params.ctxt.school?.id },
              lesson: lessonRef ? { id: dto.lessonId } : IsNull(),
              course: courseRef ? { id: dto.courseId } : IsNull(),
            },
            order: { index: 'DESC' },
            take: 1,
          });
          nextIndex.set(key, (last[0]?.index ?? 0) + 1);
        }
        let index = nextIndex.get(key)!;
        nextIndex.set(key, index + 1);

        let question = await questionRepo.save(
          questionRepo.create({
            title: dto.title,
            type: dto.type,
            purpose: purpose,
            index: index,
            lesson: lessonRef,
            course: courseRef,
            school: { id: params.ctxt.school?.id },
          }),
        );
        createdIds.push(question.id);

        if (dto.type == QuestionType.OPTIONS) {
          await this.insertOptions(
            em,
            dto.options!,
            question.id,
            params.ctxt.school?.id,
          );
        } else {
          await this.insertMatches(
            em,
            dto.matchingItems!,
            question.id,
            params.ctxt.school?.id,
          );
        }
      }

      // return in input order (In() doesn't preserve it)
      let created = await questionRepo.find({
        where: { id: In(createdIds) },
      });
      let byId = new Map(created.map((q) => [q.id, q]));
      return createdIds.map((id) => byId.get(id)!);
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
    // dailyChallenge questions have no lesson — no active-lesson lock
    if (question.lesson?.status == LessonStatusType.active) {
      throw new BadRequestException(
        'Cannot update a question that belongs to an active lesson',
      );
    }

    const oldType = question.type;
    const newType = params.params.type ?? oldType;
    // items are only honored when `type` is explicitly sent (the DTO also
    // only validates them in that case); no type -> children untouched
    const replaceChildren = !!params.params.type;

    // validate the incoming items against the sent type, before any write
    if (replaceChildren) {
      if (newType == QuestionType.OPTIONS) {
        if (!params.params.options?.length) {
          throw new BadRequestException(
            'Options are required for multiple choice',
          );
        }
        this.checkOptions(params.params.options);
      } else {
        if (!params.params.matchingItems?.length) {
          throw new BadRequestException(
            'Matching items are required for match',
          );
        }
        this.checkMatch(params.params.matchingItems);
      }
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
        if (replaced !== undefined) {
          question.imageId = replaced;
        }
        if (params.params.title !== undefined) {
          question.title = params.params.title;
        }

        if (replaceChildren) {
          // tear down the old children (old type) → switch type → build new
          await this.clearChildren(em, question, oldType);
          question.type = newType;
        }
        await questionRepo.save(question);

        if (replaceChildren) {
          if (newType == QuestionType.OPTIONS) {
            await this.insertOptions(
              em,
              params.params.options!,
              question.id,
              question.schoolId,
            );
          } else {
            await this.insertMatches(
              em,

              params.params.matchingItems!,
              question.id,
              question.schoolId,
            );
          }
        }

        return await questionRepo.findOne({ where: { id: question.id } });
      },
      { onError: async () => await this.files.cleanUp(fileIds) },
    );
  }

  async delete(filter: FindOptionsWhere<Question>) {
    let question = await this.repo.findOne({
      where: filter,
      relations: { lesson: true },
    });
    if (!question) {
      throw new NotFoundException();
    }
    if (question.lesson?.status == LessonStatusType.active) {
      throw new BadRequestException(
        'Cannot delete a question that belongs to an active lesson',
      );
    }
    // pool questions are frozen only while TODAY's challenge uses them;
    // rows in past challenges just cascade away with the question
    if (question.purpose == QuestionPurpose.dailyChallenge) {
      let usedToday = await this.ds
        .getRepository(DailyChallengeUsedQuestions)
        .exists({
          where: {
            question: { id: question.id },
            challenge: {
              date: todayDateString(),
              school: { id: question.schoolId },
            },
          },
        });
      if (usedToday) {
        throw new BadRequestException(
          "Cannot delete a question used by today's daily challenge",
        );
      }
    }
    await transaction(this.ds, async (em) => {
      let questionRepo = em.getRepository(Question);

      // soft-remove all owned images (trigger erases them from disk on commit)
      if (question.imageId) await this.files.softRemove(question.imageId, em);

      // CASCADE removes the option/match rows
      let res = await questionRepo.delete({ id: question.id });
      if (!res.affected) {
        throw new NotFoundException();
      }
    });
  }

  // all-or-nothing bulk delete: every id must exist and be deletable
  // (no active lesson, not in today's challenge) or nothing is deleted
  async deleteMany(filter: FindOptionsWhere<Question>, ids: UUID[]) {
    ids = [...new Set(ids)];
    let questions = await this.repo.find({
      where: { ...filter, id: In(ids) },
      relations: { lesson: true },
    });
    let found = new Set(questions.map((q) => q.id));
    for (let id of ids) {
      if (!found.has(id)) {
        throw new NotFoundException('Question not found ' + id);
      }
    }

    for (let q of questions) {
      if (q.lesson?.status == LessonStatusType.active) {
        throw new BadRequestException(
          'Cannot delete a question that belongs to an active lesson: ' + q.id,
        );
      }
    }

    // same rule as single delete: pool questions are frozen only while
    // TODAY's challenge uses them
    let dcQuestions = questions.filter(
      (q) => q.purpose == QuestionPurpose.dailyChallenge,
    );
    if (dcQuestions.length) {
      let usedToday = await this.ds
        .getRepository(DailyChallengeUsedQuestions)
        .exists({
          where: {
            question: { id: In(dcQuestions.map((q) => q.id)) },
            challenge: {
              date: todayDateString(),
              school: { id: dcQuestions[0].schoolId },
            },
          },
        });
      if (usedToday) {
        throw new BadRequestException(
          "Cannot delete questions used by today's daily challenge",
        );
      }
    }

    await transaction(this.ds, async (em) => {
      let questionRepo = em.getRepository(Question);
      for (let q of questions) {
        if (q.imageId) await this.files.softRemove(q.imageId, em);
      }
      // CASCADE removes the option/match rows
      let res = await questionRepo.delete({ id: In(ids) });
      if (res.affected != ids.length) {
        // something vanished between the checks and the delete — drop all
        throw new NotFoundException();
      }
    });
  }

  async changeOrder(lessonFilter: FindOptionsWhere<Lesson>, ids: UUID[]) {
    let lesson = await this.ds.getRepository(Lesson).findOne({
      where: lessonFilter,
    });
    if (!lesson) {
      throw new NotFoundException('Lesson Not Found');
    }
    if (lesson.status == LessonStatusType.active) {
      throw new BadRequestException(
        'Cannot reorder questions of an active lesson',
      );
    }

    // the filter above targets the LESSON; questions need their own filter
    let all = await this.find({
      lesson: { id: lesson.id },
      school: { id: lesson.schoolId },
    });
    let allIds = new Set(all.map((q) => q.id));
    for (let id of ids) {
      if (!allIds.has(id)) {
        throw new NotFoundException('Question not found ' + id);
      }
    }

    await transaction(this.ds, async (em) => {
      let finalIds = [...ids];
      for (let q of all) {
        if (!finalIds.includes(q.id)) {
          finalIds.push(q.id);
        }
      }
      let repo = em.getRepository(Question);
      // (school, lesson, index) is unique, so writing final values directly
      // can collide mid-loop; park everything at negative indexes first
      for (let i = 0; i < finalIds.length; i++) {
        await repo.update({ id: finalIds[i] }, { index: -(i + 1) });
      }
      for (let i = 0; i < finalIds.length; i++) {
        await repo.update({ id: finalIds[i] }, { index: i + 1 });
      }
    });
  }

  // bulk-delete every question under the given lessons, within an existing
  // transaction (soft-removes images; CASCADE clears option/match rows)
  async bulkDelete(filter: FindOptionsWhere<Question>, em?: EntityManager) {
    let questionRepo = em?.getRepository(Question) || this.repo;
    let questions = await questionRepo.find({
      where: filter,
    });
    if (!questions.length) return;
    for (let q of questions) {
      if (q.imageId) await this.files.softRemove(q.imageId, em);
    }
    await questionRepo.delete({ id: In(questions.map((q) => q.id)) });
  }

  private async clearChildren(
    em: EntityManager,
    question: Question,
    type: QuestionType,
  ) {
    if (type == QuestionType.OPTIONS) {
      let optionRepo = em.getRepository(QuestionOption);
      for (let o of question.options ?? []) {
        if (o.imageId) await this.files.softRemove(o.imageId, em);
      }
      await optionRepo.delete({ question: { id: question.id } });
    } else {
      await em
        .getRepository(QuestionMatch)
        .delete({ question: { id: question.id } });
    }
  }

  private async insertOptions(
    em: EntityManager,
    options: QuestionOptionDto[],
    questionId: UUID,
    schoolId?: UUID,
  ) {
    let optionRepo = em.getRepository(QuestionOption);
    for (let i = 0; i < options.length; i++) {
      await optionRepo.save(
        optionRepo.create({
          text: options[i].text,
          isCorrect: options[i].isCorrect,
          question: { id: questionId },
          school: { id: schoolId },
        }),
      );
    }
  }

  private async insertMatches(
    em: EntityManager,

    items: QuestionMatchDto[],
    questionId: UUID,
    schoolId?: UUID,
  ) {
    let matchRepo = em.getRepository(QuestionMatch);
    let saved: QuestionMatch[] = [];
    for (let i = 0; i < items.length; i++) {
      saved.push(
        await matchRepo.save(
          matchRepo.create({
            text: items[i].text,
            type: items[i].type,
            question: { id: questionId },
            school: { id: schoolId },
          }),
        ),
      );
    }
    for (let i = 0; i < items.length; i++) {
      if (items[i].type == QuestionMatchType.base) {
        saved[i].correctMatchId = saved[items[i].correctIndex].id;
        await matchRepo.save(saved[i]);
      }
    }
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
}
