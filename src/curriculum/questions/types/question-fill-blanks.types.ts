interface QuestionFillBlanksAnswer {
  index: number;
  answer: string;
}


interface QuestionFillBlanksVerdict {
  index: number;
  answer?: string;
  correctAnswer: string[],
  verdict: boolean
}