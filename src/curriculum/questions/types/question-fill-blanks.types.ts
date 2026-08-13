export interface QuestionFillBlanksAnswer {
  index: number;
  answer: string;
}

export interface QuestionFillBlanksVerdict {
  index: number;
  answer?: string;
  correctAnswer: string[];
  verdict: boolean;
}

export interface QuestionFillBlanksResult {
  verdict: boolean;
  skipped: boolean;
  verdicts: QuestionFillBlanksVerdict[];
}
