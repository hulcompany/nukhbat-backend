/* nukhba API workbench — manual test console for src/learning + src/core.
   Deliberately NO client-side validation: requests go out exactly as
   typed so the backend's validation is what gets exercised. Empty inputs
   are omitted; the Raw panel covers explicit garbage/empty/malformed. */

const ENVS = {
  dev: 'http://localhost:3000/api',
  prod: 'https://alnokhba-app.com/api',
};
let ENV = ENVS[localStorage.getItem('env')] ? localStorage.getItem('env') : 'dev';
let API = ENVS[ENV];

function setEnv(name) {
  if (!ENVS[name] || name === ENV) return;
  ENV = name;
  API = ENVS[name];
  localStorage.setItem('env', name);
  // tokens belong to the previous backend — force a fresh sign-in
  doLogout();
  resetChainFrom('c-course');
  fillChain(el('c-track'), [], 'sign in first');
  el('path-hint').textContent = `switched to ${name} (${API}) — sign in again`;
}

const S = {
  meta: null,
  units: [],
  lessons: [],
  questions: [],
  qSkip: 0,
  qTotal: 0,
  uSkip: 0,
  uTotal: 0,
};

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/* ================= log ================= */
function logEntry(method, path, status, body) {
  const log = el('log');
  const e = document.createElement('div');
  e.className = 'entry';
  const sClass = typeof status === 'number' ? 's' + String(status)[0] : 'sX';
  const when = new Date().toLocaleTimeString();
  e.innerHTML =
    `<div class="head"><span class="chip ${method}">${method}</span>` +
    `<span>${escapeHtml(path)}</span>` +
    `<span class="chip ${sClass}">${status}</span>` +
    `<span class="t">${when}</span></div>` +
    `<pre>${escapeHtml(typeof body === 'string' ? body : JSON.stringify(body, null, 2))}</pre>`;
  e.querySelector('.head').onclick = () => e.classList.toggle('open');
  if (typeof status !== 'number' || status >= 400) e.classList.add('open');
  log.prepend(e);
  while (log.children.length > 40) log.lastChild.remove();
}

/* ================= fetch core ================= */
async function call(method, path, body, opts = {}) {
  const headers = {};
  const tk = localStorage.getItem('tk');
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  const init = { method, headers };
  if (body !== undefined && body !== null) {
    if (opts.form) {
      init.body = body; // browser sets the multipart boundary
    } else if (opts.rawText) {
      headers['Content-Type'] = 'application/json';
      init.body = body; // verbatim string — malformed JSON allowed
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  let res, text;
  try {
    res = await fetch(API + path, init);
    text = await res.text();
  } catch (err) {
    logEntry(method, path, 'network error', String(err));
    throw err;
  }
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  logEntry(method, path, res.status, json);
  if (!res.ok) throw json;
  return json && json.data !== undefined ? json.data : json;
}

// first array anywhere in an unknown payload (pagination models etc.)
function pickArray(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k];
  }
  return [];
}

/* ================= ui helpers ================= */
function mountAction(slotId, verb, route, label, fn) {
  const b = document.createElement('button');
  b.className = 'act v-' + verb;
  b.innerHTML = `<span>${escapeHtml(label)}</span><span class="route">${verb} ${escapeHtml(route)}</span>`;
  b.onclick = fn;
  el(slotId).replaceChildren(b);
}

function miniBtn(label, fn, warn) {
  const b = document.createElement('button');
  b.className = 'mini' + (warn ? ' warn' : '');
  b.textContent = label;
  b.onclick = fn;
  return b;
}

function panel(name) {
  document.querySelectorAll('section.panel').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('#side button').forEach(b => b.classList.remove('on'));
  el('p-' + name).classList.add('on');
  document.querySelector(`#side button[data-p="${name}"]`).classList.add('on');
}

function move(arr, i, delta, rerender) {
  const j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  rerender();
}

function promptPatch(path, current) {
  const seed = JSON.stringify({ title: current.title ?? current.name });
  const body = prompt(`PATCH ${path}\nJSON body — sent exactly as typed:`, seed);
  if (body === null) return;
  call('PATCH', path, body, { rawText: true });
}

