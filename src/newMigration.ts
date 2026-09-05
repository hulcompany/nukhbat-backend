/* eslint-disable */
/**
 * ============================================================================
 *  NEW VERDICT CONTRACT - captured live, not hand-written
 * ============================================================================
 *
 * Every JSON below was recorded from a real run against this repo on
 * 2026-09-05: logged in as student@hul.com, started + solved the seeded lesson
 * "الدرس 1 - الوحدة 1 - الاجتماعيات" (6 questions, one of every type), then
 * read the attempts back.
 *
 * WHAT CHANGED
 * ------------
 * 1. Nothing is stripped any more. hideAnswers() is gone from all six
 *    components and from the facade, so a question handed out to solve now
 *    carries its own answer key (isCorrect, sort, answers, correctIndex,
 *    correctCategoryIndex, trueOrFalse.value) AND its verdictText / tips.
 *    The client decides what to reveal and when.
 *
 * 2. One uniform verdict for every question type:
 *
 *        { skipped, correct, question, answered }
 *
 *    - correct  - boolean, all-or-nothing for the whole question
 *    - skipped  - boolean, nothing submitted for it
 *    - question - the full question, answer key included
 *    - answered - the raw answer payload the student submitted, {} when
 *                 skipped (it is the validated DTO, so class-transformer
 *                 normalisation - e.g. trimming - is already applied)
 *
 *    The old per-type result object ({ verdict, skipped, verdicts: [...] }
 *    with a per-blank / per-base / per-category breakdown) is GONE, and so are
 *    the old top-level id, title, type, verdict, isSkipped and verdictText
 *    keys - all reachable through question now.
 *
 * 3. No partial credit. QuestionAttempt.score / .total collapse to
 *    correct ? 1 : 0 / 1.
 *
 * BREAKING FOR CLIENTS
 * --------------------
 *   verdict.id            ->  verdict.question.id
 *   verdict.title         ->  verdict.question.title
 *   verdict.type          ->  verdict.question.type
 *   verdict.verdict       ->  verdict.correct
 *   verdict.isSkipped     ->  verdict.skipped
 *   verdict.verdictText   ->  verdict.question.verdictText
 *   verdict.result.*      ->  removed; diff answered against question
 *
 * NOT MIGRATED: LessonAttempt.result / QuestionAttempt.result /
 * DailyChallengeAttempt.verdict are jsonb, so rows written BEFORE this change
 * still hold the old shape. Review screens must tolerate both, or the old rows
 * need a backfill.
 */

// ============================================================================
// 1. POST /api/learning/solving/lesson/start
// ============================================================================

export const START_REQUEST = {
  lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
};

/**
 * Response. Note what now ships to a student who has not answered anything:
 *   - optionsGroups[].options[].isCorrect   <- the answer key
 *   - trueOrFalse.value                     <- the answer key
 *   - verdictText and tips                  <- the explanation
 *
 * Only 2 of the 6 questions are reproduced here (options + trueFalse); the
 * other four - match, classify, order, fillBlanks - come back in the same
 * envelope with their own component arrays populated the same way
 * (matchingItems[].correctIndex, classifyItems[].correctCategoryIndex,
 * orderItems[].sort, fillBlanks[].answers are all present now).
 *
 * Also worth knowing: the eager school relation ships the school owner's user
 * row - email included - inside every question. That predates this change, but
 * it is now in front of students on every start call.
 */
