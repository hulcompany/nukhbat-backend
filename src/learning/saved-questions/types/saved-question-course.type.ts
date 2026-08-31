import { UUID } from 'crypto';

// One row of GET learning/saved-questions: a course the student can practice
// saved questions from, plus how many are waiting in it.
export interface SavedQuestionCourse {
  id: UUID;
  title: string;
  savedQuestionsCount: number;
}
