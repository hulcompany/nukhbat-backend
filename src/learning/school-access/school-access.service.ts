import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'node:crypto';
import { ErrorsRecord } from 'core';
import { SchoolAccess } from './entity/school-access.entity';
import { Course } from '../course/entity/course.entity';
import { Unit } from '../units/entity/unit.entity';
import { SchoolAccessDto } from './dto/school-access.dto';
import { LearningErrorCodes } from '../errors';
import { Lesson } from '../lessons/entity/lesson.entity';
import { Question } from '../questions/entity/questions.entity';
import { Track } from '../tracks/entity/track.entity';
import { School } from '../../school/entity/school.entity';

@Injectable()
export class SchoolAccessService {
  constructor(
    @InjectRepository(SchoolAccess)
    private readonly repo: Repository<SchoolAccess>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    private readonly ds: DataSource,
  ) {}

  async getSchoolAccessableTracks(id: UUID) {
    return (
      await this.repo.find({
        where: {
          school: {
            id: id,
          },
        },
        relations: {
          track: true,
        },
      })
    ).map((e) => e.track);
  }

  async getSchoolTracks(id: UUID) {
    return (
      await this.repo.find({
        where: { school: { id: id } },
        relations: { track: true },
      })
    ).map((e) => e.track);
  }

  async allow(params: SchoolAccessDto) {
    let e1 = await this.ds
      .getRepository(Track)
      .exists({ where: { id: params.trackId } });
    if (!e1) {
      throw new NotFoundException('Track Not Found');
    }
    let e2 = await this.ds
      .getRepository(School)
      .exists({ where: { id: params.schoolId } });
    if (!e2) {
      throw new NotFoundException('School Not Found');
    }
    let cur = await this.repo.findOne({
      where: { school: { id: params.schoolId }, track: { id: params.trackId } },
    });
    if (cur) {
      throw new BadRequestException('School Already Have Access to this Track');
    }
    await this.repo.save({
      school: { id: params.schoolId },
      track: { id: params.trackId },
    });
  }

  async unAllow(params: SchoolAccessDto) {
    let cur = await this.repo.findOne({
      where: { school: { id: params.schoolId }, track: { id: params.trackId } },
    });
    if (!cur) {
      throw new BadRequestException(
        'School Already Do not Have Access to this Track',
      );
    }
    await this.repo.delete({
      school: { id: params.schoolId },
      track: { id: params.trackId },
    });
  }

  // Every assert below takes one id or a list. Lists cost a fixed number
  // of queries (one fetch + one access count) — never one query per id.
  // Any missing id → NotFound naming it; any id whose track the school
  // can't use → Forbidden Learning_01.

  private toIds(id: UUID | UUID[]) {
    return [...new Set(Array.isArray(id) ? id : [id])];
  }

  private firstMissing(ids: UUID[], found: { id: UUID }[]) {
    let f = new Set(found.map((e) => e.id));
    return ids.find((id) => !f.has(id));
  }

  // every distinct track must have an access row — one count query
  private async assertTracksAllowed(schoolId: UUID, trackIds: UUID[]) {
    let distinct = [...new Set(trackIds)];
    if (!distinct.length) return;
    let count = await this.repo.count({
      where: { school: { id: schoolId }, track: { id: In(distinct) } },
    });
    if (count != distinct.length) {
      throw new ForbiddenException(
        ErrorsRecord.getError(LearningErrorCodes.Learning_01),
      );
    }
  }

  async assertTrackAccess(schoolId: UUID, trackId: UUID | UUID[]) {
    await this.assertTracksAllowed(schoolId, this.toIds(trackId));
  }

  async assertCourseAccess(schoolId: UUID, courseId: UUID | UUID[]) {
    let ids = this.toIds(courseId);
    let courses = await this.courseRepo.find({ where: { id: In(ids) } });
    if (courses.length != ids.length) {
      throw new NotFoundException(
        'Course Not Found ' + this.firstMissing(ids, courses),
      );
    }
    await this.assertTracksAllowed(
      schoolId,
      courses.map((c) => c.trackId),
    );
  }

  async assertUnitAccess(schoolId: UUID, unitId: UUID | UUID[]) {
    let ids = this.toIds(unitId);
    let units = await this.unitRepo.find({
      where: { id: In(ids), school: { id: schoolId } },
      relations: { course: true },
    });
    if (units.length != ids.length) {
      throw new NotFoundException(
        'Unit Not Found ' + this.firstMissing(ids, units),
      );
    }
    await this.assertTracksAllowed(
      schoolId,
      units.map((u) => u.course.trackId),
    );
  }

  async assertLessonAccess(schoolId: UUID, lessonId: UUID | UUID[]) {
    let ids = this.toIds(lessonId);
    let lessons = await this.lessonRepo.find({
      where: { id: In(ids), school: { id: schoolId } },
      relations: { unit: { course: true } },
    });
    if (lessons.length != ids.length) {
      throw new NotFoundException(
        'Lesson Not Found ' + this.firstMissing(ids, lessons),
      );
    }
    await this.assertTracksAllowed(
      schoolId,
      lessons.map((l) => l.unit.course.trackId),
    );
  }

  async assertQuestionAccess(schoolId: UUID, questionId: UUID | UUID[]) {
    let ids = this.toIds(questionId);
    // eagers (options/matchingItems) are dead weight for an access check
    let questions = await this.questionRepo.find({
      where: { id: In(ids), school: { id: schoolId } },
      relations: { lesson: { unit: { course: true } }, course: true },
      loadEagerRelations: false,
    });
    if (questions.length != ids.length) {
      throw new NotFoundException(
        'Question Not Found ' + this.firstMissing(ids, questions),
      );
    }
    // lesson questions resolve their track through the lesson chain, pool
    // questions through their own course; legacy pool rows without a
    // course have no chain — school ownership (the where above) is all
    await this.assertTracksAllowed(
      schoolId,
      questions
        .map((q) =>
          q.lesson ? q.lesson.unit.course.trackId : q.course?.trackId,
        )
        .filter((id): id is UUID => !!id),
    );
  }
}