/* ================= auth ================= */
function preset(email) {
  el('a-email').value = email;
  el('a-pass').focus();
}

async function doLogin() {
  const d = await call('POST', '/auth/login', {
    email: el('a-email').value,
    password: el('a-pass').value,
  });
  localStorage.setItem('tk', d.accessToken || '');
  localStorage.setItem('rtk', d.refreshToken || '');
  localStorage.setItem('email', el('a-email').value);
  localStorage.setItem('pw', el('a-pass').value);
  setStatus('signed in: ' + el('a-email').value, true);
  await loadMeta();
  await loadTracks();
}

async function doRefresh() {
  const d = await call('POST', '/auth/refreshToken', {
    token: localStorage.getItem('rtk'),
  });
  localStorage.setItem('tk', d.accessToken || '');
  localStorage.setItem('rtk', d.refreshToken || '');
}

function doLogout() {
  localStorage.removeItem('tk');
  localStorage.removeItem('rtk');
  setStatus('signed out', false);
}

function setStatus(text, isIn) {
  const s = el('a-status');
  s.textContent = text;
  s.className = isIn ? 'in' : '';
}

async function loadMeta() {
  try {
    S.meta = await call('GET', '/learning/metaData');
    fillEnum('qc-type', S.meta.questionTypes);
    fillEnum('qc-purpose', S.meta.questionPurposeTypes);
    if (!el('qb-json').value) el('qb-json').value = bulkSample();
  } catch { /* in the log */ }
}

function fillEnum(id, values) {
  const sel = el(id);
  sel.length = 1;
  for (const v of values || []) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.add(o);
  }
}

function bulkSample() {
  const t = S.meta?.questionTypes || ['TYPE'];
  const p = S.meta?.questionPurposeTypes || ['PURPOSE'];
  return JSON.stringify({
    questions: [
      {
        title: 'سؤال 1', type: t[0], purpose: p[0], lessonId: 'LESSON-UUID',
        options: [
          { text: 'أ', isCorrect: true },
          { text: 'ب', isCorrect: false },
        ],
      },
    ],
  }, null, 2);
}

/* ================= path bar ================= */
function fillChain(sel, items, placeholder) {
  sel.length = 0;
  const p = document.createElement('option');
  p.value = ''; p.textContent = placeholder;
  sel.add(p);
  for (const it of items) {
    const o = document.createElement('option');
    o.value = it.id;
    o.textContent = it.title || it.name || it.id;
    sel.add(o);
  }
  sel.disabled = items.length === 0;
}

function resetChainFrom(level) {
  const order = ['c-course', 'c-unit', 'c-lesson'];
  for (let i = order.indexOf(level); i >= 0 && i < order.length; i++) {
    fillChain(el(order[i]), [], '—');
  }
  if (level === 'c-course' || level === 'c-unit') { S.lessons = []; renderLessons(); }
  if (level === 'c-course') { S.units = []; renderUnits(); }
}

async function loadTracks() {
  const tracks = pickArray(await call('GET', '/learning/tracks'));
  fillChain(el('c-track'), tracks, tracks.length ? 'choose a track…' : 'no tracks');
  fillChain(el('adm-track'), tracks, '— track —');
  el('adm-track').disabled = false;
  resetChainFrom('c-course');
  el('path-hint').textContent = tracks.length ? '' : 'no tracks came back — see the log';
}

async function onTrack() {
  resetChainFrom('c-course');
  const trackId = el('c-track').value;
  if (!trackId) return;
  const courses = pickArray(await call('GET', `/school/me/courses/${trackId}`));
  fillChain(el('c-course'), courses, courses.length ? 'choose a course…' : 'no courses');
}

async function onCourse() {
  resetChainFrom('c-unit');
  const courseId = el('c-course').value;
  if (!courseId) return;
  S.units = pickArray(await call('GET', `/school/me/units/${courseId}`));
  renderUnits();
  fillChain(el('c-unit'), S.units, S.units.length ? 'choose a unit…' : 'no units');
}