export const START_RESPONSE = {
  snapshotId: '7e4a3cf2-9373-49b1-88be-aa88115797b5',
  lesson: {
    id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
    title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
    description: 'شرح الوحدة 1 - الاجتماعيات',
  },
  questions: [
    {
      id: 'd0d506ff-9efe-4838-b370-8a8449593d57',
      title:
        '**Testing answer is shown below**\n\nالدرس 1 - الوحدة 1 - الاجتماعيات\n\nAnswer: option 2. Select option 2.',
      type: 'options',
      purpose: 'lesson',
      lesson: {
        id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
        title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
        description: 'شرح الوحدة 1 - الاجتماعيات',
        unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
        index: 1,
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        status: 'published',
        questionCount: 6,
      },
      lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
      course: null,
      courseId: null,
      optionsGroups: [
        {
          id: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
          text: null,
          index: 0,
          options: [
            {
              id: '8f9e7b88-bfa8-48f5-aa71-66092f0fd993',
              text: 'Option 2',
              isCorrect: true,
              groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
            },
            {
              id: '07c34e54-ae96-4d77-8831-eb2c5d1986b4',
              text: 'Option 1',
              isCorrect: false,
              groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
            },
            {
              id: '24b41bcf-befc-449b-83cb-2da5cd1fdbe0',
              text: 'Option 3',
              isCorrect: false,
              groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
            },
            {
              id: '1ac5ad65-8f79-4ed6-bb1d-52bb9c3aedd7',
              text: 'Option 4',
              isCorrect: false,
              groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
            },
          ],
          schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          questionId: 'd0d506ff-9efe-4838-b370-8a8449593d57',
        },
      ],
      trueOrFalse: null,
      classifyItems: [],
      matchingItems: [],
      orderItems: [],
      fillBlanks: [],
      imageId: null,
      school: {
        id: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        name: 'default school',
        logo: null,
        owner: {
          id: '7b1f34fb-5c8a-4014-8e37-6840b9e0e732',
          name: 'default school',
          email: 'content@hul.com',
          phoneNumber: null,
          emailVerified: true,
          role: 'contentWriter',
          profileImage: null,
          createdAt: '2026-08-22T01:02:35.941Z',
        },
        default: true,
      },
      schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
      tips: ['راجع الفقرة الأولى'],
      verdictText:
        'الإجابة الصحيحة هي الخيار الثاني لأنه الوحيد المطابق للشرط.',
    },
    {
      id: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
      title:
        '**Testing answer is shown below**\n\nالدرس 1 - الوحدة 1 - الاجتماعيات\n\nAnswer: true. The Earth revolves around the Sun.',
      type: 'trueFalse',
      purpose: 'lesson',
      lesson: {
        id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
        title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
        description: 'شرح الوحدة 1 - الاجتماعيات',
        unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
        index: 1,
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        status: 'published',
        questionCount: 6,
      },
      lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
      course: null,
      courseId: null,
      optionsGroups: [],
      trueOrFalse: {
        id: 'ca4f0d38-f409-41c8-b024-16f265d37faf',
        value: true,
        questionId: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
      },
      classifyItems: [],
      matchingItems: [],
      orderItems: [],
      fillBlanks: [],
      imageId: null,
      school: {
        id: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        name: 'default school',
        logo: null,
        owner: {
          id: '7b1f34fb-5c8a-4014-8e37-6840b9e0e732',
          name: 'default school',
          email: 'content@hul.com',
          phoneNumber: null,
          emailVerified: true,
          role: 'contentWriter',
          profileImage: null,
          createdAt: '2026-08-22T01:02:35.941Z',
        },
        default: true,
      },
      schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
      tips: [],
      verdictText: 'العبارة صحيحة بحسب تعريف الدرس.',
    },
  ],
};

// ============================================================================
// 2. POST /api/learning/solving/lesson/solve
// ============================================================================

/**
 * The request shape is unchanged by this work. This one was deliberately mixed:
 * options / classify / order answered correctly, match answered with rotated
 * (wrong) pairs, fillBlanks with blank 0 right and blank 1 wrong, and
 * trueFalse left empty so it counts as skipped.
 */
