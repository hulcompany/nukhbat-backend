import { UUID } from "crypto";
import { Question } from "../../../curriculum";

export interface QuestionSnapshotContext {
  dailyChallengeId: UUID | null;
  lessonId: UUID | null;
  unitId: UUID | null;
  courseId: UUID | null;
  studentId: UUID | null;
}

export interface QuestionSnapshot extends QuestionSnapshotContext {
  id: UUID;
  questions: Question[];
  createdAt: string;
}
