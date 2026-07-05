export const AppConfig = {
  DAILY_CHALLENGE_QUESTIONS_PER_COURSE: 2,
  deletedMemberExpireDurationMs: 14 * 24 * 60 * 60 * 1000,
  JWT_TOKEN_AGE: 30 * 24 * 60 * 60,
  REFRESH_TOKEN_AGE: 40 * 24 * 60 * 60,
  OTP_SEPERATIONS: [
    5 * 60 * 1000,
    10 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    24 * 60 * 60 * 1000,
  ],
};