export const SOLVE_REQUEST = {
  snapshotId: '7e4a3cf2-9373-49b1-88be-aa88115797b5',
  answers: [
    {
      id: 'd0d506ff-9efe-4838-b370-8a8449593d57',
      answer: {
        options: [
          {
            index: 0,
            answered: '8f9e7b88-bfa8-48f5-aa71-66092f0fd993',
          },
        ],
      },
    },
    {
      id: 'd6ae3b79-257c-4442-80e0-dc20ed5fe6df',
      answer: {
        matches: [
          {
            baseId: '376784af-b049-407c-b624-28f5cae07b7d',
            matchId: '88f347c2-7ddb-46fa-85c6-29f97647297a',
          },
          {
            baseId: '05e1cf2d-c5f9-41e4-ae4a-f279860d9405',
            matchId: '30f5b2cf-9441-474b-941a-5575be364f49',
          },
          {
            baseId: '5bd63ed4-003f-44de-992b-538a19264eb9',
            matchId: '14594271-97f5-4bcd-a369-86625cf9246a',
          },
        ],
      },
    },
    {
      id: 'fcb9a829-51ed-4a99-bb90-c58eba78057f',
      answer: {
        classify: [
          {
            categoryId: '0eabee07-25d5-44e8-a40f-dc24fce2d3a3',
            items: [
              '69705217-586f-49c8-b393-11f610923083',
              'be9b34b1-8914-49c5-9dc1-c6e693e5598a',
            ],
          },
          {
            categoryId: '2895427b-aed9-4455-b7c0-9231e5074753',
            items: [
              '5964c554-aa34-435c-a9a8-54ff40be04b1',
              '3b18c231-b540-4b3d-94da-4ba8af439155',
            ],
          },
        ],
      },
    },
    {
      id: 'd4133edf-8e07-4136-9f04-766a25aaf78c',
      answer: {
        orders: [
          {
            id: '1fe8ad1e-f723-4e40-8390-ab3d350d484a',
            order: 0,
          },
          {
            id: '273495ed-b579-4940-b03a-be2944dc8859',
            order: 2,
          },
          {
            id: '6342f095-233e-4d38-82a3-5f795efa22ba',
            order: 1,
          },
        ],
      },
    },
    {
      id: '7d8ea0b4-0089-45c1-80d9-195aecc0bf7c',
      answer: {
        fillBlanks: [
          {
            index: 0,
            answer: '  damascus ',
          },
          {
            index: 1,
            answer: 'Aleppo',
          },
        ],
      },
    },
    {
      id: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
      answer: {},
    },
  ],
};

/**
 * Response. verdicts is trimmed to three entries that show all three outcomes
 * - correct, wrong, skipped - but the counters are for all six questions that
 * were actually solved.
 *
 * Read a verdict like this: answered is what the student sent, question holds
 * the truth to compare it against.
 *   - options    -> answered.options[i].answered is an option id; the correct
 *                   one is the option in that group with isCorrect: true
 *   - fillBlanks -> answered.fillBlanks[i].answer vs fillBlanks[i].answers[]
 *                   (accepted answers; matching is trimmed and
 *                   case-insensitive, which is why "  damascus " graded as a
 *                   match and comes back already trimmed)
 *   - trueFalse  -> answered is {} because it was skipped; the truth is
 *                   question.trueOrFalse.value
 *
 * correct is false on the fillBlanks question even though blank 0 was right -
 * grading is all-or-nothing now.
 */
