import { UUID } from 'crypto';
import { Question } from '../../../curriculum/questions/entity/questions.entity';

// The frozen copy of a lesson taken at /start and stored in Redis under a
// snapshot id. /solve grades against THIS, never the live rows, so editing or
// deleting a question mid-attempt can't change what the student is graded on.
//
// `questions` carry their answer keys (options' isCorrect, matches'
// correctIndex, trueOrFalseAnswer) — this is the server-side copy, never the
// one handed to the student. The lesson scope is copied in so /solve can build
// the LessonAttempt + ledger rows without re-reading the curriculum.
export interface QuestionSnapshot {
  studentId: UUID;

  // the lesson being attempted, and its scope (denormalized onto the attempt
  // and the reward ledger)
  lessonId: UUID;
  lessonTitle: string;
  schoolId: UUID;
  trackId: UUID;
  courseId: UUID;
  unitId: UUID;

  // full question rows WITH keys, eager options/matchingItems included
  questions: Question[];

  // ISO timestamp of when the snapshot was frozen
  createdAt: string;
}
