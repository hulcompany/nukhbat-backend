import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { learningFactory } from '../factory/learning.factory';
import { Track } from '../../curriculum/tracks/entity/track.entity';
import { Course } from '../../curriculum/course/entity/course.entity';
import { User } from '../../core/user/entity/user.entity';
import { School } from '../../school/entity/school.entity';
import { Faq } from '../../public-content/faqs/entity/faq.entity';
import { Info } from '../../public-content/info/entity/info.entity';
import { SchoolAccess } from '../../school-access/entity/school-access.entity';
import { Unit } from '../../curriculum/units/entity/unit.entity';
import { Lesson } from '../../curriculum/lessons/entity/lesson.entity';
import { Question } from '../../curriculum/questions/entity/questions.entity';
import { QuestionOption } from '../../curriculum/questions/entity/question-options.entity';
import { QuestionMatch } from '../../curriculum/questions/entity/question-match.entity';
import { QuestionType } from '../../curriculum/questions/entity/enum/question.type';
import { QuestionPurpose } from '../../curriculum/questions/entity/enum/question-purpose.type';
import { QuestionMatchType } from '../../curriculum/questions/entity/enum/question-match.type';
import { DailyWisement } from '../../daily_wisement/entity/daily-wisement.entity';
import { UUID } from 'crypto';
import { NUKHBA_FAQS } from '../factory/faq.factory';
import { LessonStatusType } from '../../curriculum/lessons/entity/lesson.status.type';
import { QuestionVerdict } from '../../curriculum/questions/types/question-verdict.type';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import {
  Subscription,
  SubscriptionType,
} from '../../subscription/entity/subscription.entity';
import { LessonAttempt } from '../../learning/solving/entity/lesson-attempt.entity';
import { QuestionAttempt } from '../../learning/solving/entity/question-attempt.entity';
import { LedgerEntry } from '../../learning/ledger/entity/ledger-entry.entity';
import { AppConfig } from '../../conf';

// The only FAQs we seed — the real product Q&A (Arabic).

