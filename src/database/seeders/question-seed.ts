import { DataSource } from 'typeorm';
import { QuestionType } from '../../curriculum/questions/entity/enum/question.type';
import { QuestionPurpose } from '../../curriculum/questions/entity/enum/question-purpose.type';
import { QuestionMatchType } from '../../curriculum/questions/entity/enum/question-match.type';
import { QuestionClassifyType } from '../../curriculum/questions/entity/enum/question-classify.type';
import { QuestionFillBlankService } from '../../curriculum/questions/components/question-fill-blanks.service';

const QUESTION_TYPES = Object.values(QuestionType);

// Every lesson and daily-challenge course pool receives all question types.
export async function seedQuestions(ds: DataSource) {
  const lessonRepo = ds.getRepository('Lesson');
  const courseRepo = ds.getRepository('Course');

  const lessons = await lessonRepo.find();
  for (const lesson of lessons) {
    for (const type of QUESTION_TYPES) {
      await seedQuestion(ds, {
        schoolId: lesson.schoolId,
        lessonId: lesson.id,
        context: lesson.title,
        type,
      });
    }
  }

  const school = await ds
    .getRepository('School')
    .findOne({ where: { default: true } });
  const courses = await courseRepo.find();
  for (const course of courses) {
    for (const type of QUESTION_TYPES) {
      await seedQuestion(ds, {
        schoolId: school!.id,
        courseId: course.id,
        context: `Daily challenge - ${course.title}`,
        type,
      });
    }
  }
}

async function seedQuestion(
  ds: DataSource,
  params: {
    schoolId: string;
    lessonId?: string;
    courseId?: string;
    context: string;
    type: QuestionType;
  },
) {
  const question = await ds.getRepository('Question').save({
    title: questionText(params.type, params.context),
    type: params.type,
    purpose: params.lessonId
      ? QuestionPurpose.lesson
      : QuestionPurpose.dailyChallenge,
    lesson: params.lessonId ? { id: params.lessonId } : null,
    course: params.courseId ? { id: params.courseId } : null,
    school: { id: params.schoolId },
  });

  if (params.type === QuestionType.OPTIONS) {
    const correct = 1;
    await ds.getRepository('QuestionOptionGroup').save({
      index: 0,
      question: { id: question.id },
      school: { id: params.schoolId },
      options: Array.from({ length: 4 }, (_, index) => ({
        text: `Option ${index + 1}`,
        isCorrect: index === correct,
      })),
    });
  } else if (params.type === QuestionType.TRUE_FALSE) {
    await ds.getRepository('QuestionTrueOrFalse').save({
      value: true,
      question: { id: question.id },
      school: { id: params.schoolId },
    });
  } else if (params.type === QuestionType.MATCH) {
    const matchRepo = ds.getRepository('QuestionMatch');
    // matches occupy index 0..2, bases 3..5 — base i's correctIndex points at
    // the match row sitting at index i
    for (let i = 0; i < 3; i++) {
      await matchRepo.save({
        text: `Answer ${i + 1}`,
        type: QuestionMatchType.match,
        index: i,
        correctIndex: null,
        question: { id: question.id },
        school: { id: params.schoolId },
      });
    }
    for (let i = 0; i < 3; i++) {
      await matchRepo.save({
        text: `Item ${i + 1}`,
        type: QuestionMatchType.base,
        index: 3 + i,
        correctIndex: i,
        question: { id: question.id },
        school: { id: params.schoolId },
      });
    }
  } else if (params.type === QuestionType.classify) {
    await ds.getRepository('QuestionClassify').save([
      {
        text: 'Fruit',
        type: QuestionClassifyType.category,
        index: 0,
        correctCategoryIndex: null,
        question: { id: question.id },
        school: { id: params.schoolId },
      },
      {
        text: 'Vehicle',
        type: QuestionClassifyType.category,
        index: 1,
        correctCategoryIndex: null,
        question: { id: question.id },
        school: { id: params.schoolId },
      },
      ...['Apple', 'Banana'].map((text, position) => ({
        text,
        type: QuestionClassifyType.item,
        index: position + 2,
        correctCategoryIndex: 0,
        question: { id: question.id },
        school: { id: params.schoolId },
      })),
      ...['Car', 'Bus'].map((text, position) => ({
        text,
        type: QuestionClassifyType.item,
        index: position + 4,
        correctCategoryIndex: 1,
        question: { id: question.id },
        school: { id: params.schoolId },
      })),
    ]);
  } else if (params.type === QuestionType.order) {
    await ds.getRepository('QuestionOrder').save(
      ['Wake up', 'Study', 'Sleep'].map((text, sort) => ({
        text,
        sort,
        question: { id: question.id },
        school: { id: params.schoolId },
      })),
    );
  } else if (params.type === QuestionType.fillBlanks) {
    const blanks = [
      { index: 0, answers: ['Damascus'] },
      { index: 1, answers: ['Syria'] },
    ];
    new QuestionFillBlankService(ds).validate({
      text: question.title,
      data: blanks,
    });
    await ds.getRepository('QuestionFillBlank').save(
      blanks.map((blank) => ({
        ...blank,
        question: { id: question.id },
        school: { id: params.schoolId },
      })),
    );
  }
}

function questionText(type: QuestionType, context: string) {
  const prefix = `**Testing answer is shown below**\n\n${context}\n\n`;
  switch (type) {
    case QuestionType.OPTIONS:
      return `${prefix}Answer: option 2. Select option 2.`;
    case QuestionType.TRUE_FALSE:
      return `${prefix}Answer: true. The Earth revolves around the Sun.`;
    case QuestionType.MATCH:
      return `${prefix}Answers: item 1 → answer 1, item 2 → answer 2, item 3 → answer 3.`;
    case QuestionType.classify:
      return `${prefix}Answers: Fruit → Apple, Banana; Vehicle → Car, Bus.`;
    case QuestionType.order:
      return `${prefix}Answer order: Wake up → Study → Sleep.`;
    case QuestionType.fillBlanks:
      return `${prefix}Answers: Damascus, Syria. {{textField: {width: 140, contentLength: 8, index: 0}}} is the capital of {{textField: {width: 120, contentLength: null, index: 1}}}.`;
  }
}
