import { ForbiddenException, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import { DataSource, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { ErrorsRecord, transaction } from 'core';
import { AppConfig } from '../../conf';
import { LearningErrorCodes } from '../errors';
import { School } from '../../school/entity/school.entity';
import { Course } from '../course/entity/course.entity';
import { SchoolAccess } from '../school-access/entity/school-access.entity';
import { QuestionPurpose } from '../questions/entity/enum/question-purpose.type';
import { Question } from '../questions/entity/questions.entity';
import { DailyChallengeUsedQuestions } from './entity/daily-challenge-used-questions.entity';
import { DailyChallenge } from './entity/daily-challenge.entity';

// challenge day boundary is the server's local date
export function todayDateString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

@Injectable()
export class DailyChallengeService {
  constructor(
    @InjectRepository(DailyChallenge)
    private readonly repo: Repository<DailyChallenge>,
    @InjectRepository(DailyChallengeUsedQuestions)
    private readonly usedRepo: Repository<DailyChallengeUsedQuestions>,
    private readonly ds: DataSource,
  ) {}

  // today's challenges — one per track the school has built one for
  async getToday(params: FindOptionsWhere<DailyChallenge>) {
    return await this.repo.find({
      where: { ...params, date: todayDateString() },
      relations: { usedQuestions: true, track: true },
    });
  }

  // the course's pool questions never used by any of the school's challenges
  private async findUnusedCourseQuestions(
    schoolId: UUID,
    courseId: UUID,
    usedIds: UUID[],
  ) {
    return await this.ds.getRepository(Question).find({
      where: {
        school: { id: schoolId },
        course: { id: courseId },
        purpose: QuestionPurpose.dailyChallenge,
        ...(usedIds.length ? { id: Not(In(usedIds)) } : {}),
      },
    });
  }

  // per-course unused pool counts over every accessible track — tells the
  // school which course is about to starve its track's challenge
  async getUnusedQuestionsReport(schoolId: UUID) {
    let access = await this.ds.getRepository(SchoolAccess).find({
      where: { school: { id: schoolId } },
      relations: { track: true },
    });
    let trackIds = access.map((a) => a.track.id);
    if (!trackIds.length) return [];
    let trackNames = new Map(access.map((a) => [a.track.id, a.track.name]));
    let courses = await this.ds.getRepository(Course).find({
      where: { trackId: In(trackIds) },
    });

    let used = await this.usedRepo.find({
      where: { challenge: { school: { id: schoolId } } },
    });
    let usedIds = used.map((u) => u.question.id);

    let report: {
      courseId: UUID;
      courseName: string;
      trackId: UUID;
      trackName: string;
      remainingQuestions: number;
    }[] = [];
    for (let course of courses) {
      let remaining = await this.ds.getRepository(Question).count({
        where: {
          school: { id: schoolId },
          course: { id: course.id },
          purpose: QuestionPurpose.dailyChallenge,
          ...(usedIds.length ? { id: Not(In(usedIds)) } : {}),
        },
      });
      report.push({
        courseId: course.id,
        courseName: course.title,
        trackId: course.trackId,
        trackName: trackNames.get(course.trackId)!,
        remainingQuestions: remaining,
      });
    }
    return report;
  }

  // idempotent per (school, track): returns the track's existing challenge
  // for today, or null when ANY course of the track can't supply a full
  // per-course slice of unused questions — no partial challenges. Other
  // tracks are unaffected.
  async createToday(schoolId: UUID, trackId: UUID) {
    let existing = await this.repo.findOne({
      where: {
        school: { id: schoolId },
        track: { id: trackId },
        date: todayDateString(),
      },
      relations: { usedQuestions: true, track: true },
    });
    if (existing) return existing;

    // access is only needed to CREATE — an already-built challenge (above)
    // is served regardless, e.g. when access was revoked mid-day
    let hasAccess = await this.ds.getRepository(SchoolAccess).exists({
      where: { school: { id: schoolId }, track: { id: trackId } },
    });
    if (!hasAccess) {
      throw new ForbiddenException(
        ErrorsRecord.getError(LearningErrorCodes.Learning_01),
      );
    }

    let courses = await this.ds.getRepository(Course).find({
      where: { trackId: trackId },
    });
    if (!courses.length) return null;

    // used history stays school-wide; a question belongs to one course
    // (hence one track), so this is the track's history too
    let used = await this.usedRepo.find({
      where: { challenge: { school: { id: schoolId } } },
    });
    let usedIds = used.map((u) => u.question.id);

    let picked: Question[] = [];
    for (let course of courses) {
      let pool = await this.findUnusedCourseQuestions(
        schoolId,
        course.id,
        usedIds,
      );
      if (pool.length < AppConfig.DAILY_CHALLENGE_QUESTIONS_PER_COURSE) {
        return null;
      }
      // Fisher–Yates shuffle, then take the first N of this course
      for (let i = pool.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      picked.push(
        ...pool.slice(0, AppConfig.DAILY_CHALLENGE_QUESTIONS_PER_COURSE),
      );
    }

    await transaction(this.ds, async (em) => {
      let challengeRepo = em.getRepository(DailyChallenge);
      // UNIQUE (school, track, date) absorbs races between cron and the route
      let challenge = await challengeRepo.save(
        challengeRepo.create({
          school: { id: schoolId },
          track: { id: trackId },
          date: todayDateString(),
        }),
      );
      let usedRepo = em.getRepository(DailyChallengeUsedQuestions);
      for (let q of picked) {
        await usedRepo.save(
          usedRepo.create({
            challenge: { id: challenge.id },
            question: { id: q.id },
          }),
        );
      }
    });

    return await this.repo.findOne({
      where: {
        school: { id: schoolId },
        track: { id: trackId },
        date: todayDateString(),
      },
      relations: { usedQuestions: true, track: true },
    });
  }

  // one challenge per accessible track; a track whose pool is short skips
  // only itself. Returns everything the school has for today.
  async createTodayAll(schoolId: UUID) {
    let access = await this.ds.getRepository(SchoolAccess).find({
      where: { school: { id: schoolId } },
      relations: { track: true },
    });
    for (let a of access) {
      await this.createToday(schoolId, a.track.id);
    }
    return await this.getToday({ school: { id: schoolId } });
  }

  // midnight pre-warm for every school; the POST route reuses the same
  // idempotent createTodayAll as the manual/test trigger
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async createAllTodayChallenges() {
    let schools = await this.ds.getRepository(School).find({
      select: { id: true },
      loadEagerRelations: false,
    });
    for (let school of schools) {
      try {
        await this.createTodayAll(school.id);
      } catch (e) {
        console.log('Daily challenge creation failed for school ' + school.id);
        console.log(e);
      }
    }
  }
}