export const SOLVE_RESPONSE = {
  correct: 3,
  total: 6,
  skipped: 1,
  score: 0.5,
  passed: false,
  xps: 0,
  gems: 0,
  verdicts: [
    {
      correct: true,
      skipped: false,
      question: {
        id: 'd0d506ff-9efe-4838-b370-8a8449593d57',
        title:
          '**Testing answer is shown below**\n\nالدرس 1 - الوحدة 1 - الاجتماعيات\n\nAnswer: option 2. Select option 2.',
        type: 'options',
        purpose: 'lesson',
        lesson: {
          id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
          title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
          description: 'شرح الوحدة 1 - الاجتماعيات',
          unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
          index: 1,
          schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          status: 'published',
          questions:
            '<6 sibling questions, each complete with its own answer key - see the KNOWN ISSUE note at the bottom of this file>',
        },
        lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
        course: null,
        courseId: null,
        optionsGroups: [
          {
            id: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
            text: null,
            index: 0,
            options: [
              {
                id: '8f9e7b88-bfa8-48f5-aa71-66092f0fd993',
                text: 'Option 2',
                isCorrect: true,
                groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
              },
              {
                id: '07c34e54-ae96-4d77-8831-eb2c5d1986b4',
                text: 'Option 1',
                isCorrect: false,
                groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
              },
              {
                id: '24b41bcf-befc-449b-83cb-2da5cd1fdbe0',
                text: 'Option 3',
                isCorrect: false,
                groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
              },
              {
                id: '1ac5ad65-8f79-4ed6-bb1d-52bb9c3aedd7',
                text: 'Option 4',
                isCorrect: false,
                groupId: 'b75db5aa-1f7a-4c4f-bbba-24b2c84ee71d',
              },
            ],
            schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
            questionId: 'd0d506ff-9efe-4838-b370-8a8449593d57',
          },
        ],
        trueOrFalse: null,
        classifyItems: [],
        matchingItems: [],
        orderItems: [],
        fillBlanks: [],
        imageId: null,
        school: {
          id: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          name: 'default school',
          logo: null,
          owner: {
            id: '7b1f34fb-5c8a-4014-8e37-6840b9e0e732',
            name: 'default school',
            email: 'content@hul.com',
            phoneNumber: null,
            password:
              '$2b$10$1a1ftrms8J2nbxSSy/Hoz.4zvu0CHa/1WSY9Cap2ybbKhz4T0Zn4.',
            emailVerified: true,
            role: 'contentWriter',
            profileImage: null,
            createdAt: '2026-08-22T01:02:35.941Z',
          },
          default: true,
        },
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        tips: ['راجع الفقرة الأولى'],
        verdictText:
          'الإجابة الصحيحة هي الخيار الثاني لأنه الوحيد المطابق للشرط.',
      },
      answered: {
        options: [
          {
            answered: '8f9e7b88-bfa8-48f5-aa71-66092f0fd993',
            index: 0,
          },
        ],
      },
    },
    {
      correct: false,
      skipped: false,
      question: {
        id: '7d8ea0b4-0089-45c1-80d9-195aecc0bf7c',
        title:
          '**Testing answer is shown below**\n\nالدرس 1 - الوحدة 1 - الاجتماعيات\n\nAnswers: Damascus, Syria. {{textField: {index: 0, width: 80, textDirection: ltr, hint: null, contentLength: 2}}} is the capital of {{textField: {index: 1, width: 80, textDirection: ltr, hint: null, contentLength: 2}}}.',
        type: 'fillBlanks',
        purpose: 'lesson',
        lesson: {
          id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
          title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
          description: 'شرح الوحدة 1 - الاجتماعيات',
          unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
          index: 1,
          schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          status: 'published',
          questions:
            '<6 sibling questions, each complete with its own answer key - see the KNOWN ISSUE note at the bottom of this file>',
        },
        lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
        course: null,
        courseId: null,
        optionsGroups: [],
        trueOrFalse: null,
        classifyItems: [],
        matchingItems: [],
        orderItems: [],
        fillBlanks: [
          {
            id: '0d63ad2f-c7b3-4c90-b17c-246331659f6d',
            index: 0,
            answers: ['Damascus'],
            questionId: '7d8ea0b4-0089-45c1-80d9-195aecc0bf7c',
            schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          },
          {
            id: 'f007c599-35fc-40b4-a391-97b945680675',
            index: 1,
            answers: ['Syria'],
            questionId: '7d8ea0b4-0089-45c1-80d9-195aecc0bf7c',
            schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          },
        ],
        imageId: null,
        school: {
          id: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          name: 'default school',
          logo: null,
          owner: {
            id: '7b1f34fb-5c8a-4014-8e37-6840b9e0e732',
            name: 'default school',
            email: 'content@hul.com',
            phoneNumber: null,
            password:
              '$2b$10$1a1ftrms8J2nbxSSy/Hoz.4zvu0CHa/1WSY9Cap2ybbKhz4T0Zn4.',
            emailVerified: true,
            role: 'contentWriter',
            profileImage: null,
            createdAt: '2026-08-22T01:02:35.941Z',
          },
          default: true,
        },
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        tips: [],
        verdictText: null,
      },
      answered: {
        fillBlanks: [
          {
            index: 0,
            answer: 'damascus',
          },
          {
            index: 1,
            answer: 'Aleppo',
          },
        ],
      },
    },
    {
      correct: false,
      skipped: true,
      question: {
        id: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
        title:
          '**Testing answer is shown below**\n\nالدرس 1 - الوحدة 1 - الاجتماعيات\n\nAnswer: true. The Earth revolves around the Sun.',
        type: 'trueFalse',
        purpose: 'lesson',
        lesson: {
          id: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
          title: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
          description: 'شرح الوحدة 1 - الاجتماعيات',
          unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
          index: 1,
          schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          status: 'published',
          questions:
            '<6 sibling questions, each complete with its own answer key - see the KNOWN ISSUE note at the bottom of this file>',
        },
        lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
        course: null,
        courseId: null,
        optionsGroups: [],
        trueOrFalse: {
          id: 'ca4f0d38-f409-41c8-b024-16f265d37faf',
          value: true,
          questionId: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
          schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        },
        classifyItems: [],
        matchingItems: [],
        orderItems: [],
        fillBlanks: [],
        imageId: null,
        school: {
          id: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
          name: 'default school',
          logo: null,
          owner: {
            id: '7b1f34fb-5c8a-4014-8e37-6840b9e0e732',
            name: 'default school',
            email: 'content@hul.com',
            phoneNumber: null,
            password:
              '$2b$10$1a1ftrms8J2nbxSSy/Hoz.4zvu0CHa/1WSY9Cap2ybbKhz4T0Zn4.',
            emailVerified: true,
            role: 'contentWriter',
            profileImage: null,
            createdAt: '2026-08-22T01:02:35.941Z',
          },
          default: true,
        },
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        tips: [],
        verdictText: 'العبارة صحيحة بحسب تعريف الدرس.',
      },
      answered: {},
    },
  ],
};