async function onUnit() {
  resetChainFrom('c-lesson');
  const unitId = el('c-unit').value;
  if (!unitId) return;
  S.lessons = pickArray(await call('GET', `/school/me/lessons/${unitId}`));
  renderLessons();
  fillChain(el('c-lesson'), S.lessons, S.lessons.length ? 'choose a lesson…' : 'no lessons');
}

async function onLesson() {
  const lessonId = el('c-lesson').value;
  if (!lessonId) return;
  el('qf-lesson').value = lessonId;
  el('qf-course').value = '';
  panel('questions');
  S.qSkip = 0;
  await loadQuestions();
}

/* ================= units & lessons ================= */
function renderUnits() {
  const tb = el('u-table').tBodies[0];
  tb.innerHTML = '';
  el('u-empty').style.display = S.units.length ? 'none' : '';
  el('u-table').style.display = S.units.length ? '' : 'none';
  S.units.forEach((u, i) => {
    const tr = tb.insertRow();
    tr.innerHTML = `<td>${u.index ?? ''}</td><td dir="auto">${escapeHtml(u.title ?? '')}</td>`;
    tr.insertCell().append(
      miniBtn('Up', () => move(S.units, i, -1, renderUnits)),
      ' ', miniBtn('Down', () => move(S.units, i, +1, renderUnits)),
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/units/${u.id}`, u)),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/units/${u.id}`).then(onCourse), true),
    );
  });
}

async function createUnit() {
  const body = {};
  if (el('u-title').value) body.title = el('u-title').value;
  if (el('c-course').value) body.courseId = el('c-course').value;
  await call('POST', '/school/me/units', body);
  onCourse();
}

async function saveUnitOrder() {
  await call('POST', `/school/me/units/order/${el('c-course').value}`, {
    ids: S.units.map(u => u.id),
  });
  onCourse();
}

function renderLessons() {
  const tb = el('l-table').tBodies[0];
  tb.innerHTML = '';
  el('l-empty').style.display = S.lessons.length ? 'none' : '';
  el('l-table').style.display = S.lessons.length ? '' : 'none';
  S.lessons.forEach((l, i) => {
    const tr = tb.insertRow();
    tr.innerHTML = `<td>${l.index ?? ''}</td><td dir="auto">${escapeHtml(l.title ?? '')}</td>` +
      `<td>${escapeHtml(l.status ?? '')}</td>`;
    tr.insertCell().append(
      miniBtn('Up', () => move(S.lessons, i, -1, renderLessons)),
      ' ', miniBtn('Down', () => move(S.lessons, i, +1, renderLessons)),
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/lessons/${l.id}`, l)),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/lessons/${l.id}`).then(onUnit), true),
    );
  });
}

async function createLesson() {
  const body = {};
  if (el('l-title').value) body.title = el('l-title').value;
  if (el('l-desc').value) body.description = el('l-desc').value;
  if (el('c-unit').value) body.unitId = el('c-unit').value;
  await call('POST', '/school/me/lessons', body);
  onUnit();
}

async function saveLessonOrder() {
  await call('POST', `/school/me/lessons/order/${el('c-unit').value}`, {
    ids: S.lessons.map(l => l.id),
  });
  onUnit();
}

/* ================= questions ================= */
function useSelectedLesson() {
  el('qf-lesson').value = el('c-lesson').value;
  el('qf-course').value = '';
  S.qSkip = 0;
  loadQuestions();
}
function useSelectedCourse() {
  el('qf-course').value = el('c-course').value;
  el('qf-lesson').value = '';
  S.qSkip = 0;
  loadQuestions();
}
function clearQFilter() {
  el('qf-lesson').value = '';
  el('qf-course').value = '';
  S.qSkip = 0;
  loadQuestions();
}
function qcUseLesson() { el('qc-lesson').value = el('c-lesson').value; }
function qcUseCourse() { el('qc-course').value = el('c-course').value; }

function qLimit() { return Number(el('qf-limit').value) || 10; }

function qPage(dir) {
  S.qSkip = Math.max(0, S.qSkip + dir * qLimit());
  loadQuestions();
}

