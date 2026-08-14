'use strict';

const { randomUUID } = require('node:crypto');
require('dotenv').config();

const requiredEnvironment = [
  'SCHOOL_EMAIL',
  'SCHOOL_PASSWORD',
  'STUDENT_EMAIL',
  'STUDENT_PASSWORD',
];
const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name],
);
if (missingEnvironment.length) {
  console.error(
    `Missing environment variables: ${missingEnvironment.join(', ')}\n` +
      'See the usage comment at the top of scripts/question-api-hardening.js.',
  );
  process.exit(2);
}

/*
PowerShell usage:
  $env:SCHOOL_EMAIL='...'
  $env:SCHOOL_PASSWORD='...'
  $env:STUDENT_EMAIL='...'
  $env:STUDENT_PASSWORD='...'
  npm run test:questions-hard

Optional:
  $env:API_BASE_URL='http://127.0.0.1:3000/api'
  $env:CLEANUP_CREATED_DATA='1'  # deletes only this run's created lesson/units
*/
const config = {
  baseUrl: (process.env.API_BASE_URL || 'http://127.0.0.1:3000/api').replace(
    /\/$/,
    '',
  ),
  schoolEmail: process.env.SCHOOL_EMAIL,
  schoolPassword: process.env.SCHOOL_PASSWORD,
  studentEmail: process.env.STUDENT_EMAIL,
  studentPassword: process.env.STUDENT_PASSWORD,
  cleanupCreatedData: process.env.CLEANUP_CREATED_DATA === '1',
};

const state = {
  passed: 0,
  failed: 0,
  failures: [],
  schoolToken: null,
  studentToken: null,
  trackId: null,
  courseId: null,
  unitId: null,
  emptyUnitId: null,
  lessonId: null,
  createdQuestions: {},
};

function printable(value) {
  if (value === undefined) return '';
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > 800 ? `${text.slice(0, 800)}…` : text;
}

function record(ok, name, extra) {
  if (ok) {
    state.passed++;
    console.log(`  PASS  ${name}`);
    return true;
  }
  state.failed++;
  const details = printable(extra);
  state.failures.push({ name, details });
  console.error(`  FAIL  ${name}${details ? `\n        ${details}` : ''}`);
  return false;
}

function requireCondition(condition, name, extra) {
  if (!record(condition, name, extra)) {
    throw new Error(`Cannot continue: ${name}`);
  }
}

async function request(method, path, { token, body, timeout = 20_000 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      message: error.message,
    };
  }

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? payload.data
      : payload;
  let message = payload?.message || payload?.error || response.statusText;
  if (Array.isArray(message)) message = message.join(' | ');
  if (message && typeof message === 'object') message = JSON.stringify(message);
  return {
    ok: response.ok,
    status: response.status,
    data,
    message: String(message || ''),
  };
}

async function mustRequest(name, method, path, options) {
  const result = await request(method, path, options);
  requireCondition(result.ok, name, `HTTP ${result.status}: ${result.message}`);
  return result.data;
}

async function expectRejected(name, method, path, options, statuses = [400]) {
  const result = await request(method, path, options);
  record(
    !result.ok && statuses.includes(result.status),
    name,
    result.ok
      ? `Unexpectedly accepted: ${printable(result.data)}`
      : `HTTP ${result.status}: ${result.message}`,
  );
  return result;
}