// ============================================================================
// 3. GET /api/learning/attempts/student?limit=1&skip=0
// ============================================================================

/**
 * Unchanged except for the embedded result, which is the same
 * QuestionVerdictResult the solve call returned (verdicts elided here - see
 * SOLVE_RESPONSE for the shape). The frozen counters on the row itself are
 * what a list screen should render; result is only for the drill-down.
 *
 * The school owner reads the same shape from
 * GET /api/learning/attempts/school (which adds a studentId filter).
 */
export const ATTEMPTS_RESPONSE = {
  next: true,
  back: false,
  totalRecords: 8,
  list: [
    {
      id: 'eae104fb-c0e9-411d-9551-077b417f8278',
      student: {
        id: 'd817105b-b7bc-4e04-ad03-160ce80d01ac',
        userId: '4d41eb59-b302-4fa8-8219-298e7ac26fb1',
        user: {
          id: '4d41eb59-b302-4fa8-8219-298e7ac26fb1',
          name: 'student',
          email: 'student@hul.com',
          phoneNumber: null,
          emailVerified: true,
          role: 'student',
          profileImage: null,
          createdAt: '2026-08-22T01:02:35.941Z',
        },
        active: true,
        schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
        trackId: '380f0472-3e3d-4ba5-9172-b4c6399176cd',
        currentStreak: 1,
        longestStreak: 1,
        lastStreakDate: '2026-09-05',
        xp: 450,
        gems: 0,
        createdAt: '2026-08-22T01:02:37.548Z',
      },
      studentId: 'd817105b-b7bc-4e04-ad03-160ce80d01ac',
      lessonId: '49c7c829-d631-4709-9b76-ebf1a27d25d7',
      schoolId: '30bb263b-a8bd-4010-86cb-4853cd615a7f',
      track: {
        id: '380f0472-3e3d-4ba5-9172-b4c6399176cd',
        name: 'الصف التاسع',
        createdAt: '2026-08-22T01:02:35.952Z',
      },
      trackId: '380f0472-3e3d-4ba5-9172-b4c6399176cd',
      course: {
        id: 'd4b964ec-d438-44dd-aa1a-7ac8002d7fc1',
        title: 'الاجتماعيات',
        trackId: '380f0472-3e3d-4ba5-9172-b4c6399176cd',
        createdAt: '2026-08-22T01:02:35.955Z',
      },
      courseId: 'd4b964ec-d438-44dd-aa1a-7ac8002d7fc1',
      unitId: '23dba303-9ae4-463f-8b03-d6ce60f5be3f',
      lessonTitle: 'الدرس 1 - الوحدة 1 - الاجتماعيات',
      attemptNumber: 2,
      questionsTotal: 6,
      questionsCorrect: 3,
      questionsSkipped: 1,
      completed: false,
      xpAwarded: 0,
      createdAt: '2026-09-05T14:58:11.904Z',
      result: {
        score: 0.5,
        total: 6,
        passed: false,
        correct: 3,
        skipped: 1,
        verdicts: '<the same 6 objects as SOLVE_RESPONSE.verdicts>',
      },
    },
  ],
};

