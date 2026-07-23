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
  KEY_AGE_YEAR: 1,
  FREE_TRIAL_DAYS: 3,
  // how long a frozen lesson snapshot (start → solve) lives in Redis, in
  // seconds — the window a student has to finish an attempt they started
  LESSON_SNAPSHOT_TTL_SEC: 24 * 60 * 60,
  XP_FACTOR: [15, 10, 5],
  UNIT_XP: 100,
  UNIT_GEMS: 50,
};
