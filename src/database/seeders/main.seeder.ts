import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { learningFactory } from '../factory/learning.factory';
import { Track } from '../../learning/tracks/entity/track.entity';
import { Course } from '../../learning/course/entity/course.entity';
import { User } from '../../core/user/entity/user.entity';
import { School } from '../../school/entity/school.entity';
import { Faq } from '../../public-content/faqs/entity/faq.entity';
import { Info } from '../../public-content/info/entity/info.entity';
import { SchoolAccess } from '../../learning/school-access/entity/school-access.entity';
import { Unit } from '../../learning/units/entity/unit.entity';
import { Lesson } from '../../learning/lessons/entity/lesson.entity';
import { Question } from '../../learning/questions/entity/questions.entity';
import { QuestionOption } from '../../learning/questions/entity/question-options.entity';
import { QuestionMatch } from '../../learning/questions/entity/question-match.entity';
import { QuestionType } from '../../learning/questions/entity/enum/question.type';
import { QuestionPurpose } from '../../learning/questions/entity/enum/question-purpose.type';
import { QuestionMatchType } from '../../learning/questions/entity/enum/question-match.type';
import { UUID } from 'crypto';

export class MainSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    await dataSource.dropDatabase();
    await dataSource.synchronize();
    await dataSource.runMigrations();
    let admin = await dataSource.getRepository(User).save({
      name: 'admin',
      email: 'admin@hul.com',
      password: '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      emailVerfied: true,
      role: 'admin',
    });
    let content = await dataSource.getRepository(User).save({
      name: 'content-writer',
      email: 'content@hul.com',
      password: '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6',
      emailVerfied: true,
      role: 'contentWriter',
    });
    await factoryManager.get(User).saveMany(20);
    let school = await dataSource.getRepository(School).save({
      owner: content,
      name: 'Content School',
    });
    const data = learningFactory();
    // courses of the FIRST track — the units below hang off these; the
    // daily-challenge pool needs EVERY course (school has all tracks)
    let firstTrackCourses: Course[] = [];
    let allCourses: Course[] = [];
    for (const [t, track] of data.tracks.entries()) {
      const savedTrack = await dataSource.getRepository(Track).save({
        name: track.name,
      });
      await dataSource.getRepository(SchoolAccess).save({
        school: {
          id: school.id,
        },
        track: {
          id: savedTrack.id,
        },
      });
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
    await factoryManager.get(Faq).saveMany(30);
    await factoryManager.get(Info).saveMany(1);

    await this.seedSchoolContent(
      dataSource,
      school.id,
      firstTrackCourses,
      allCourses,
    );
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

    // 21 lesson questions: first 7 lessons × 3, one match question per triple
    let n = 0;
    for (const lesson of lessons.slice(0, 7)) {
      for (let i = 1; i <= 3; i++) {
        n++;
        await this.seedQuestion(dataSource, {
          schoolId,
          lessonId: lesson.id,
          index: i,
          title: `سؤال ${i} - ${lesson.title}`,
          type: i === 3 ? QuestionType.MATCH : QuestionType.OPTIONS,
        });
      }
    }

    // daily-challenge pool: 4 questions per course (index restarts per
    // course, matching the service's per-course max+1), last one a match
    for (const course of allCourses) {
      for (let i = 1; i <= 4; i++) {
        await this.seedQuestion(dataSource, {
          schoolId,
          lessonId: null,
          courseId: course.id,
          index: i,
          title: `سؤال التحدي اليومي ${i} - ${course.title}`,
          type: i === 4 ? QuestionType.MATCH : QuestionType.OPTIONS,
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
      index: number;
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
      index: params.index,
      lesson: params.lessonId ? { id: params.lessonId } : null,
      course: params.courseId ? { id: params.courseId } : null,
      school: { id: params.schoolId },
    });

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
      let matches: QuestionMatch[] = [];
      for (let i = 0; i < 3; i++) {
        matches.push(
          await matchRepo.save({
            text: `الإجابة ${i + 1}`,
            type: QuestionMatchType.match,
            question: { id: question.id },
            school: { id: params.schoolId },
          }),
        );
      }
      for (let i = 0; i < 3; i++) {
        await matchRepo.save({
          text: `العنصر ${i + 1}`,
          type: QuestionMatchType.base,
          correctMatchId: matches[i].id,
          question: { id: question.id },
          school: { id: params.schoolId },
        });
      }
    }
  }
}
