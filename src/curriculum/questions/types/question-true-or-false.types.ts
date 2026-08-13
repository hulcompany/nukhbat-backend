export interface TrueOrFalseAnswer {
  answered: boolean | undefined;
}

export interface TrueOrFalseVerdict {
  // the boolean the student answered
  answered?: boolean | undefined;
  // whether it matched
  verdict: boolean;
  skipped: boolean;
  // the correct value (withAnswers only)
  correctAnswer?: boolean;
}