async function loadQuestions() {
  const p = new URLSearchParams();
  if (el('qf-lesson').value) p.set('lessonId', el('qf-lesson').value);
  if (el('qf-course').value) p.set('courseId', el('qf-course').value);
  if (el('qf-title').value) p.set('title', el('qf-title').value);
  p.set('skip', S.qSkip);
  p.set('limit', el('qf-limit').value);
  const d = await call('GET', '/school/me/questions?' + p.toString());
  S.questions = pickArray(d);
  S.qTotal = d?.totalRecords ?? S.questions.length;
  renderQuestions();
}

function renderQuestions() {
  const tb = el('q-table').tBodies[0];
  tb.innerHTML = '';
  el('q-empty').style.display = S.questions.length ? 'none' : '';
  el('q-table').style.display = S.questions.length ? '' : 'none';
  const from = S.qTotal ? S.qSkip + 1 : 0;
  const to = S.qSkip + S.questions.length;
  el('q-pageinfo').textContent = `${from}–${to} of ${S.qTotal}`;
  S.questions.forEach((qu, i) => {
    const tr = tb.insertRow();
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.qid = qu.id;
    tr.insertCell().append(cb);
    tr.insertCell().textContent = qu.index ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = qu.title ?? '';
    tr.insertCell().textContent = qu.type ?? '';
    tr.insertCell().textContent = qu.purpose ?? '';
    tr.insertCell().append(
      miniBtn('Up', () => move(S.questions, i, -1, renderQuestions)),
      ' ', miniBtn('Down', () => move(S.questions, i, +1, renderQuestions)),
      ' ', miniBtn('View', () => call('GET', `/school/me/questions/${qu.id}`)),
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/questions/${qu.id}`, qu)),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/questions/${qu.id}`).then(loadQuestions), true),
    );
  });
}

async function saveQuestionOrder() {
  await call('POST', `/school/me/questions/order/${el('qf-lesson').value}`, {
    ids: S.questions.map(q => q.id),
  });
  loadQuestions();
}

async function bulkDeleteChecked() {
  const ids = [...document.querySelectorAll('#q-table input[type=checkbox]:checked')]
    .map(c => c.dataset.qid);
  await call('POST', '/school/me/questions/bulk-delete', { ids });
  loadQuestions();
}

function addOptRow() {
  const r = el('qc-opts').insertRow();
  r.innerHTML = `<td><input placeholder="option text" class="o-text" dir="auto"></td>
    <td><label><input type="checkbox" class="o-correct"> correct</label></td>`;
  r.insertCell().append(miniBtn('remove', () => r.remove()));
}

function addMatchRow() {
  const types = (S.meta?.questionMatchTypes || []).map(v => `<option>${v}</option>`).join('');
  const r = el('qc-matches').insertRow();
  r.innerHTML = `<td><input placeholder="item text" class="m-text" dir="auto"></td>
    <td><select class="m-type"><option value="">type — omit</option>${types}</select></td>
    <td><input placeholder="correctIndex" class="m-idx" style="width:100px"></td>`;
  r.insertCell().append(miniBtn('remove', () => r.remove()));
}

function collectQuestionBody() {
  const b = {};
  if (el('qc-title').value) b.title = el('qc-title').value;
  if (el('qc-type').value) b.type = el('qc-type').value;
  if (el('qc-purpose').value) b.purpose = el('qc-purpose').value;
  if (el('qc-lesson').value) b.lessonId = el('qc-lesson').value;
  if (el('qc-course').value) b.courseId = el('qc-course').value;
  const opts = [...el('qc-opts').rows].map(r => ({
    text: r.querySelector('.o-text').value,
    isCorrect: r.querySelector('.o-correct').checked,
  }));
  if (opts.length) b.options = opts;
  const matches = [...el('qc-matches').rows].map(r => {
    const m = { text: r.querySelector('.m-text').value };
    if (r.querySelector('.m-type').value) m.type = r.querySelector('.m-type').value;
    const idx = r.querySelector('.m-idx').value;
    if (idx !== '') m.correctIndex = Number(idx);
    return m;
  });
  if (matches.length) b.matchingItems = matches;
  return b;
}