async function expectQuestionRejected(name, body) {
  return expectRejected(name, 'POST', '/curriculum/school/questions', {
    token: state.schoolToken,
    body,
  });
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function findText(items, text) {
  return (items || []).find((item) => normalize(item.text) === normalize(text));
}

async function login(email, password, label) {
  const data = await mustRequest(`${label} login`, 'POST', '/auth/login', {
    body: { email, password },
  });
  requireCondition(!!data?.accessToken, `${label} returned an access token`);
  return data;
}

async function questionList() {
  return mustRequest(
    'Read test lesson questions',
    'GET',
    `/curriculum/school/questions?lessonId=${state.lessonId}&limit=100`,
    { token: state.schoolToken },
  );
}

async function runCreationValidationTests() {
  console.log('\nCreation DTO and component validation');
  const failuresBefore = state.failed;
  const base = {
    title: 'Hard validation probe',
    purpose: 'lesson',
    lessonId: state.lessonId,
  };
  const twoOptions = () => [
    { text: 'A', isCorrect: true },
    { text: 'B', isCorrect: false },
  ];

  const invalidCases = [
    [
      'Reject unknown top-level fields',
      {
        ...base,
        type: 'trueFalse',
        correctAnswer: true,
        injected: 'not-whitelisted',
      },
    ],
    [
      'Reject missing lessonId for lesson-purpose question',
      {
        title: base.title,
        purpose: 'lesson',
        type: 'trueFalse',
        correctAnswer: true,
      },
    ],
    [
      'Reject lesson-purpose question carrying courseId',
      {
        ...base,
        courseId: state.courseId,
        type: 'trueFalse',
        correctAnswer: true,
      },
    ],
    [
      'Reject component payload for another question type',
      {
        ...base,
        type: 'trueFalse',
        correctAnswer: true,
        orders: [{ text: 'One' }, { text: 'Two' }],
      },
    ],
    [
      'Reject unknown nested option fields',
      {
        ...base,
        type: 'options',
        optionGroups: [
          {
            index: 0,
            options: [
              { text: 'A', isCorrect: true, injected: true },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    ],
    [
      'Reject whitespace-only option text after trimming',
      {
        ...base,
        type: 'options',
        optionGroups: [
          {
            index: 0,
            options: [
              { text: '   ', isCorrect: true },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    ],
    [
      'Reject duplicate option-group indexes',
      {
        ...base,
        type: 'options',
        optionGroups: [0, 0].map((index) => ({
          index,
          options: twoOptions(),
        })),
      },
    ],
    [
      'Reject null option-group index instead of coercing it to zero',
      {
        ...base,
        type: 'options',
        optionGroups: [{ index: null, options: twoOptions() }],
      },
    ],
    [
      'Reject option group without a correct answer',
      {
        ...base,
        type: 'options',
        optionGroups: [
          {
            index: 0,
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    ],
    [
      'Reject match base without correctIndex',
      {
        ...base,
        type: 'match',
        matchingItems: [
          { text: 'A', type: 'match' },
          { text: 'B', type: 'match' },
          { text: 'Base', type: 'base' },
        ],
      },
    ],
    [
      'Reject match correctIndex pointing to a base',
      {
        ...base,
        type: 'match',
        matchingItems: [
          { text: 'A', type: 'match' },
          { text: 'Base 1', type: 'base', correctIndex: 1 },
          { text: 'Base 2', type: 'base', correctIndex: 0 },
        ],
      },
    ],
    [
      'Reject two match bases reusing one target',
      {
        ...base,
        type: 'match',
        matchingItems: [
          { text: 'A', type: 'match' },
          { text: 'B', type: 'match' },
          { text: 'Base 1', type: 'base', correctIndex: 0 },
          { text: 'Base 2', type: 'base', correctIndex: 0 },
        ],
      },
    ],
    [
      'Reject correctIndex supplied on a match row',
      {
        ...base,
        type: 'match',
        matchingItems: [
          { text: 'A', type: 'match', correctIndex: 99 },
          { text: 'B', type: 'match' },
          { text: 'Base', type: 'base', correctIndex: 0 },
        ],
      },
    ],
    [
      'Reject category carrying correctCategoryIndex',
      {
        ...base,
        type: 'classify',
        classify: [
          { text: 'Category', type: 'category', correctCategoryIndex: 0 },
          { text: 'Item', type: 'item', correctCategoryIndex: 0 },
        ],
      },
    ],
    [
      'Reject null item correctCategoryIndex instead of coercing it to zero',
      {
        ...base,
        type: 'classify',
        classify: [
          { text: 'Category', type: 'category' },
          { text: 'Item', type: 'item', correctCategoryIndex: null },
        ],
      },
    ],
    [
      'Reject classification item pointing to another item',
      {
        ...base,
        type: 'classify',
        classify: [
          { text: 'Category', type: 'category' },
          { text: 'Item 1', type: 'item', correctCategoryIndex: 2 },
          { text: 'Item 2', type: 'item', correctCategoryIndex: 0 },
        ],
      },
    ],
    [
      'Reject order question with fewer than two items',
      { ...base, type: 'order', orders: [{ text: 'Only item' }] },
    ],
    [
      'Reject whitespace-only accepted fill-blank answer',
      {
        ...base,
        title: 'Value {{textField:{width:120,contentLength:null,index:0}}}',
        type: 'fillBlanks',
        fillBlanks: [{ index: 0, answers: ['   '] }],
      },
    ],
    [
      'Reject fill-blank placeholder/data mismatch',
      {
        ...base,
        title: 'Value without a placeholder',
        type: 'fillBlanks',
        fillBlanks: [{ index: 0, answers: ['answer'] }],
      },
    ],
    [
      'Reject non-boolean true/false answer',
      { ...base, type: 'trueFalse', correctAnswer: 1 },
    ],
  ];

  for (const [name, body] of invalidCases) {
    await expectQuestionRejected(name, body);
  }
  requireCondition(
    state.failed === failuresBefore,
    'All individual invalid creation payloads were rejected',
  );

  const before = await questionList();
  const bulk = await expectRejected(
    'Reject invalid nested question in bulk request',
    'POST',
    '/curriculum/school/questions/bulk',
    {
      token: state.schoolToken,
      body: {
        questions: [
          {
            ...base,
            title: 'Would be valid',
            type: 'trueFalse',
            correctAnswer: true,
          },
          {
            ...base,
            title: 'Invalid order',
            type: 'order',
            orders: [{ text: 'one' }],
          },
        ],
      },
    },
  );
  if (!bulk.ok) {
    const after = await questionList();
    record(
      after.totalRecords === before.totalRecords,
      'Invalid bulk request is atomic',
      { before: before.totalRecords, after: after.totalRecords },
    );
  }
}

async function createValidQuestions(prefix) {
  console.log('\nValid creation and normalization');
  const common = {
    purpose: 'lesson',
    lessonId: state.lessonId,
    tips: ['safe test tip'],
  };
  const payloads = {
    options: {
      ...common,
      title: `${prefix} options`,
      type: 'options',
      optionGroups: [
        {
          title: '  Primary group  ',
          index: 0,
          options: [
            { text: '  Correct option  ', isCorrect: true },
            { text: '  Wrong option  ', isCorrect: false },
          ],
        },
      ],
    },
    trueFalse: {
      ...common,
      title: `${prefix} true false`,
      type: 'trueFalse',
      correctAnswer: true,
    },
    match: {
      ...common,
      title: `${prefix} match`,
      type: 'match',
      matchingItems: [
        { text: '  Mercury  ', type: 'match' },
        { text: '  Mars  ', type: 'match' },
        { text: '  Closest planet  ', type: 'base', correctIndex: 0 },
        { text: '  Red planet  ', type: 'base', correctIndex: 1 },
      ],
    },
    classify: {
      ...common,
      title: `${prefix} classify`,
      type: 'classify',
      classify: [
        { text: '  Mammals  ', type: 'category' },
        { text: '  Birds  ', type: 'category' },
        { text: '  Cat  ', type: 'item', correctCategoryIndex: 0 },
        { text: '  Eagle  ', type: 'item', correctCategoryIndex: 1 },
      ],
    },
    order: {
      ...common,
      title: `${prefix} order`,
      type: 'order',
      orders: [
        { text: '  First  ' },
        { text: '  Second  ' },
        { text: '  Third  ' },
      ],
    },
    fillBlanks: {
      ...common,
      title:
        'Complete {{textField:{width:120,contentLength:null,index:0}}} and {{textField:{width:120,contentLength:10,index:1}}}',
      type: 'fillBlanks',
      fillBlanks: [
        { index: 0, answers: ['  Alpha  '] },
        { index: 1, answers: ['  BETA  '] },
      ],
    },
  };

  for (const [type, body] of Object.entries(payloads)) {
    state.createdQuestions[type] = await mustRequest(
      `Create valid ${type} question`,
      'POST',
      '/curriculum/school/questions',
      { token: state.schoolToken, body },
    );
  }

  const listing = await questionList();
  record(listing.totalRecords === 6, 'Exactly six valid questions exist', {
    totalRecords: listing.totalRecords,
  });
  const byId = new Map(
    (listing.list || []).map((question) => [question.id, question]),
  );
  const option = byId.get(state.createdQuestions.options.id);
  const match = byId.get(state.createdQuestions.match.id);
  const classify = byId.get(state.createdQuestions.classify.id);
  const order = byId.get(state.createdQuestions.order.id);
  const fill = byId.get(state.createdQuestions.fillBlanks.id);

  record(
    option?.optionsGroups?.[0]?.text === 'Primary group',
    'Trim option-group title on storage',
  );
  record(
    option?.optionsGroups?.[0]?.options?.[0]?.text === 'Correct option',
    'Trim option text on storage',
  );
  record(
    findText(match?.matchingItems, 'Mercury')?.text === 'Mercury',
    'Trim match text on storage',
  );
  record(
    findText(classify?.classifyItems, 'Cat')?.text === 'Cat',
    'Trim classify text on storage',
  );
  record(
    findText(order?.orderItems, 'First')?.text === 'First',
    'Trim order text on storage',
  );
  record(
    fill?.fillBlanks?.[0]?.answers?.[0] === 'Alpha',
    'Trim accepted fill-blank answers on storage',
  );
}

function assertAnswersHidden(questions) {
  console.log('\nStudent answer-key hiding');
  const byType = new Map(
    questions.map((question) => [question.type, question]),
  );
  const option = byType.get('options');
  const match = byType.get('match');
  const classify = byType.get('classify');
  const order = byType.get('order');
  const fill = byType.get('fillBlanks');
  const bool = byType.get('trueFalse');

  record(
    option?.optionsGroups?.every((group) =>
      group.options.every((item) => !Object.hasOwn(item, 'isCorrect')),
    ),
    'Options hide isCorrect',
  );
  record(
    match?.matchingItems?.every((item) => !Object.hasOwn(item, 'correctIndex')),
    'Matches hide correctIndex',
  );
  record(
    classify?.classifyItems?.every(
      (item) => !Object.hasOwn(item, 'correctCategoryIndex'),
    ),
    'Classification hides correctCategoryIndex',
  );
  record(
    order?.orderItems?.every((item) => !Object.hasOwn(item, 'sort')),
    'Order items hide sort',
  );
  record(
    fill?.fillBlanks?.every((item) => !Object.hasOwn(item, 'answers')),
    'Fill blanks hide accepted answers',
  );
  record(
    bool &&
      !Object.hasOwn(bool, 'trueOrFalseAnswer') &&
      (!bool.trueOrFalse || !Object.hasOwn(bool.trueOrFalse, 'value')),
    'True/false hides the correct value',
  );
}

function buildCorrectAnswers(questions) {
  const visible = new Map(questions.map((question) => [question.id, question]));
  const created = state.createdQuestions;
  const option = visible.get(created.options.id);
  const group = option.optionsGroups[0];
  const correctOption = findText(group.options, 'Correct option');

  const match = visible.get(created.match.id);
  const closest = findText(match.matchingItems, 'Closest planet');
  const red = findText(match.matchingItems, 'Red planet');
  const mercury = findText(match.matchingItems, 'Mercury');
  const mars = findText(match.matchingItems, 'Mars');

  const classify = visible.get(created.classify.id);
  const mammals = findText(classify.classifyItems, 'Mammals');
  const birds = findText(classify.classifyItems, 'Birds');
  const cat = findText(classify.classifyItems, 'Cat');
  const eagle = findText(classify.classifyItems, 'Eagle');

  const order = visible.get(created.order.id);
  const orderedItems = ['First', 'Second', 'Third'].map((text) =>
    findText(order.orderItems, text),
  );

  return [
    {
      id: created.options.id,
      answer: {
        options: [{ index: group.index, answered: correctOption.id }],
      },
    },
    { id: created.trueFalse.id, answer: { boolAnswer: true } },
    {
      id: created.match.id,
      answer: {
        matches: [
          { baseId: closest.id, matchId: mercury.id },
          { baseId: red.id, matchId: mars.id },
        ],
      },
    },
    {
      id: created.classify.id,
      answer: {
        classify: [
          { categoryId: mammals.id, items: [cat.id] },
          { categoryId: birds.id, items: [eagle.id] },
        ],
      },
    },
    {
      id: created.order.id,
      answer: {
        orders: orderedItems.map((item, index) => ({
          id: item.id,
          order: index,
        })),
      },
    },
    {
      id: created.fillBlanks.id,
      answer: {
        fillBlanks: [
          { index: 0, answer: '  aLpHa  ' },
          { index: 1, answer: '  beta  ' },
        ],
      },
    },
  ];
}

async function runSolveValidationTests(snapshotId, questions, correctAnswers) {
  console.log('\nSolve DTO and component validation');
  const solvePath = '/learning/solving/lesson/solve';
  const solve = (answers, extra = {}) => ({ snapshotId, answers, ...extra });
  const created = state.createdQuestions;
  const visible = new Map(questions.map((question) => [question.id, question]));

  await expectRejected('Reject unknown solve DTO field', 'POST', solvePath, {
    token: state.studentToken,
    body: solve([], { injected: true }),
  });
  await expectRejected(
    'Reject duplicate question IDs in one solve',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        { id: created.trueFalse.id, answer: { boolAnswer: true } },
        { id: created.trueFalse.id, answer: { boolAnswer: true } },
      ]),
    },
  );
  await expectRejected(
    'Reject question outside the snapshot',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([{ id: randomUUID(), answer: {} }]),
    },
  );
  await expectRejected(
    'Reject answer component for wrong question type',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([{ id: created.options.id, answer: { matches: [] } }]),
    },
  );

  const option = visible.get(created.options.id);
  await expectRejected(
    'Reject option ID outside its question',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        {
          id: created.options.id,
          answer: {
            options: [
              { index: option.optionsGroups[0].index, answered: randomUUID() },
            ],
          },
        },
      ]),
    },
  );

  const match = visible.get(created.match.id);
  const bases = match.matchingItems.filter((item) => item.type === 'base');
  const target = match.matchingItems.find((item) => item.type === 'match');
  await expectRejected('Reject reuse of one match target', 'POST', solvePath, {
    token: state.studentToken,
    body: solve([
      {
        id: created.match.id,
        answer: {
          matches: bases.map((base) => ({
            baseId: base.id,
            matchId: target.id,
          })),
        },
      },
    ]),
  });

  const classify = visible.get(created.classify.id);
  const categories = classify.classifyItems.filter(
    (item) => item.type === 'category',
  );
  const classifiedItem = classify.classifyItems.find(
    (item) => item.type === 'item',
  );
  await expectRejected(
    'Reject classification item assigned twice',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        {
          id: created.classify.id,
          answer: {
            classify: categories.map((category) => ({
              categoryId: category.id,
              items: [classifiedItem.id],
            })),
          },
        },
      ]),
    },
  );

  const order = visible.get(created.order.id);
  await expectRejected(
    'Reject duplicate submitted order positions',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        {
          id: created.order.id,
          answer: {
            orders: order.orderItems
              .slice(0, 2)
              .map((item) => ({ id: item.id, order: 0 })),
          },
        },
      ]),
    },
  );
  await expectRejected(
    'Reject duplicate fill-blank indexes',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        {
          id: created.fillBlanks.id,
          answer: {
            fillBlanks: [
              { index: 0, answer: 'Alpha' },
              { index: 0, answer: 'Alpha' },
            ],
          },
        },
      ]),
    },
  );
  await expectRejected(
    'Reject string true/false solve answer',
    'POST',
    solvePath,
    {
      token: state.studentToken,
      body: solve([
        { id: created.trueFalse.id, answer: { boolAnswer: 'true' } },
      ]),
    },
  );

  console.log('\nConcurrent snapshot consumption and correct grading');
  const body = solve(correctAnswers);
  const [first, second] = await Promise.all([
    request('POST', solvePath, {
      token: state.studentToken,
      body,
      timeout: 60_000,
    }),
    request('POST', solvePath, {
      token: state.studentToken,
      body,
      timeout: 60_000,
    }),
  ]);
  const successes = [first, second].filter((result) => result.ok);
  const rejected = [first, second].filter((result) => !result.ok);
  record(
    successes.length === 1,
    'Exactly one concurrent solve consumes the snapshot',
    { statuses: [first.status, second.status] },
  );
  record(
    rejected.length === 1 && [400, 404].includes(rejected[0].status),
    'Concurrent duplicate solve is rejected safely',
    { status: rejected[0]?.status, message: rejected[0]?.message },
  );

  const verdict = successes[0]?.data;
  record(
    verdict?.passed === true && verdict?.correct === 6 && verdict?.total === 6,
    'All six correctly answered question types pass',
    verdict,
  );
  const fillVerdict = verdict?.verdicts?.find(
    (item) => item.id === created.fillBlanks.id,
  );
  record(
    fillVerdict?.verdict === true,
    'Fill-blank grading ignores case and surrounding whitespace',
    fillVerdict,
  );

  await expectRejected(
    'Reject replay after successful snapshot consumption',
    'POST',
    solvePath,
    { token: state.studentToken, body },
    [404],
  );
}

