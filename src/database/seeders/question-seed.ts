import { DataSource } from 'typeorm';
import { QuestionType } from '../../curriculum/questions/entity/enum/question.type';
import { QuestionPurpose } from '../../curriculum/questions/entity/enum/question-purpose.type';
import { QuestionMatchType } from '../../curriculum/questions/entity/enum/question-match.type';

// Questions are school-scoped and come in two flavours:
//  - lesson questions  (lessonId set, purpose=lesson)
//  - daily-challenge pool (courseId set, purpose=dailyChallenge)
// Every question gets one of each of the three types so all solving paths
// have data.
export async function seedQuestions(ds: DataSource) {
  const lessonRepo = ds.getRepository('Lesson');
  const courseRepo = ds.getRepository('Course');

  // 3 questions (one per type) on the first lesson of every unit
  const lessons = await lessonRepo.find({ where: { index: 1 } });
  for (const lesson of lessons) {
    for (let i = 1; i <= 3; i++) {
      await seedQuestion(ds, {
        schoolId: lesson.schoolId,
        lessonId: lesson.id,
        title: `سؤال ${i} - ${lesson.title}`,
        type: pickType(i),
      });
    }
  }

  // daily-challenge pool: 4 questions per course for the default school
  const school = await ds
    .getRepository('School')
    .findOne({ where: { default: true } });
  const courses = await courseRepo.find();
  for (const course of courses) {
    for (let i = 1; i <= 4; i++) {
      await seedQuestion(ds, {
        schoolId: school!.id,
        courseId: course.id,
        title: `سؤال التحدي اليومي ${i} - ${course.title}`,
        type: pickType(i),
      });
    }
  }
}

function pickType(i: number): QuestionType {
  if (i % 3 === 0) return QuestionType.MATCH;
  if (i % 3 === 2) return QuestionType.TRUE_FALSE;
  return QuestionType.OPTIONS;
}

async function seedQuestion(
  ds: DataSource,
  params: {
    schoolId: string;
    lessonId?: string;
    courseId?: string;
    title: string;
    type: QuestionType;
  },
) {
  const question = await ds.getRepository('Question').save({
    title: params.title,
    type: params.type,
    purpose: params.lessonId
      ? QuestionPurpose.lesson
      : QuestionPurpose.dailyChallenge,
    lesson: params.lessonId ? { id: params.lessonId } : null,
    course: params.courseId ? { id: params.courseId } : null,
    school: { id: params.schoolId },
    trueOrFalseAnswer:
      params.type === QuestionType.TRUE_FALSE ? Math.random() < 0.5 : null,
  });

  if (params.type === QuestionType.OPTIONS) {
    const optionRepo = ds.getRepository('QuestionOption');
    const correct = Math.floor(Math.random() * 4);
    for (let i = 0; i < 4; i++) {
      await optionRepo.save({
        text: `الخيار ${i + 1}`,
        isCorrect: i === correct,
        question: { id: question.id },
        school: { id: params.schoolId },
      });
    }
  } else if (params.type === QuestionType.MATCH) {
    const matchRepo = ds.getRepository('QuestionMatch');
    // matches occupy index 0..2, bases 3..5 — base i's correctIndex points at
    // the match row sitting at index i
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