async function createQuestion() {
  const body = collectQuestionBody();
  const file = el('qc-image').files[0];
  if (file) {
    // multipart: scalars as fields, arrays as JSON strings — whether the
    // backend accepts nested arrays this way is itself under test
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
    fd.append('image', file);
    await call('POST', '/school/me/questions', fd, { form: true });
  } else {
    await call('POST', '/school/me/questions', body);
  }
  loadQuestions();
}

async function bulkCreate() {
  await call('POST', '/school/me/questions/bulk', el('qb-json').value, { rawText: true });
  loadQuestions();
}

/* ================= daily challenge ================= */
async function dcGet() { renderDc(await call('GET', '/school/me/daily-challenge')); }
async function dcCreate() { await call('POST', '/school/me/daily-challenge'); dcGet(); }

function renderDc(d) {
  const box = el('dc-challenges');
  box.innerHTML = '';
  const challenges = d?.challenges || [];
  if (!challenges.length) {
    box.innerHTML =
      `<div class="empty">No challenges for today. “Build today” makes one per accessible track — a track is skipped when one of its courses has no questions left.</div>`;
  }
  for (const c of challenges) {
    const card = document.createElement('div');
    card.className = 'card';
    const qs = (c.usedQuestions || [])
      .map(u => `<li dir="auto">• ${escapeHtml(u.question?.title ?? u.question?.id ?? '?')}</li>`)
      .join('');
    card.innerHTML =
      `<h2 dir="auto">${escapeHtml(c.track?.name ?? 'unknown track')} — ${escapeHtml(c.date ?? '')}` +
      ` <span style="font-weight:400;font-size:12px;color:var(--mut)">${(c.usedQuestions || []).length} questions</span></h2>` +
      `<ul style="list-style:none;padding:0;margin:6px 0">${qs}</ul>`;
    box.append(card);
  }
  const tb = el('dc-report').tBodies[0];
  tb.innerHTML = '';
  const report = d?.unUsedQuestions || [];
  el('dc-empty').style.display = report.length ? 'none' : '';
  el('dc-report').style.display = report.length ? '' : 'none';
  for (const r of report) {
    const tr = tb.insertRow();
    if (r.remainingQuestions < 2) tr.className = 'warn';
    tr.innerHTML =
      `<td dir="auto">${escapeHtml(r.trackName ?? '')}</td>` +
      `<td dir="auto">${escapeHtml(r.courseName ?? '')}</td>` +
      `<td>${r.remainingQuestions}${r.remainingQuestions < 2 ? ' — restock!' : ''}</td>` +
      `<td class="mono" style="font-size:11px">${r.courseId ?? ''}</td>`;
  }
}