/**
 * GET /api/learning/attempts/student/:attemptId/questions
 *
 * One row per graded question. score/total are now always 1/1 or 0/1 - partial
 * credit died with the per-item breakdown - and result is the single uniform
 * verdict. Two of six rows shown; question inside result is elided because it
 * is byte-for-byte the object already shown in START_RESPONSE.
 */
export const ATTEMPT_QUESTIONS_RESPONSE = [
  {
    id: 'b40ae613-ff18-4b98-a367-cd9603d00f17',
    lessonAttemptId: 'eae104fb-c0e9-411d-9551-077b417f8278',
    studentId: 'd817105b-b7bc-4e04-ad03-160ce80d01ac',
    questionId: 'd0d506ff-9efe-4838-b370-8a8449593d57',
    questionType: 'options',
    score: 1,
    total: 1,
    isCorrect: true,
    createdAt: '2026-09-05T14:58:11.904Z',
    isSkipped: false,
    result: {
      correct: true,
      skipped: false,
      answered: {
        options: [
          {
            index: 0,
            answered: '8f9e7b88-bfa8-48f5-aa71-66092f0fd993',
          },
        ],
      },
      question: '<the full question object - see START_RESPONSE>',
    },
  },
  {
    id: 'a105407a-dc19-41a8-8ac9-aa0a81ba19b2',
    lessonAttemptId: 'eae104fb-c0e9-411d-9551-077b417f8278',
    studentId: 'd817105b-b7bc-4e04-ad03-160ce80d01ac',
    questionId: 'a33b0e09-4f75-44ee-8ed0-65b3b06a3ca3',
    questionType: 'trueFalse',
    score: 0,
    total: 1,
    isCorrect: false,
    createdAt: '2026-09-05T14:58:11.904Z',
    isSkipped: true,
    result: {
      correct: false,
      skipped: true,
      answered: {},
      question: '<the full question object - see START_RESPONSE>',
    },
  },
];

// ============================================================================
// 4. KNOWN ISSUE THIS CHANGE INTRODUCES - payload weight + a leak
// ============================================================================
//
// Measured on this exact 6-question lesson:
//
//     start response: 14803 bytes
//     solve response: 39035 bytes   (~2.6x the start payload)
//
// Why: a solve reads its questions back from the Redis snapshot, and that
// snapshot is written with a plain JSON.stringify
// (SnapshotsService.addQuestionSnapshot). Lesson.questions is declared
//
//     @OneToMany(() => Question, (q) => q.lesson, { eager: true })
//     @Exclude()
//     questions: Question[];
//
// The @Exclude() only governs class-transformer, i.e. the HTTP layer - it does
// nothing for JSON.stringify. So every question frozen into a snapshot carries
// its lesson, and that lesson carries ALL of its sibling questions, each with
// its own complete answer key.
//
// This never reached a client before, because the old verdict carried only
// id/title/type. Now that a verdict embeds the whole question, those nested
// siblings ride along - into the solve response AND into the jsonb of
// LessonAttempt.result and QuestionAttempt.result, once per question, forever.
//
// The same path puts question.school.owner - the content writer's user row,
// email included - in front of students.
//
// Suggested fix (NOT applied - your call): in
// QuestionService.checkAnswerHelper, embed a lean question in the verdict:
// drop the lesson / course / school relation objects, keep lessonId /
// courseId / schoolId. The client already knows which lesson it is solving,
// and it kills both the duplication and the leak in one place.
