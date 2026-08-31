import { UUID } from 'crypto';
import { QuestionType } from '../entity/enum/question.type';
import { Question } from '../entity/questions.entity';

export interface QuestionMap {
  question: Question;
  answer: Record<string, any>;
}

export interface QuestionVerdict {
  id: UUID;
  title: string;
  type: QuestionType;
  verdict: boolean;
  isSkipped: boolean;
  // the school's explanation for this question, null when it has none
  verdictText: string | null;
  result: any;
}


export interface QuestionVerdictResult {
  verdicts: QuestionVerdict[];
  correct: number;
  total: number;
  skipped: number;
  score: number;
  passed: boolean;
}