/* ================= books ================= */
async function loadBooks() {
  const books = pickArray(await call('GET', '/school/me/books'));
  const tb = el('b-table').tBodies[0];
  tb.innerHTML = '';
  el('b-empty').style.display = books.length ? 'none' : '';
  el('b-table').style.display = books.length ? '' : 'none';
  for (const b of books) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = b.name ?? '';
    const idc = tr.insertCell(); idc.className = 'mono'; idc.style.fontSize = '11px'; idc.textContent = b.id;
    tr.insertCell().append(
      miniBtn('edit', () => { el('be-id').value = b.id; el('be-name').value = b.name ?? ''; }),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/books/${b.id}`).then(loadBooks), true),
    );
  }
}

async function createBook() {
  const fd = new FormData();
  if (el('bc-name').value) fd.append('name', el('bc-name').value);
  const file = el('bc-image').files[0];
  if (file) fd.append('image', file);
  await call('POST', '/school/me/books', fd, { form: true });
  loadBooks();
}

async function editBook() {
  const fd = new FormData();
  if (el('be-name').value) fd.append('name', el('be-name').value);
  const file = el('be-image').files[0];
  if (file) fd.append('image', file);
  await call('PATCH', `/school/me/books/${el('be-id').value}`, fd, { form: true });
  loadBooks();
}

/* ================= my account ================= */
async function patchMine() {
  const file = el('me-image').files[0];
  if (file) {
    const fd = new FormData();
    if (el('me-name').value) fd.append('name', el('me-name').value);
    fd.append('image', file);
    await call('PATCH', '/user/mine', fd, { form: true });
  } else {
    const body = {};
    if (el('me-name').value) body.name = el('me-name').value;
    await call('PATCH', '/user/mine', body);
  }
}

/* ================= users (admin) ================= */
function uLimit() { return Number(el('uf-limit').value) || 10; }
function uPage(dir) {
  S.uSkip = Math.max(0, S.uSkip + dir * uLimit());
  loadUsers();
}

async function loadUsers() {
  const p = new URLSearchParams();
  if (el('uf-name').value) p.set('name', el('uf-name').value);
  if (el('uf-email').value) p.set('email', el('uf-email').value);
  p.set('skip', S.uSkip);
  p.set('limit', el('uf-limit').value);
  const d = await call('GET', '/user?' + p.toString());
  const users = pickArray(d);
  S.uTotal = d?.totalRecords ?? users.length;
  const from = S.uTotal ? S.uSkip + 1 : 0;
  el('u-pageinfo').textContent = `${from}–${S.uSkip + users.length} of ${S.uTotal}`;
  const tb = el('usr-table').tBodies[0];
  tb.innerHTML = '';
  el('usr-empty').style.display = users.length ? 'none' : '';
  el('usr-table').style.display = users.length ? '' : 'none';
  for (const u of users) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = u.name ?? '';
    tr.insertCell().textContent = u.email ?? '';
    tr.insertCell().textContent = u.role ?? '';
    tr.insertCell().append(
      miniBtn('View', () => call('GET', `/user/${u.id}`)),
      ' ', miniBtn('Edit…', () => promptPatch(`/user/${u.id}`, u)),
      ' ', miniBtn('Remove image', () => call('DELETE', `/user/${u.id}/image`), true),
    );
  }
}

async function createUser() {
  const body = {};
  if (el('uc-name').value) body.name = el('uc-name').value;
  if (el('uc-email').value) body.email = el('uc-email').value;
  if (el('uc-pass').value) body.password = el('uc-pass').value;
  await call('POST', '/user', body);
  loadUsers();
}

/* ================= access (admin) ================= */
async function admLoadSchools() {
  const d = await call('GET', '/school/manage');
  const schools = pickArray(d);
  const sel = el('adm-school');
  sel.length = 1;
  for (const s of schools) {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name || s.id;
    sel.add(o);
  }
}
async function admAllow() {
  await call('POST', `/learning/admin/schoolAccess/${el('adm-school').value}/${el('adm-track').value}`);
}
async function admUnAllow() {
  await call('DELETE', `/learning/admin/schoolAccess/${el('adm-school').value}/${el('adm-track').value}`);
}

/* ================= raw ================= */
async function rawSend() {
  const body = el('raw-body').value;
  await call(el('raw-method').value, el('raw-path').value,
    body === '' ? undefined : body, { rawText: true });
}

/* ================= wire up ================= */
mountAction('s-login', 'POST', '/auth/login', 'Sign in', doLogin);
mountAction('s-refresh', 'POST', '/auth/refreshToken', 'Refresh token', doRefresh);
mountAction('s-whoami', 'GET', '/user/mine', 'Who am I?', () => call('GET', '/user/mine'));
mountAction('s-reload', 'GET', '/learning/tracks', 'Reload tree', loadTracks);

mountAction('s-ucreate', 'POST', '/school/me/units', 'Create unit', createUnit);
mountAction('s-uorder', 'POST', '/school/me/units/order/:courseId', 'Save unit order', saveUnitOrder);
mountAction('s-lcreate', 'POST', '/school/me/lessons', 'Create lesson', createLesson);
mountAction('s-lorder', 'POST', '/school/me/lessons/order/:unitId', 'Save lesson order', saveLessonOrder);

mountAction('s-qload', 'GET', '/school/me/questions', 'Load questions', () => { S.qSkip = 0; loadQuestions(); });
mountAction('s-qorder', 'POST', '/school/me/questions/order/:lessonId', 'Save question order', saveQuestionOrder);
mountAction('s-qbulkdel', 'POST', '/school/me/questions/bulk-delete', 'Delete checked', bulkDeleteChecked);
mountAction('s-qcreate', 'POST', '/school/me/questions', 'Create question', createQuestion);
mountAction('s-qbulk', 'POST', '/school/me/questions/bulk', 'Create batch', bulkCreate);

mountAction('s-dcget', 'GET', '/school/me/daily-challenge', 'Fetch today', dcGet);
mountAction('s-dcpost', 'POST', '/school/me/daily-challenge', 'Build today', dcCreate);

mountAction('s-bload', 'GET', '/school/me/books', 'Load books', loadBooks);
mountAction('s-bcreate', 'POST', '/school/me/books', 'Create book', createBook);
mountAction('s-bedit', 'PATCH', '/school/me/books/:id', 'Save book', editBook);

mountAction('s-mine', 'GET', '/user/mine', 'Fetch my profile', () => call('GET', '/user/mine'));
mountAction('s-umeta', 'GET', '/user/metaData', 'Roles list', () => call('GET', '/user/metaData'));
mountAction('s-mepatch', 'PATCH', '/user/mine', 'Update name / image', patchMine);
mountAction('s-medelimg', 'DELETE', '/user/mine/image', 'Remove my image', () => call('DELETE', '/user/mine/image'));
mountAction('s-mecomplete', 'POST', '/user/mine/complete-profile', 'Complete profile', () =>
  call('POST', '/user/mine/complete-profile', {
    ...(el('me-cname').value ? { name: el('me-cname').value } : {}),
    ...(el('me-cpass').value ? { password: el('me-cpass').value } : {}),
  }));
mountAction('s-reqverify', 'POST', '/user/mine/request-verify', 'Send verify code', () =>
  call('POST', '/user/mine/request-verify'));
mountAction('s-verify', 'POST', '/user/mine/verify', 'Verify', () =>
  call('POST', '/user/mine/verify', el('me-code').value ? { code: el('me-code').value } : {}));
mountAction('s-forget', 'POST', '/user/mine/forget-password', 'Send reset code', () =>
  call('POST', '/user/mine/forget-password', el('fp-email').value ? { email: el('fp-email').value } : {}));
mountAction('s-reset', 'POST', '/user/mine/reset-password', 'Reset password', () =>
  call('POST', '/user/mine/reset-password', {
    ...(el('rp-email').value ? { email: el('rp-email').value } : {}),
    ...(el('rp-code').value ? { code: el('rp-code').value } : {}),
    ...(el('rp-pass').value
      ? { newPassword: el('rp-pass').value, confirmPassword: el('rp-pass').value }
      : {}),
  }));

mountAction('s-uload', 'GET', '/user', 'Load users', () => { S.uSkip = 0; loadUsers(); });
mountAction('s-ucreateuser', 'POST', '/user', 'Create user', createUser);

mountAction('s-admschools', 'GET', '/school/manage', 'Load schools', admLoadSchools);
mountAction('s-admallow', 'POST', '/learning/admin/schoolAccess/:schoolId/:trackId', 'Grant access', admAllow);
mountAction('s-admrevoke', 'DELETE', '/learning/admin/schoolAccess/:schoolId/:trackId', 'Revoke access', admUnAllow);

el('c-track').onchange = onTrack;
el('c-course').onchange = onCourse;
el('c-unit').onchange = onUnit;
el('c-lesson').onchange = onLesson;

/* ================= boot ================= */
el('a-env').value = ENV;
el('a-env').onchange = (e) => setEnv(e.target.value);
resetChainFrom('c-course');
renderQuestions();
fillChain(el('c-track'), [], 'sign in first');
el('a-email').value = localStorage.getItem('email') || 'content@hul.com';
el('a-pass').value = localStorage.getItem('pw') || '';
if (localStorage.getItem('tk')) {
  setStatus('token in storage — tree loading', true);
  loadMeta().then(loadTracks);
}