export class MainSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    // await dataSource.dropDatabase();
    await dataSource.synchronize();
    await dataSource.runMigrations();
    await dataSource.getRepository(User).save({
      name: 'admin',
      email: 'admin@hul.com',
      password: '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      emailVerified: true,
      role: 'admin',
    });
    let content = await dataSource.getRepository(User).save({
      name: 'content-writer',
      email: 'content@hul.com',
      password: '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      emailVerified: true,
      role: 'contentWriter',
      phoneNumber: '+963935000000',
    });
    let content2 = await dataSource.getRepository(User).save({
      name: 'content-writer-2',
      email: 'content2@hul.com',
      password: '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      emailVerified: true,
      role: 'contentWriter',
      phoneNumber: '+963935000001',
    });
    await factoryManager.get(User).saveMany(20);
    let school = await dataSource.getRepository(School).save({
      owner: content,
      name: 'Content School',
      default: true,
    });
    let school2 = await dataSource.getRepository(School).save({
      owner: content2,
      name: 'Content School 2',
    });
    const data = learningFactory();
    // courses of the FIRST track — the units below hang off these; the
    // daily-challenge pool needs EVERY course (school has all tracks)
    let firstTrackCourses: Course[] = [];
    let allCourses: Course[] = [];
    let firstTrackId!: UUID;
    for (const [t, track] of data.tracks.entries()) {
      const savedTrack = await dataSource.getRepository(Track).save({
        name: track.name,
      });
      if (t === 0) {
        firstTrackId = savedTrack.id;
      }
      // both schools get all three tracks
      for (const s of [school, school2]) {
        await dataSource.getRepository(SchoolAccess).save({
          school: {
            id: s.id,
          },
          track: {
            id: savedTrack.id,
          },
        });
      }
      for (const course of track.courses) {
        const savedCourse = await dataSource.getRepository(Course).save({
          title: course.name,
          track: { id: savedTrack.id },
        });
        allCourses.push(savedCourse);
        if (t === 0) {
          firstTrackCourses.push(savedCourse);
        }
      }
    }
    // seed only the real product FAQs (not random faker ones)
    await dataSource.getRepository(Faq).save(NUKHBA_FAQS);
    await factoryManager.get(Info).saveMany(1);
    await factoryManager.get(DailyWisement).saveMany(30);

    await this.seedSchoolContent(
      dataSource,
      school.id,
      firstTrackCourses,
      allCourses,
    );
    await this.seedSchoolContent(
      dataSource,
      school2.id,
      firstTrackCourses,
      allCourses,
    );

    // students + their solving history (attempts, question attempts, reward
    // ledger) on the first track of each school
    await this.seedStudentsAndSolving(dataSource, school.id, firstTrackId, 's1');
    await this.seedStudentsAndSolving(
      dataSource,
      school2.id,
      firstTrackId,
      's2',
    );
  }

  // Enrolls a handful of students on `schoolId`/`trackId` (each with a live
  // free-trial subscription so the guards pass), then replays a slice of the
  // published lessons as fully-correct attempts — writing the frozen
  // LessonAttempt/QuestionAttempt marks, the reward LedgerEntry rows, and the
  // cached xp/gems counters exactly like SolveLessonsService.solve would.
  // Students solve a decreasing number of lessons so the leaderboard has spread.
  private async seedStudentsAndSolving(
    dataSource: DataSource,
    schoolId: UUID,
    trackId: UUID,
    tag: string,
  ) {
    const userRepo = dataSource.getRepository(User);
    const profileRepo = dataSource.getRepository(StudentProfile);
    const subRepo = dataSource.getRepository(Subscription);
    const attemptRepo = dataSource.getRepository(LessonAttempt);
    const qAttemptRepo = dataSource.getRepository(QuestionAttempt);
    const ledgerRepo = dataSource.getRepository(LedgerEntry);

    // published, question-bearing lessons on this track, ordered for a stable
    // "solve the first N" slice
    const published = (
      await dataSource.getRepository(Lesson).find({
        where: { schoolId, status: LessonStatusType.published },
        relations: { unit: { course: true }, questions: true },
        order: { index: 'ASC' },
      })
    ).filter(
      (l) => l.unit.course.trackId === trackId && l.questions.length > 0,
    );
    // total published lessons per unit — used to award the unit-completion bonus
    const unitTotals = new Map<UUID, number>();
    for (const l of published) {
      unitTotals.set(l.unitId, (unitTotals.get(l.unitId) ?? 0) + 1);
    }

    const STUDENTS = 5;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    for (let s = 0; s < STUDENTS; s++) {
      const user = await userRepo.save({
        name: `student ${tag}-${s + 1}`,
        email: `student.${tag}.${s + 1}@hul.com`,
        emailVerified: true,
        role: 'student',
        // same shared hash as the other seeded accounts
        password:
          '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      });
      const profile = await profileRepo.save({
        userId: user.id,
        schoolId,
        trackId,
      });
      // live free trial so StudentGuard/SubscriptionGuard let them through
      await subRepo.save({
        type: SubscriptionType.freeTrial,
        expireDate: new Date(Date.now() + THIRTY_DAYS),
        studentProfileId: profile.id,
      });

      // student 0 solves every lesson, each next one solves one fewer
      const solveCount = Math.max(0, published.length - s);
      const solvedPerUnit = new Map<UUID, number>();
      let totalXp = 0;
      let totalGems = 0;

      for (let i = 0; i < solveCount; i++) {
        const lesson = published[i];
        const verdicts = lesson.questions.map((q) => this.buildVerdict(q));

        const attempt = await attemptRepo.save({
          studentId: profile.id,
          lessonId: lesson.id,
          schoolId,
          trackId,
          courseId: lesson.unit.courseId,
          unitId: lesson.unitId,
          lessonTitle: lesson.title,
          attemptNumber: 1,
          questionsTotal: verdicts.length,
          questionsCorrect: verdicts.length,
          score: 100,
          completed: true,
          xpAwarded: 0, // set below once the reward is computed
        });

        for (let q = 0; q < lesson.questions.length; q++) {
          await qAttemptRepo.save({
            lessonAttemptId: attempt.id,
            studentId: profile.id,
            questionId: lesson.questions[q].id,
            questionType: lesson.questions[q].type,
            score: 1,
            total: 1,
            isCorrect: true,
            result: verdicts[q],
          });
        }

        // first fully-correct completion → XP_FACTOR[0] per question
        const lessonXp = AppConfig.XP_FACTOR[0] * lesson.questions.length;
        await attemptRepo.update(attempt.id, { xpAwarded: lessonXp });
        await ledgerRepo.save({
          studentId: profile.id,
          sourceName: lesson.title,
          xp: lessonXp,
          gems: 0,
          schoolId,
          trackId,
        });
        totalXp += lessonXp;

        // unit-completion bonus once every published lesson of the unit is done
        const done = (solvedPerUnit.get(lesson.unitId) ?? 0) + 1;
        solvedPerUnit.set(lesson.unitId, done);
        if (done === unitTotals.get(lesson.unitId)) {
          await ledgerRepo.save({
            studentId: profile.id,
            sourceName: `${lesson.unit.title} - unit complete`,
            xp: AppConfig.UNIT_XP,
            gems: AppConfig.UNIT_GEMS,
            schoolId,
            trackId,
          });
          totalXp += AppConfig.UNIT_XP;
          totalGems += AppConfig.UNIT_GEMS;
        }
      }

      // cached counters mirror SUM(xp)/SUM(gems) over the ledger
      await profileRepo.update(profile.id, { xp: totalXp, gems: totalGems });
    }
  }

  // A fully-correct QuestionVerdict for a seeded question, matching the shape
  // SolveLessonsService freezes into QuestionAttempt.result.
  private buildVerdict(question: Question): QuestionVerdict {
    if (question.type === QuestionType.OPTIONS) {
      // seed always marks exactly one option correct
      const correct = question.options.find((o) => o.isCorrect)!;
      return {
        id: question.id,
        type: question.type,
        choiceVerdict: {
          answered: correct,
          verdict: true,
          correctOption: correct,
        },
      };
    }
    if (question.type === QuestionType.TRUE_FALSE) {
      return {
        id: question.id,
        type: question.type,
        trueOrFalseVerdict: {
          answered: !!question.trueOrFalseAnswer,
          correct: true,
          correctAnswer: !!question.trueOrFalseAnswer,
        },
      };
    }
    // MATCH — pair each base with the match at its correctIndex
    const bases = question.matchingItems.filter(
      (m) => m.type === QuestionMatchType.base,
    );
    const matches = question.matchingItems.filter(
      (m) => m.type === QuestionMatchType.match,
    );
    return {
      id: question.id,
      type: question.type,
      matchVerdicts: bases.map((base) => {
        // seed pairs every base with the match at its correctIndex
        const pair = matches.find((m) => m.index === base.correctIndex)!;
        return {
          answeredBase: base,
          answeredMatch: pair,
          verdict: true,
          baseCorrectMatch: pair,
        };
      }),
    };
  }

  // 10 units (2 per course), 2 lessons per unit, 21 lesson questions on
  // the first 7 lessons (3 each) + a daily-challenge pool of 4 questions
  // per course (challenge takes 2/course/day → two days of challenges)
  private async seedSchoolContent(
    dataSource: DataSource,
    schoolId: UUID,
    courses: Course[],
    allCourses: Course[],
  ) {
    const unitRepo = dataSource.getRepository(Unit);
    const lessonRepo = dataSource.getRepository(Lesson);

    let units: Unit[] = [];
    for (let u = 0; u < 10; u++) {
      const unit = {
        title: `الوحدة ${u + 1}`,
        courseId: courses[Math.floor(u / 2)].id,
        schoolId,
        index: (u % 2) + 1,
      };

      const saved = await unitRepo.save(unit);
      units.push(saved);
    }

    let lessons: Lesson[] = [];
    for (const unit of units) {
      for (let l = 0; l < 2; l++) {
        lessons.push(
          await lessonRepo.save({
            title: `الدرس ${l + 1} - ${unit.title}`,
            description: `شرح ${unit.title}`,
            unitId: unit.id,
            schoolId: schoolId,
            index: l + 1,
          }),
        );
      }
    }

    // 21 lesson questions: first 7 lessons × 3 — one of each type per triple.
    // Publish the lessons that get questions so seeded students can solve them.
    let n = 0;
    for (const lesson of lessons.slice(0, 7)) {
      await lessonRepo.save({
        id: lesson.id,
        status: LessonStatusType.published,
      });
      for (let i = 1; i <= 3; i++) {
        n++;
        await this.seedQuestion(dataSource, {
          schoolId,
          lessonId: lesson.id,
          title: `سؤال ${i} - ${lesson.title}`,
          type:
            i === 3
              ? QuestionType.MATCH
              : i === 2
                ? QuestionType.TRUE_FALSE
                : QuestionType.OPTIONS,
        });
      }
    }

    // daily-challenge pool: 4 questions per course, last one a match
    for (const course of allCourses) {
      for (let i = 1; i <= 4; i++) {
        await this.seedQuestion(dataSource, {
          schoolId,
          lessonId: null,
          courseId: course.id,
          title: `سؤال التحدي اليومي ${i} - ${course.title}`,
          type:
            i === 4
              ? QuestionType.MATCH
              : i === 3
                ? QuestionType.TRUE_FALSE
                : QuestionType.OPTIONS,
        });
      }
    }
  }

  private async seedQuestion(
    dataSource: DataSource,
    params: {
      schoolId: UUID;
      lessonId: UUID | null;
      courseId?: UUID;
      title: string;
      type: QuestionType;
    },
  ) {
    const question = await dataSource.getRepository(Question).save({
      title: params.title,
      type: params.type,
      purpose: params.lessonId
        ? QuestionPurpose.lesson
        : QuestionPurpose.dailyChallenge,
      lesson: params.lessonId ? { id: params.lessonId } : null,
      course: params.courseId ? { id: params.courseId } : null,
      school: { id: params.schoolId },
      // trueFalse keeps its whole answer key on the question itself
      trueOrFalseAnswer:
        params.type === QuestionType.TRUE_FALSE ? Math.random() < 0.5 : null,
    });

    if (params.type === QuestionType.TRUE_FALSE) {
      return;
    }
    if (params.type === QuestionType.OPTIONS) {
      const optionRepo = dataSource.getRepository(QuestionOption);
      const correct = Math.floor(Math.random() * 4);
      for (let i = 0; i < 4; i++) {
        await optionRepo.save({
          text: `الخيار ${i + 1}`,
          isCorrect: i === correct,
          question: { id: question.id },
          school: { id: params.schoolId },
        });
      }
    } else {
      const matchRepo = dataSource.getRepository(QuestionMatch);
      // matches occupy index 0..2, bases 3..5 — so base i's correctIndex is
      // just i, naming the match row at that index
      for (let i = 0; i < 3; i++) {
        await matchRepo.save({
          text: `الإجابة ${i + 1}`,
          type: QuestionMatchType.match,
          index: i,
          correctIndex: null,
          question: { id: question.id },
          school: { id: params.schoolId },
        });
      }
      for (let i = 0; i < 3; i++) {
        await matchRepo.save({
          text: `العنصر ${i + 1}`,
          type: QuestionMatchType.base,
          index: 3 + i,
          correctIndex: i,
          question: { id: question.id },
          school: { id: params.schoolId },
        });
      }
    }
  }
}