function findTreeData(tree) {
  const course = (tree || []).find((item) => item.id === state.courseId);
  const unit = course?.units?.find((item) => item.id === state.unitId);
  const lesson = unit?.lessons?.find((item) => item.id === state.lessonId);
  const emptyUnit = course?.units?.find(
    (item) => item.id === state.emptyUnitId,
  );
  return { lesson, emptyUnit };
}

async function cleanup() {
  if (!config.cleanupCreatedData) {
    console.log(
      '\nCleanup skipped. Set CLEANUP_CREATED_DATA=1 to delete only the IDs ' +
        'created by a run.',
    );
    console.log(
      printable({
        lessonId: state.lessonId,
        unitId: state.unitId,
        emptyUnitId: state.emptyUnitId,
      }),
    );
    return;
  }
  if (!state.schoolToken) return;
  console.log('\nCleanup of this run only');
  if (state.lessonId) {
    const result = await request(
      'DELETE',
      `/curriculum/school/lessons/${state.lessonId}`,
      { token: state.schoolToken },
    );
    record(
      result.ok || result.status === 404,
      'Delete test lesson',
      result.message,
    );
  }
  for (const [name, id] of [
    ['test unit', state.unitId],
    ['empty test unit', state.emptyUnitId],
  ]) {
    if (!id) continue;
    const result = await request('DELETE', `/curriculum/school/units/${id}`, {
      token: state.schoolToken,
    });
    record(
      result.ok || result.status === 404,
      `Delete ${name}`,
      result.message,
    );
  }
}

