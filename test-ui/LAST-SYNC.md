# test-ui — last sync record

**Last synced:** 2026-07-23 (student daily-challenge solving: `GET /learning/solving/student/daily-challenge` + `POST .../daily-challenge/solve`. Prior sync: big rename `learning/*` → `curriculum/*`, books → `/books/school|student`, new `src/learning` = solving/saved-questions/learning-curriculum)
**Backend state covered (`src/` + `core/src/`):** `8aa65da` (+ uncommitted solving daily-challenge work: SolvedDailyChallenges entity, solve/get methods, controller endpoints)

> The hash always trails one commit — this file is committed right after the sync it records, and that bump commit never touches `src/`. Diffing from it can only over-report, never miss backend changes.

The test-ui (`index.html` + `app.js`) covers every active controller/DTO in `src/` as of the date above.

## Instructions (for Claude — read when Salem asks to "add more APIs" / "update the test-ui")

1. Read this file to get the last sync date + commit.
2. Find backend changes since then (whichever is easier/more reliable):
   - `git -C e:\projects\nukhba_alawael diff --name-status 8aa65da -- src/ core/src/`
   - plus uncommitted work: `git status --porcelain` (new/modified `*.controller.ts`, `*/dto/*.ts`, enums, entities)
3. For each new/changed controller or DTO: read it, then add/adjust the matching screen or block in `test-ui/app.js`
   (follow the existing patterns: `formBlock`, `listBlock`, context slots, role groups in `NAV`).
4. Remove UI for endpoints that were deleted/commented out in the backend.
5. `node --check test-ui/app.js` when done.
6. **Update this file**: bump the date and HEAD hash (and the hash inside the diff command in step 2).

## Notes that keep the UI honest

- Book upload field is `image`. Owner CRUD under `/books/school` (`GET`/`POST`/`PATCH :id`/`DELETE :id`, create requires a file); students read `/books/student`.
- Content tree, questions, daily-challenge are under `/curriculum/school/*` (owner) and `/curriculum/admin/*` (admin); tracks + enums at `/curriculum/tracks` and `/curriculum/metaData`.
- New `src/learning` student surface: `GET /learning/curriculum`, `/learning/saved-questions` (GET/POST/DELETE, body `{questionId}`), and solving — `POST /learning/solving/student/{start,solve}`, `GET /learning/solving/student/{daily-challenge,attempts,leaderboard}`, `POST /learning/solving/student/daily-challenge/solve`. Owner: `GET /learning/solving/school/attempts`, `GET /learning/solving/school/leaderboard/:trackId`. `/solve` body: `{ snapshotId, answers:[{ id, answer:{ choiceId|boolAnswer|matches[] } }] }`; daily-challenge `/solve` body drops `snapshotId` (just `{ answers:[…] }`).
- `QuestionEditDto` whitelists only `title`/`type`/answer-key — never send `purpose`/`lessonId` on PATCH.
- All validation pipes use `forbidNonWhitelisted` — any new DTO field must be mirrored exactly.
- List endpoints return `BasePaginationModel` (`{ list, totalRecords, next, back }`); plain finds return arrays.
- Seeded admin: `admin@hul.com` / `12345678`.
- Daily challenge: GET `/school/me/daily-challenge` returns `{ challenges, unUsedQuestions }` (not an array); owner screen "Daily challenge" renders both. POST is idempotent per (school, track, date). Per-course slice size = 2 (`AppConfig.DAILY_CHALLENGE_QUESTIONS_PER_COURSE`).
- Student daily challenge (BUILT): `GET /learning/solving/student/daily-challenge` scopes by the profile's schoolId + trackId. Response is `{ solved:false, questions }` (answer keys hidden) when unattempted, or `{ solved:true, score, total, verdict }` (no questions) once solved. `POST .../daily-challenge/solve` is one-attempt-only; body `{ answers:[…] }` (same answer shape as lesson solve, no snapshot); returns `{ verdict }`. Both rendered in the Student "Solving" screen.
