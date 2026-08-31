import { DataSource } from 'typeorm';
import { QuestionType } from '../../curriculum/questions/entity/enum/question.type';
import { QuestionMatchType } from '../../curriculum/questions/entity/enum/question-match.type';
import { QuestionClassifyType } from '../../curriculum/questions/entity/enum/question-classify.type';
import { LessonStatusType } from '../../curriculum/lessons/entity/lesson.status.type';
import { AppConfig } from '../../conf';

// Replays a slice of the default student's published lessons as fully-correct
// attempts — writing the frozen LessonAttempt/QuestionAttempt marks, the reward
// LedgerEntry rows, and the cached xp/gems counters exactly like
// SolveLessonsService.solve would. Gives the student real progress/history.
export async function seedAttempts(ds: DataSource) {
  const userRepo = ds.getRepository('User');
  const profileRepo = ds.getRepository('StudentProfile');
  const lessonRepo = ds.getRepository('Lesson');
  const attemptRepo = ds.getRepository('LessonAttempt');
  const qAttemptRepo = ds.getRepository('QuestionAttempt');
  const ledgerRepo = ds.getRepository('LedgerEntry');

  const user = await userRepo.findOne({ where: { email: 'student@hul.com' } });
  const profile = await profileRepo.findOne({ where: { userId: user!.id } });
  if (!profile) return;

  // published, question-bearing lessons on the student's track, ordered for a
  // stable "solve the first N" slice
  const published = (
    await lessonRepo.find({
      where: { schoolId: profile.schoolId, status: LessonStatusType.published },
      relations: { unit: { course: true }, questions: true },
      order: { index: 'ASC' },
    })
  ).filter(
    (l: any) =>
      l.unit.course.trackId === profile.trackId && l.questions.length > 0,
  );

  // total published lessons per unit — used to award the unit-completion bonus
  const unitTotals = new Map<string, number>();
  for (const l of published as any[]) {
    unitTotals.set(l.unitId, (unitTotals.get(l.unitId) ?? 0) + 1);
  }

  // the default student solves the first 5 lessons (enough to earn a couple of
  // unit-completion bonuses without solving the whole curriculum)
  const toSolve = (published as any[]).slice(0, 5);
  const solvedPerUnit = new Map<string, number>();
  let totalXp = 0;
  let totalGems = 0;

  for (const lesson of toSolve) {
    const verdicts = lesson.questions.map((q: any) => buildVerdict(q));

    const attempt = await attemptRepo.save({
      studentId: profile.id,
      lessonId: lesson.id,
      schoolId: profile.schoolId,
      trackId: profile.trackId,
      courseId: lesson.unit.courseId,
      unitId: lesson.unitId,
      lessonTitle: lesson.title,
      attemptNumber: 1,
      questionsTotal: verdicts.length,
      questionsCorrect: verdicts.length,
      completed: true,
      questionsSkipped: 0,
      xpAwarded: 0, // set below once the reward is computed
      // the frozen QuestionVerdictResult, same shape checkAnswerHelper returns
      result: {
        verdicts,
        correct: verdicts.length,
        total: verdicts.length,
        skipped: 0,
        score: 1,
        passed: true,
      },
    });

    for (let q = 0; q < lesson.questions.length; q++) {
      const itemVerdicts = verdicts[q].result.verdicts ?? [verdicts[q].result];
      await qAttemptRepo.save({
        lessonAttemptId: attempt.id,
        studentId: profile.id,
        questionId: lesson.questions[q].id,
        questionType: lesson.questions[q].type,
        score: itemVerdicts.length,
        total: itemVerdicts.length,
        isCorrect: true,
        result: verdicts[q],
        isSkipped: false,
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
      schoolId: profile.schoolId,
      trackId: profile.trackId,
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
        schoolId: profile.schoolId,
        trackId: profile.trackId,
      });
      totalXp += AppConfig.UNIT_XP;
      totalGems += AppConfig.UNIT_GEMS;
    }
  }

  // cached counters mirror SUM(xp)/SUM(gems) over the ledger
  await profileRepo.update(profile.id, { xp: totalXp, gems: totalGems });
}

// A fully-correct QuestionVerdict for a seeded question, matching the shape
// SolveLessonsService freezes into QuestionAttempt.result.
function buildVerdict(question: any) {
  if (question.type === QuestionType.OPTIONS) {
    const verdicts = question.optionsGroups.map((group: any) => {
      const correct = group.options.find((option: any) => option.isCorrect);
      return {
        answered: correct,
        verdict: true,
        correctOption: [correct],
      };
    });
    return {
      id: question.id,
      title: question.title,
      type: question.type,
      verdict: true,
      isSkipped: false,
      verdictText: question.verdictText ?? null,
      result: {
        verdict: true,
        skipped: false,
        verdicts,
      },
    };
  }
  if (question.type === QuestionType.TRUE_FALSE) {
    return {
      id: question.id,
      title: question.title,
      type: question.type,
      verdict: true,
      isSkipped: false,
      verdictText: question.verdictText ?? null,
      result: {
        answered: question.trueOrFalse.value,
        verdict: true,
        skipped: false,
        correctAnswer: question.trueOrFalse.value,
      },
    };
  }
  if (question.type === QuestionType.MATCH) {
    const bases = question.matchingItems.filter(
      (m: any) => m.type === QuestionMatchType.base,
    );
    const matches = question.matchingItems.filter(
      (m: any) => m.type === QuestionMatchType.match,
    );
    return completeVerdict(
      question,
      bases.map((base: any) => {
        const pair = matches.find(
          (match: any) => match.index === base.correctIndex,
        );
        return {
          answeredBase: base,
          answeredMatch: pair,
          verdict: true,
          baseCorrectMatch: pair,
        };
      }),
    );
  }
  if (question.type === QuestionType.classify) {
    const categories = question.classifyItems.filter(
      (item: any) => item.type === QuestionClassifyType.category,
    );
    const items = question.classifyItems.filter(
      (item: any) => item.type === QuestionClassifyType.item,
    );
    return completeVerdict(
      question,
      categories.map((category: any) => {
        const correctItems = items.filter(
          (item: any) => item.correctCategoryIndex === category.index,
        );
        const answer = { category, items: correctItems };
        return { verdict: true, answered: answer, correctAnswer: answer };
      }),
    );
  }
  if (question.type === QuestionType.order) {
    return completeVerdict(
      question,
      [...question.orderItems]
        .sort((left: any, right: any) => left.sort - right.sort)
        .map((item: any) => ({
          answered: item,
          correctAnswer: item,
          verdict: true,
        })),
    );
  }
  if (question.type === QuestionType.fillBlanks) {
    return completeVerdict(
      question,
      [...question.fillBlanks]
        .sort((left: any, right: any) => left.index - right.index)
        .map((blank: any) => ({
          index: blank.index,
          answer: blank.answers[0],
          correctAnswer: blank.answers,
          verdict: true,
        })),
    );
  }
  throw new Error(`Unsupported seeded question type: ${question.type}`);
}

function completeVerdict(question: any, verdicts: any[]) {
  return {
    id: question.id,
    title: question.title,
    type: question.type,
    verdict: true,
    isSkipped: false,
    verdictText: question.verdictText ?? null,
    result: { verdict: true, skipped: false, verdicts },
  };
}