async function main() {
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const prefix = `hard-question-test-${runId}`;
  console.log(
    `Question API hardening test\nTarget: ${config.baseUrl}\nRun: ${runId}`,
  );

  try {
    const ping = await request('GET', '/ping');
    requireCondition(
      ping.ok,
      'API is reachable',
      `HTTP ${ping.status}: ${ping.message}`,
    );

    const [schoolLogin, studentLogin] = await Promise.all([
      login(config.schoolEmail, config.schoolPassword, 'School account'),
      login(config.studentEmail, config.studentPassword, 'Student account'),
    ]);
    state.schoolToken = schoolLogin.accessToken;
    state.studentToken = studentLogin.accessToken;

    await expectRejected(
      'Student role cannot create curriculum questions',
      'POST',
      '/curriculum/school/questions',
      {
        token: state.studentToken,
        body: {},
      },
      [403],
    );
    await expectRejected(
      'School role cannot call the student solve endpoint',
      'POST',
      '/learning/solving/lesson/solve',
      {
        token: state.schoolToken,
        body: { snapshotId: randomUUID(), answers: [] },
      },
      [403],
    );

    const [school, student] = await Promise.all([
      mustRequest('Read owning school', 'GET', '/school/me', {
        token: state.schoolToken,
      }),
      mustRequest('Read student profile', 'GET', '/student/profile', {
        token: state.studentToken,
      }),
    ]);
    requireCondition(
      school.id === student.schoolId,
      'School and student accounts belong to the same school',
      { schoolId: school.id, studentSchoolId: student.schoolId },
    );
    requireCondition(!!student.trackId, 'Student has a track');
    state.trackId = student.trackId;

    const courses = await mustRequest(
      'Read school courses for student track',
      'GET',
      `/curriculum/school/courses/${state.trackId}`,
      { token: state.schoolToken },
    );
    requireCondition(
      Array.isArray(courses) && courses.length > 0,
      'Student track has a school-accessible course',
    );
    state.courseId = courses[0].id;

    const unit = await mustRequest(
      'Create isolated test unit',
      'POST',
      '/curriculum/school/units',
      {
        token: state.schoolToken,
        body: { title: `${prefix} unit`, courseId: state.courseId },
      },
    );
    state.unitId = unit.id;
    const emptyUnit = await mustRequest(
      'Create isolated empty unit',
      'POST',
      '/curriculum/school/units',
      {
        token: state.schoolToken,
        body: { title: `${prefix} empty unit`, courseId: state.courseId },
      },
    );
    state.emptyUnitId = emptyUnit.id;

    const lesson = await mustRequest(
      'Create isolated test lesson',
      'POST',
      '/curriculum/school/lessons',
      {
        token: state.schoolToken,
        body: {
          title: `${prefix} lesson`,
          description: 'Created by question-api-hardening.js',
          unitId: state.unitId,
        },
      },
    );
    state.lessonId = lesson.id;

    await runCreationValidationTests();
    await createValidQuestions(prefix);
    await mustRequest(
      'Publish test lesson',
      'PATCH',
      `/curriculum/school/lessons/${state.lessonId}`,
      { token: state.schoolToken, body: { status: 'published' } },
    );

    const treeBefore = await mustRequest(
      'Read school curriculum tree before solve',
      'GET',
      `/curriculum/school/tree/${state.trackId}`,
      { token: state.schoolToken },
    );
    const before = findTreeData(treeBefore);
    record(
      !!before.emptyUnit && before.emptyUnit.lessons.length === 0,
      'Tree includes units with no lessons',
    );
    record(
      before.lesson?.questionsCount === 6,
      'Tree reports six questions on test lesson',
      before.lesson,
    );
    record(
      before.lesson?.attemptCounts === 0,
      'Tree reports zero attempts before solve',
      before.lesson,
    );

    const started = await mustRequest(
      'Student starts test lesson',
      'POST',
      '/learning/solving/lesson/start',
      { token: state.studentToken, body: { lessonId: state.lessonId } },
    );
    requireCondition(!!started.snapshotId, 'Lesson start returned snapshotId');
    requireCondition(
      Array.isArray(started.questions) && started.questions.length === 6,
      'Snapshot contains all six questions',
      { count: started.questions?.length },
    );
    assertAnswersHidden(started.questions);
    const correctAnswers = buildCorrectAnswers(started.questions);
    await runSolveValidationTests(
      started.snapshotId,
      started.questions,
      correctAnswers,
    );

    const treeAfter = await mustRequest(
      'Read school curriculum tree after solve',
      'GET',
      `/curriculum/school/tree/${state.trackId}`,
      { token: state.schoolToken },
    );
    const after = findTreeData(treeAfter);
    record(
      after.lesson?.questionsCount === 6,
      'Question count remains six after solve',
      after.lesson,
    );
    record(
      after.lesson?.attemptCounts === 1,
      'Exactly one lesson attempt was recorded',
      after.lesson,
    );
  } catch (error) {
    record(
      false,
      'Hardening test completed without fatal setup/runtime error',
      error.stack || error.message,
    );
  } finally {
    await cleanup();
  }

  console.log(`\nResult: ${state.passed} passed, ${state.failed} failed`);
  if (state.failures.length) {
    console.error('\nFailures:');
    for (const failure of state.failures) {
      console.error(
        `- ${failure.name}${failure.details ? `: ${failure.details}` : ''}`,
      );
    }
    process.exitCode = 1;
  }
}

main();
