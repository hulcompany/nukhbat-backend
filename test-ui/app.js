/* nukhba API bench — manual test console for every controller in src/.
   Deliberately NO client-side validation: requests go out exactly as
   typed so the backend's validation is what gets exercised. Empty inputs
   are omitted; the Raw panel covers explicit garbage/empty/malformed.

   Sessions are stored per environment (local / prod) so you can keep an
   admin, an owner and a couple of students signed in at once and hop
   between them with the header chips. */

const ENVS = {
  local: { label: 'local — localhost:3000', base: 'http://localhost:3000/api' },
  prod: { label: 'prod — alnokhba-app.com', base: 'https://alnokhba-app.com/api' },
};
let ENV = ENVS[localStorage.getItem('nk.env')] ? localStorage.getItem('nk.env') : 'local';
let API = ENVS[ENV].base;

/* role → sidebar group. contentWriter owns the school workspace. */
const ROLE_GROUP = { admin: 'admin', contentWriter: 'owner', student: 'student' };
const HOME_PANEL = { admin: 'users', contentWriter: 'tree', student: 'student' };

const TRACK_SELECTS = ['st-track', 'ac-track', 'ab-track', 'kb-track', 'as-track', 'ok-track', 'os-track'];
const SCHOOL_SELECTS = ['ac-school', 'ab-school', 'kb-school', 'as-school'];

const S = {
  meta: null,
  units: [], lessons: [], questions: [], wisements: [],
  qSkip: 0, qTotal: 0,
  uSkip: 0, uTotal: 0,
  wSkip: 0, wTotal: 0,
  abQSkip: 0, abQTotal: 0,
  okSkip: 0, okTotal: 0,
  osSkip: 0, osTotal: 0,
  kaSkip: 0, kaTotal: 0,
  sbSkip: 0, sbTotal: 0,
  asSkip: 0, asTotal: 0,
  smSkip: 0, smTotal: 0,
};

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/* ================= sessions ================= */
function accounts() {
  try { return JSON.parse(localStorage.getItem(`nk.accounts.${ENV}`)) || []; }
  catch { return []; }
}
function saveAccounts(list) {
  localStorage.setItem(`nk.accounts.${ENV}`, JSON.stringify(list));
}
function currentAccount() {
  const email = localStorage.getItem(`nk.current.${ENV}`);
  return accounts().find(a => a.email === email) || null;
}
function setCurrent(email) {
  if (email) localStorage.setItem(`nk.current.${ENV}`, email);
  else localStorage.removeItem(`nk.current.${ENV}`);
}
function upsertAccount(patch) {
  const list = accounts();
  const i = list.findIndex(a => a.email === patch.email);
  if (i >= 0) list[i] = { ...list[i], ...patch };
  else list.push(patch);
  saveAccounts(list);
}
function forgetAccount(email) {
  saveAccounts(accounts().filter(a => a.email !== email));
  if (currentAccount() === null) setCurrent(null);
  renderSession();
}

/* ================= log ================= */
function logEntry(method, path, status, body) {
  const log = el('log');
  const e = document.createElement('div');
  e.className = 'entry';
  const sClass = typeof status === 'number' ? 's' + String(status)[0] : 'sX';
  const when = new Date().toLocaleTimeString();
  const who = currentAccount()?.email || 'anon';
  e.innerHTML =
    `<div class="head"><span class="chip ${method}">${method}</span>` +
    `<span>${escapeHtml(path)}</span>` +
    `<span class="chip ${sClass}">${status}</span>` +
    `<span class="t">${escapeHtml(who)} · ${when}</span></div>` +
    `<pre>${escapeHtml(typeof body === 'string' ? body : JSON.stringify(body, null, 2))}</pre>`;
  e.querySelector('.head').onclick = () => e.classList.toggle('open');
  if (typeof status !== 'number' || status >= 400) e.classList.add('open');
  log.prepend(e);
  while (log.children.length > 60) log.lastChild.remove();
}

/* ================= fetch core ================= */
async function call(method, path, body, opts = {}) {
  const headers = {};
  const tk = currentAccount()?.tk;
  if (tk && !opts.noAuth) headers['Authorization'] = 'Bearer ' + tk;
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
  el('picker').classList.toggle('show', ['tree', 'questions', 'dc'].includes(name));
}

function fillSelect(sel, items, placeholder) {
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
}

function move(arr, i, delta, rerender) {
  const j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  rerender();
}

function promptPatch(path, current, after) {
  const seed = JSON.stringify({ title: current.title ?? current.name });
  const body = prompt(`PATCH ${path}\nJSON body — sent exactly as typed:`, seed);
  if (body === null) return;
  const p = call('PATCH', path, body, { rawText: true });
  if (after) p.then(after).catch(() => {});
}

function pageInfo(spanId, skip, count, total) {
  el(spanId).textContent = `${total ? skip + 1 : 0}–${skip + count} of ${total}`;
}

function showTable(tableId, emptyId, hasRows) {
  el(emptyId).style.display = hasRows ? 'none' : '';
  el(tableId).style.display = hasRows ? '' : 'none';
}

/* ================= env & role chrome ================= */
function setEnv(name) {
  if (!ENVS[name] || name === ENV) return;
  ENV = name;
  API = ENVS[name].base;
  localStorage.setItem('nk.env', name);
  applyEnv();
  applyRole();
  renderSession();
  resetChainFrom('pk-course');
  fillSelect(el('pk-track'), [], 'sign in first');
  if (currentAccount()) bootRefs();
}

function applyEnv() {
  document.body.classList.toggle('prod', ENV === 'prod');
  el('log-base').textContent = API;
  el('acc-envtag').textContent = `stored for ${ENV}`;
}

function applyRole() {
  const acc = currentAccount();
  const role = acc?.role || '';
  document.body.dataset.role = role;
  const st = el('h-status');
  st.textContent = acc ? `${acc.email} · ${acc.role || '?'}` : 'signed out';
  st.className = acc ? 'in' : '';
  const group = ROLE_GROUP[role];
  document.querySelectorAll('#side button[data-need]').forEach(b => {
    const need = b.dataset.need;
    const off = !!acc && !!need && need !== group;
    b.classList.toggle('off', off);
    b.title = off ? 'different role — expect 403 (that is a valid test)' : '';
  });
}

function renderSession() {
  const list = accounts();
  const cur = currentAccount();
  // header chips
  const box = el('h-accounts');
  box.replaceChildren(...list.map(a => {
    const c = document.createElement('button');
    c.className = 'chip-acc' + (cur && a.email === cur.email ? ' on' : '');
    c.title = a.role || 'role unknown';
    c.innerHTML = `<span class="dot r-${a.role || 'x'}"></span>${escapeHtml(a.email.split('@')[0])}`;
    c.onclick = () => switchTo(a.email);
    return c;
  }));
  // session table
  const tb = el('acc-table').tBodies[0];
  tb.innerHTML = '';
  showTable('acc-table', 'acc-empty', list.length);
  for (const a of list) {
    const tr = tb.insertRow();
    if (cur && a.email === cur.email) tr.className = 'ok';
    tr.insertCell().textContent = a.email;
    tr.insertCell().innerHTML = a.role
      ? `<span class="rolebadge r-${a.role}">${escapeHtml(a.role)}</span>` : '?';
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = a.name ?? '';
    tr.insertCell().append(
      miniBtn('switch', () => switchTo(a.email)),
      ' ', miniBtn('forget', () => { forgetAccount(a.email); applyRole(); }, true),
    );
  }
}

function switchTo(email) {
  setCurrent(email);
  applyRole();
  renderSession();
  bootRefs();
  const home = HOME_PANEL[currentAccount()?.role];
  if (home) panel(home);
}

/* ================= auth ================= */
function preset(email) {
  el('se-email').value = email;
  el('se-pass').focus();
}

async function whoamiInto(email) {
  try {
    const me = await call('GET', '/user/mine');
    upsertAccount({ email, role: me.role, name: me.name });
  } catch { /* in the log */ }
}

async function doLogin() {
  const email = el('se-email').value;
  const d = await call('POST', '/auth/login', {
    email, password: el('se-pass').value,
  }, { noAuth: true });
  upsertAccount({ email, password: el('se-pass').value, tk: d.accessToken || '', rtk: d.refreshToken || '' });
  setCurrent(email);
  await whoamiInto(email);
  applyRole();
  renderSession();
  bootRefs();
  const home = HOME_PANEL[currentAccount()?.role];
  if (home) panel(home);
}

// signup may or may not return tokens — only store them when present
async function doSignup() {
  const email = el('se-email').value;
  const d = await call('POST', '/auth/signUp', { email }, { noAuth: true });
  upsertAccount({ email, tk: d?.accessToken || '', rtk: d?.refreshToken || '' });
  if (d?.accessToken) {
    setCurrent(email);
    await whoamiInto(email);
  }
  applyRole();
  renderSession();
}

async function doRefresh() {
  const acc = currentAccount();
  if (!acc) return;
  const d = await call('POST', '/auth/refreshToken', { token: acc.rtk }, { noAuth: true });
  upsertAccount({ email: acc.email, tk: d.accessToken || '', rtk: d.refreshToken || '' });
}

function doLogout() {
  const acc = currentAccount();
  if (acc) forgetAccount(acc.email);
  setCurrent(null);
  applyRole();
  renderSession();
}

/* ================= reference data ================= */
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

// tracks into every track select; schools into every school select (admin only)
async function reloadRefs() {
  let tracks = [];
  try { tracks = pickArray(await call('GET', '/learning/tracks')); } catch { /* in the log */ }
  for (const id of TRACK_SELECTS) {
    const keep = el(id).options[0].textContent;
    fillSelect(el(id), tracks, keep);
  }
  fillSelect(el('pk-track'), tracks, tracks.length ? 'choose a track…' : 'no tracks');
  resetChainFrom('pk-course');
  el('pk-hint').textContent = '';
  if (currentAccount()?.role === 'admin') {
    try {
      const schools = pickArray(await call('GET', '/school/manage?skip=0&limit=100'));
      for (const id of SCHOOL_SELECTS) {
        const keep = el(id).options[0].textContent;
        fillSelect(el(id), schools, keep);
      }
    } catch { /* in the log */ }
  }
}

function bootRefs() {
  loadMeta();
  reloadRefs();
}

/* ================= content path (owner cascade) ================= */
function resetChainFrom(level) {
  const order = ['pk-course', 'pk-unit', 'pk-lesson'];
  for (let i = order.indexOf(level); i >= 0 && i < order.length; i++) {
    fillSelect(el(order[i]), [], '—');
    el(order[i]).disabled = true;
  }
  if (level === 'pk-course' || level === 'pk-unit') { S.lessons = []; renderLessons(); }
  if (level === 'pk-course') { S.units = []; renderUnits(); }
}

async function onTrack() {
  resetChainFrom('pk-course');
  const trackId = el('pk-track').value;
  if (!trackId) return;
  const courses = pickArray(await call('GET', `/school/me/courses/${trackId}`));
  fillSelect(el('pk-course'), courses, courses.length ? 'choose a course…' : 'no courses');
  el('pk-course').disabled = false;
}

async function onCourse() {
  resetChainFrom('pk-unit');
  const courseId = el('pk-course').value;
  if (!courseId) return;
  S.units = pickArray(await call('GET', `/school/me/units/${courseId}`));
  renderUnits();
  fillSelect(el('pk-unit'), S.units, S.units.length ? 'choose a unit…' : 'no units');
  el('pk-unit').disabled = false;
}

async function onUnit() {
  resetChainFrom('pk-lesson');
  const unitId = el('pk-unit').value;
  if (!unitId) return;
  S.lessons = pickArray(await call('GET', `/school/me/lessons/${unitId}`));
  renderLessons();
  fillSelect(el('pk-lesson'), S.lessons, S.lessons.length ? 'choose a lesson…' : 'no lessons');
  el('pk-lesson').disabled = false;
}

async function onLesson() {
  const lessonId = el('pk-lesson').value;
  if (!lessonId) return;
  el('qf-lesson').value = lessonId;
  el('qf-course').value = '';
  panel('questions');
  S.qSkip = 0;
  await loadQuestions();
}

/* ================= units & lessons (owner) ================= */
function renderUnits() {
  const tb = el('u-table').tBodies[0];
  tb.innerHTML = '';
  showTable('u-table', 'u-empty', S.units.length);
  S.units.forEach((u, i) => {
    const tr = tb.insertRow();
    tr.innerHTML = `<td>${u.index ?? ''}</td><td dir="auto">${escapeHtml(u.title ?? '')}</td>`;
    tr.insertCell().append(
      miniBtn('Up', () => move(S.units, i, -1, renderUnits)),
      ' ', miniBtn('Down', () => move(S.units, i, +1, renderUnits)),
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/units/${u.id}`, u, onCourse)),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/units/${u.id}`).then(onCourse), true),
    );
  });
}

async function createUnit() {
  const body = {};
  if (el('u-title').value) body.title = el('u-title').value;
  if (el('pk-course').value) body.courseId = el('pk-course').value;
  await call('POST', '/school/me/units', body);
  onCourse();
}

async function saveUnitOrder() {
  await call('POST', `/school/me/units/order/${el('pk-course').value}`, {
    ids: S.units.map(u => u.id),
  });
  onCourse();
}

function renderLessons() {
  const tb = el('l-table').tBodies[0];
  tb.innerHTML = '';
  showTable('l-table', 'l-empty', S.lessons.length);
  S.lessons.forEach((l, i) => {
    const tr = tb.insertRow();
    tr.innerHTML = `<td>${l.index ?? ''}</td><td dir="auto">${escapeHtml(l.title ?? '')}</td>` +
      `<td>${escapeHtml(l.status ?? '')}</td>`;
    tr.insertCell().append(
      miniBtn('Up', () => move(S.lessons, i, -1, renderLessons)),
      ' ', miniBtn('Down', () => move(S.lessons, i, +1, renderLessons)),
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/lessons/${l.id}`, l, onUnit)),
      ' ', miniBtn('Delete', () => call('DELETE', `/school/me/lessons/${l.id}`).then(onUnit), true),
    );
  });
}

async function createLesson() {
  const body = {};
  if (el('l-title').value) body.title = el('l-title').value;
  if (el('l-desc').value) body.description = el('l-desc').value;
  if (el('pk-unit').value) body.unitId = el('pk-unit').value;
  await call('POST', '/school/me/lessons', body);
  onUnit();
}

async function saveLessonOrder() {
  await call('POST', `/school/me/lessons/order/${el('pk-unit').value}`, {
    ids: S.lessons.map(l => l.id),
  });
  onUnit();
}

/* ================= questions (owner) ================= */
function useSelectedLesson() {
  el('qf-lesson').value = el('pk-lesson').value;
  el('qf-course').value = '';
  S.qSkip = 0;
  loadQuestions();
}
function useSelectedCourse() {
  el('qf-course').value = el('pk-course').value;
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
function qcUseLesson() { el('qc-lesson').value = el('pk-lesson').value; }
function qcUseCourse() { el('qc-course').value = el('pk-course').value; }

function qPage(dir) {
  S.qSkip = Math.max(0, S.qSkip + dir * (Number(el('qf-limit').value) || 10));
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
  showTable('q-table', 'q-empty', S.questions.length);
  pageInfo('q-pageinfo', S.qSkip, S.questions.length, S.qTotal);
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
      ' ', miniBtn('Edit…', () => promptPatch(`/school/me/questions/${qu.id}`, qu, loadQuestions)),
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

/* ================= daily challenge (owner) ================= */
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
      ` <span class="tag">${(c.usedQuestions || []).length} questions</span></h2>` +
      `<ul style="list-style:none;padding:0;margin:6px 0">${qs}</ul>`;
    box.append(card);
  }
  const tb = el('dc-report').tBodies[0];
  tb.innerHTML = '';
  const report = d?.unUsedQuestions || [];
  showTable('dc-report', 'dc-empty', report.length);
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

/* ================= books (owner) ================= */
async function loadBooks() {
  const books = pickArray(await call('GET', '/school/me/books'));
  const tb = el('b-table').tBodies[0];
  tb.innerHTML = '';
  showTable('b-table', 'b-empty', books.length);
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
  if (file) fd.append('attachment', file);
  await call('POST', '/school/me/books', fd, { form: true });
  loadBooks();
}

async function editBook() {
  const fd = new FormData();
  if (el('be-name').value) fd.append('name', el('be-name').value);
  const file = el('be-image').files[0];
  if (file) fd.append('attachment', file);
  await call('PATCH', `/school/me/books/${el('be-id').value}`, fd, { form: true });
  loadBooks();
}

/* ================= my school (owner) ================= */
async function scGet() {
  const box = el('sc-box');
  let d;
  try { d = await call('GET', '/school/me'); }
  catch { box.className = 'empty'; box.textContent = 'no school — the error is in the log'; return; }
  box.className = 'card';
  box.style.marginBottom = '0';
  box.innerHTML =
    `<div dir="auto" style="font-size:15px"><b>${escapeHtml(d.name ?? '')}</b></div>` +
    (d.image?.id ? `<div style="margin-top:4px"><a href="${API}/files/${d.image.id}" target="_blank">logo file</a></div>` : '') +
    `<div class="mono" style="font-size:11px;color:var(--mut);margin-top:6px">${d.id ?? ''}</div>`;
}

async function scEdit() {
  const fd = new FormData();
  if (el('sc-name').value) fd.append('name', el('sc-name').value);
  const file = el('sc-image').files[0];
  if (file) fd.append('image', file);
  await call('PATCH', '/school/me', fd, { form: true });
  scGet();
}

/* ================= student ================= */
async function stProfile() {
  const box = el('st-profile');
  let d;
  try {
    d = await call('GET', '/student/profile');
  } catch {
    box.className = 'empty';
    box.textContent = 'no profile — the error is in the log (student role + a redeemed key or trial required)';
    return;
  }
  const inactive = d.active === false
    ? '<div style="margin-top:4px;color:#c0392b">deactivated — the school must reactivate you</div>'
    : '';
  box.className = 'card';
  box.style.marginBottom = '0';
  box.innerHTML =
    `<div dir="auto" style="font-size:15px"><b>${escapeHtml(d.school?.name ?? d.schoolId ?? '')}</b>` +
    ` — ${escapeHtml(d.track?.name ?? d.trackId ?? '')}</div>` +
    inactive +
    `<div class="mono" style="font-size:11px;color:var(--mut);margin-top:6px">${d.id}</div>`;
}

async function stSub() {
  const box = el('st-sub');
  let d;
  try {
    d = await call('GET', '/subscription/me');
  } catch {
    box.className = 'empty';
    box.textContent = 'no subscription — the error is in the log';
    return;
  }
  if (!d) {
    box.className = 'empty';
    box.textContent = 'null — this student never subscribed';
    return;
  }
  const expired = d.isExpired ? ' <span style="color:#c0392b">(expired)</span>' : ' <span style="color:#27ae60">(live)</span>';
  box.className = 'card';
  box.style.marginBottom = '0';
  box.innerHTML =
    `<div style="font-size:15px"><b>${escapeHtml(d.type ?? '')}</b>` +
    ` — expires <b>${(d.expireDate || '').slice(0, 10)}</b>${expired}</div>` +
    `<div class="mono" style="font-size:11px;color:var(--mut);margin-top:6px">${d.id ?? ''}</div>`;
}

async function stRedeem() {
  const body = {};
  if (el('st-key').value) body.key = el('st-key').value;
  await call('POST', '/subscription/subscribe', body);
  stProfile();
  stSub();
}

async function stTrial() {
  const body = {};
  if (el('st-track').value) body.trackId = el('st-track').value;
  await call('POST', '/subscription/freeTrial', body);
  stProfile();
  stSub();
}

/* ================= my keys (owner) ================= */
function okPage(dir) {
  S.okSkip = Math.max(0, S.okSkip + dir * (Number(el('ok-limit').value) || 10));
  okLoad();
}

async function okLoad() {
  const p = new URLSearchParams();
  if (el('ok-track').value) p.set('trackId', el('ok-track').value);
  p.set('skip', S.okSkip);
  p.set('limit', el('ok-limit').value);
  const d = await call('GET', '/subscription/keys/school?' + p.toString());
  const list = pickArray(d);
  S.okTotal = d?.totalRecords ?? list.length;
  pageInfo('ok-pageinfo', S.okSkip, list.length, S.okTotal);
  const tb = el('ok-table').tBodies[0];
  tb.innerHTML = '';
  showTable('ok-table', 'ok-empty', list.length);
  for (const k of list) {
    const tr = tb.insertRow();
    const c = tr.insertCell(); c.className = 'mono'; c.textContent = k.key ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = k.track?.name ?? '';
    tr.insertCell().textContent = k.usedById || k.usedBy ? '✓' : '';
    tr.insertCell().textContent = (k.createdAt || '').slice(0, 10);
    tr.insertCell().append(
      miniBtn('use', () => { el('st-key').value = k.key; }),
    );
  }
}

/* ================= my students (owner) ================= */
// active=false is what StudentGuard blocks on (Student_2)
function activeCell(tr, p) {
  const c = tr.insertCell();
  if (p.active === false) { c.style.color = '#c0392b'; c.textContent = '✕ off'; }
  else { c.style.color = '#27ae60'; c.textContent = '✓ on'; }
}

function osPage(dir) {
  S.osSkip = Math.max(0, S.osSkip + dir * (Number(el('os-limit').value) || 10));
  osLoad();
}

async function osLoad() {
  const p = new URLSearchParams();
  if (el('os-track').value) p.set('trackId', el('os-track').value);
  if (el('os-name').value) p.set('name', el('os-name').value);
  p.set('skip', S.osSkip);
  p.set('limit', el('os-limit').value);
  const d = await call('GET', '/student/school?' + p.toString());
  const list = pickArray(d);
  S.osTotal = d?.totalRecords ?? list.length;
  pageInfo('os-pageinfo', S.osSkip, list.length, S.osTotal);
  const tb = el('os-table').tBodies[0];
  tb.innerHTML = '';
  showTable('os-table', 'os-empty', list.length);
  for (const s of list) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = s.user?.name ?? '';
    tr.insertCell().textContent = s.user?.email ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = s.track?.name ?? '';
    activeCell(tr, s);
    const off = s.active === false;
    tr.insertCell().append(
      miniBtn('view', () => call('GET', `/student/school/${s.id}`)),
      ' ', miniBtn(off ? 'Activate' : 'Deactivate',
        () => call('PATCH', `/student/school/activation/${s.id}`, { active: off }).then(osLoad),
        !off),
    );
  }
}

/* ================= users (admin) ================= */
function uPage(dir) {
  S.uSkip = Math.max(0, S.uSkip + dir * (Number(el('uf-limit').value) || 10));
  loadUsers();
}

async function loadUsers() {
  const p = new URLSearchParams();
  if (el('uf-name').value) p.set('name', el('uf-name').value);
  if (el('uf-email').value) p.set('email', el('uf-email').value);
  if (el('uf-phone').value) p.set('phoneNumber', el('uf-phone').value);
  if (el('uf-role').value) p.set('role', el('uf-role').value);
  p.set('skip', S.uSkip);
  p.set('limit', el('uf-limit').value);
  const d = await call('GET', '/user?' + p.toString());
  const users = pickArray(d);
  S.uTotal = d?.totalRecords ?? users.length;
  pageInfo('u-pageinfo', S.uSkip, users.length, S.uTotal);
  const tb = el('usr-table').tBodies[0];
  tb.innerHTML = '';
  showTable('usr-table', 'usr-empty', users.length);
  for (const u of users) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = u.name ?? '';
    tr.insertCell().textContent = u.email ?? '';
    tr.insertCell().textContent = u.phoneNumber ?? '';
    tr.insertCell().innerHTML = u.role
      ? `<span class="rolebadge r-${u.role}">${escapeHtml(u.role)}</span>` : '';
    tr.insertCell().append(
      miniBtn('View', () => call('GET', `/user/${u.id}`)),
      ' ', miniBtn('Edit…', () => promptPatch(`/user/${u.id}`, u, loadUsers)),
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

/* ================= schools (admin) ================= */
function smPage(dir) {
  S.smSkip = Math.max(0, S.smSkip + dir * (Number(el('sm-limit').value) || 10));
  smLoad();
}

async function smLoad() {
  const p = new URLSearchParams();
  if (el('sm-name').value) p.set('name', el('sm-name').value);
  p.set('skip', S.smSkip);
  p.set('limit', el('sm-limit').value);
  const d = await call('GET', '/school/manage?' + p.toString());
  const list = pickArray(d);
  S.smTotal = d?.totalRecords ?? list.length;
  pageInfo('sm-pageinfo', S.smSkip, list.length, S.smTotal);
  const tb = el('sm-table').tBodies[0];
  tb.innerHTML = '';
  showTable('sm-table', 'sm-empty', list.length);
  for (const s of list) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto';
    n.textContent = (s.name ?? '') + (s.default ? ' (default)' : '');
    const idc = tr.insertCell(); idc.className = 'mono'; idc.style.fontSize = '11px'; idc.textContent = s.id;
    tr.insertCell().append(
      miniBtn('view', () => call('GET', `/school/manage/${s.id}`)),
      ' ', miniBtn('edit', () => { el('sme-id').value = s.id; el('sme-name').value = s.name ?? ''; }),
      ' ', miniBtn('Remove image', () => call('DELETE', `/school/manage/${s.id}/image`), true),
    );
  }
}

async function smCreate() {
  const fd = new FormData();
  if (el('smc-name').value) fd.append('name', el('smc-name').value);
  if (el('smc-email').value) fd.append('email', el('smc-email').value);
  if (el('smc-pass').value) fd.append('password', el('smc-pass').value);
  if (el('smc-school').value) fd.append('schoolName', el('smc-school').value);
  const file = el('smc-image').files[0];
  if (file) fd.append('image', file);
  await call('POST', '/school/manage', fd, { form: true });
  smLoad();
}

async function smEdit() {
  const fd = new FormData();
  if (el('sme-name').value) fd.append('name', el('sme-name').value);
  const file = el('sme-image').files[0];
  if (file) fd.append('image', file);
  await call('PATCH', `/school/manage/${el('sme-id').value}`, fd, { form: true });
  smLoad();
}

/* ================= track access (admin) ================= */
async function acAllow() {
  await call('POST', `/learning/admin/schoolAccess/${el('ac-school').value}/${el('ac-track').value}`);
}
async function acRevoke() {
  await call('DELETE', `/learning/admin/schoolAccess/${el('ac-school').value}/${el('ac-track').value}`);
}

/* ================= admin content browse ================= */
async function abCourses() {
  const p = new URLSearchParams();
  if (el('ab-ctitle').value) p.set('title', el('ab-ctitle').value);
  if (el('ab-track').value) p.set('trackId', el('ab-track').value);
  const list = pickArray(await call('GET', '/learning/admin/courses?' + p.toString()));
  const tb = el('ab-ctable').tBodies[0];
  tb.innerHTML = '';
  showTable('ab-ctable', 'ab-cempty', list.length);
  for (const c of list) {
    const tr = tb.insertRow();
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = c.title ?? '';
    const tk = tr.insertCell(); tk.dir = 'auto'; tk.textContent = c.track?.name ?? '';
    tr.insertCell().append(
      miniBtn('units', () => { el('ab-ucourse').value = c.id; abUnits(); }),
      ' ', miniBtn('lessons', () => { el('ab-lcourse').value = c.id; el('ab-lunit').value = ''; abLessons(); }),
      ' ', miniBtn('pool qs', () => { el('ab-qcourse').value = c.id; el('ab-qlesson').value = ''; S.abQSkip = 0; abQuestions(); }),
    );
  }
}

async function abUnits() {
  const p = new URLSearchParams();
  if (el('ab-school').value) p.set('schoolId', el('ab-school').value);
  if (el('ab-utitle').value) p.set('title', el('ab-utitle').value);
  if (el('ab-ucourse').value) p.set('courseId', el('ab-ucourse').value);
  if (el('ab-track').value) p.set('trackId', el('ab-track').value);
  const list = pickArray(await call('GET', '/learning/admin/units?' + p.toString()));
  const tb = el('ab-utable').tBodies[0];
  tb.innerHTML = '';
  showTable('ab-utable', 'ab-uempty', list.length);
  for (const u of list) {
    const tr = tb.insertRow();
    tr.insertCell().textContent = u.index ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = u.title ?? '';
    const s = tr.insertCell(); s.dir = 'auto'; s.textContent = u.school?.name ?? '';
    tr.insertCell().append(
      miniBtn('lessons', () => { el('ab-lunit').value = u.id; el('ab-lcourse').value = ''; abLessons(); }),
    );
  }
}

async function abLessons() {
  const p = new URLSearchParams();
  if (el('ab-lunit').value) p.set('unitId', el('ab-lunit').value);
  if (el('ab-lcourse').value) p.set('courseId', el('ab-lcourse').value);
  if (el('ab-school').value) p.set('schoolId', el('ab-school').value);
  if (el('ab-ltitle').value) p.set('title', el('ab-ltitle').value);
  if (el('ab-track').value) p.set('trackId', el('ab-track').value);
  const list = pickArray(await call('GET', '/learning/admin/lessons?' + p.toString()));
  const tb = el('ab-ltable').tBodies[0];
  tb.innerHTML = '';
  showTable('ab-ltable', 'ab-lempty', list.length);
  for (const l of list) {
    const tr = tb.insertRow();
    tr.insertCell().textContent = l.index ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = l.title ?? '';
    tr.insertCell().textContent = l.status ?? '';
    tr.insertCell().textContent = l.questionCount ?? '';
    const s = tr.insertCell(); s.dir = 'auto'; s.textContent = l.school?.name ?? '';
    tr.insertCell().append(
      miniBtn('questions', () => { el('ab-qlesson').value = l.id; el('ab-qcourse').value = ''; S.abQSkip = 0; abQuestions(); }),
    );
  }
}

function abQPage(dir) {
  S.abQSkip = Math.max(0, S.abQSkip + dir * (Number(el('ab-qlimit').value) || 10));
  abQuestions();
}

async function abQuestions() {
  const p = new URLSearchParams();
  if (el('ab-qlesson').value) p.set('lessonId', el('ab-qlesson').value);
  if (el('ab-qcourse').value) p.set('courseId', el('ab-qcourse').value);
  if (el('ab-school').value) p.set('schoolId', el('ab-school').value);
  if (el('ab-qtitle').value) p.set('title', el('ab-qtitle').value);
  if (el('ab-track').value) p.set('trackId', el('ab-track').value);
  p.set('skip', S.abQSkip);
  p.set('limit', el('ab-qlimit').value);
  const d = await call('GET', '/learning/admin/questions?' + p.toString());
  const list = pickArray(d);
  S.abQTotal = d?.totalRecords ?? list.length;
  pageInfo('ab-qpageinfo', S.abQSkip, list.length, S.abQTotal);
  const tb = el('ab-qtable').tBodies[0];
  tb.innerHTML = '';
  showTable('ab-qtable', 'ab-qempty', list.length);
  for (const q of list) {
    const tr = tb.insertRow();
    tr.insertCell().textContent = q.index ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = q.title ?? '';
    tr.insertCell().textContent = q.type ?? '';
    tr.insertCell().textContent = q.purpose ?? '';
  }
}

/* ================= keys (admin) ================= */
async function kMint() {
  const body = {};
  if (el('kb-track').value) body.trackId = el('kb-track').value;
  if (el('kb-school').value) body.schoolId = el('kb-school').value;
  if (el('kb-count').value) body.count = Number(el('kb-count').value);
  await call('POST', '/subscription/keys', body);
  S.kaSkip = 0;
  kaLoad();
}

function kaPage(dir) {
  S.kaSkip = Math.max(0, S.kaSkip + dir * (Number(el('ka-limit').value) || 10));
  kaLoad();
}

async function kaLoad() {
  const p = new URLSearchParams();
  if (el('kb-track').value) p.set('trackId', el('kb-track').value);
  if (el('kb-school').value) p.set('schoolId', el('kb-school').value);
  p.set('skip', S.kaSkip);
  p.set('limit', el('ka-limit').value);
  const d = await call('GET', '/subscription/keys?' + p.toString());
  const list = pickArray(d);
  S.kaTotal = d?.totalRecords ?? list.length;
  pageInfo('ka-pageinfo', S.kaSkip, list.length, S.kaTotal);
  const tb = el('ka-table').tBodies[0];
  tb.innerHTML = '';
  showTable('ka-table', 'ka-empty', list.length);
  for (const k of list) {
    const tr = tb.insertRow();
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.kid = k.id;
    tr.insertCell().append(cb);
    const c = tr.insertCell(); c.className = 'mono'; c.textContent = k.key ?? '';
    const s = tr.insertCell(); s.dir = 'auto'; s.textContent = k.school?.name ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = k.track?.name ?? '';
    tr.insertCell().textContent = k.usedById || k.usedBy ? '✓' : '';
    tr.insertCell().textContent = (k.createdAt || '').slice(0, 10);
    tr.insertCell().append(
      miniBtn('use', () => { el('st-key').value = k.key; }),
      ' ', miniBtn('Delete', () => call('DELETE', `/subscription/keys/${k.id}`).then(kaLoad), true),
    );
  }
}

async function kaBulkDeleteChecked() {
  const ids = [...document.querySelectorAll('#ka-table input[type=checkbox]:checked')]
    .map(c => c.dataset.kid);
  await call('POST', '/subscription/keys/bulk-delete', { ids });
  kaLoad();
}

/* ================= subscriptions (admin) ================= */
function sbPage(dir) {
  S.sbSkip = Math.max(0, S.sbSkip + dir * (Number(el('sb-limit').value) || 10));
  sbLoad();
}

async function sbLoad() {
  const p = new URLSearchParams();
  if (el('sb-user').value) p.set('userId', el('sb-user').value);
  if (el('sb-type').value) p.set('type', el('sb-type').value);
  if (el('sb-status').value) p.set('status', el('sb-status').value);
  if (el('sb-sort').value) p.set('sort', el('sb-sort').value);
  p.set('skip', S.sbSkip);
  p.set('limit', el('sb-limit').value);
  const d = await call('GET', '/subscription?' + p.toString());
  const list = pickArray(d);
  S.sbTotal = d?.totalRecords ?? list.length;
  pageInfo('sb-pageinfo', S.sbSkip, list.length, S.sbTotal);
  const tb = el('sb-table').tBodies[0];
  tb.innerHTML = '';
  showTable('sb-table', 'sb-empty', list.length);
  for (const s of list) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = s.studentProfile?.user?.name ?? '';
    tr.insertCell().textContent = s.studentProfile?.user?.email ?? '';
    tr.insertCell().textContent = s.type ?? '';
    const e = tr.insertCell();
    e.textContent = (s.expireDate || '').slice(0, 10);
    if (s.isExpired || (s.expireDate && new Date(s.expireDate) < new Date())) {
      e.style.color = '#c0392b'; e.textContent += ' ✕';
    }
    tr.insertCell().textContent = (s.createdAt || '').slice(0, 10);
  }
}

/* ================= students (admin) ================= */
function asPage(dir) {
  S.asSkip = Math.max(0, S.asSkip + dir * (Number(el('as-limit').value) || 10));
  asLoad();
}

async function asLoad() {
  const p = new URLSearchParams();
  if (el('as-track').value) p.set('trackId', el('as-track').value);
  if (el('as-school').value) p.set('schoolId', el('as-school').value);
  if (el('as-name').value) p.set('name', el('as-name').value);
  p.set('skip', S.asSkip);
  p.set('limit', el('as-limit').value);
  const d = await call('GET', '/student?' + p.toString());
  const list = pickArray(d);
  S.asTotal = d?.totalRecords ?? list.length;
  pageInfo('as-pageinfo', S.asSkip, list.length, S.asTotal);
  const tb = el('as-table').tBodies[0];
  tb.innerHTML = '';
  showTable('as-table', 'as-empty', list.length);
  for (const s of list) {
    const tr = tb.insertRow();
    const n = tr.insertCell(); n.dir = 'auto'; n.textContent = s.user?.name ?? '';
    tr.insertCell().textContent = s.user?.email ?? '';
    const sc = tr.insertCell(); sc.dir = 'auto'; sc.textContent = s.school?.name ?? '';
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = s.track?.name ?? '';
    activeCell(tr, s);
    tr.insertCell().append(
      miniBtn('view', () => call('GET', `/student/${s.id}`)),
    );
  }
}

/* ================= daily wisement ================= */
async function wToday() {
  const d = await call('GET', '/daily-wisement/today');
  const box = el('w-today');
  if (d && d.text) {
    box.className = 'card';
    box.style.marginBottom = '0';
    box.innerHTML = `<div dir="auto" style="font-size:15px">${escapeHtml(d.text)}</div>` +
      `<div class="mono" style="font-size:11px;color:var(--mut);margin-top:6px">${d.id}</div>`;
  } else {
    box.className = 'empty';
    box.textContent = 'null — the table is empty, create some wisements first';
  }
}

function wPage(dir) {
  S.wSkip = Math.max(0, S.wSkip + dir * (Number(el('wf-limit').value) || 10));
  loadWisements();
}

async function loadWisements() {
  const p = new URLSearchParams();
  if (el('wf-text').value) p.set('text', el('wf-text').value);
  if (el('wf-sort').value) p.set('sort', el('wf-sort').value);
  p.set('skip', S.wSkip);
  p.set('limit', el('wf-limit').value);
  const d = await call('GET', '/daily-wisement?' + p.toString());
  S.wisements = pickArray(d);
  S.wTotal = d?.totalRecords ?? S.wisements.length;
  renderWisements();
}

function renderWisements() {
  const tb = el('w-table').tBodies[0];
  tb.innerHTML = '';
  showTable('w-table', 'w-empty', S.wisements.length);
  pageInfo('w-pageinfo', S.wSkip, S.wisements.length, S.wTotal);
  for (const w of S.wisements) {
    const tr = tb.insertRow();
    if (w.selected) tr.className = 'ok';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.wid = w.id;
    tr.insertCell().append(cb);
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = w.text ?? '';
    tr.insertCell().textContent = w.selected ? '✓' : '';
    tr.insertCell().textContent = w.usedPreviously ? '✓' : '';
    tr.insertCell().textContent = (w.createdAt || '').slice(0, 10);
    tr.insertCell().append(
      miniBtn('Edit…', () => wEdit(w)),
      ' ', miniBtn('Delete', () => call('DELETE', `/daily-wisement/${w.id}`).then(loadWisements), true),
    );
  }
}

function wEdit(w) {
  const body = prompt(
    `PATCH /daily-wisement/${w.id}\nJSON body — sent exactly as typed:`,
    JSON.stringify({ text: w.text }),
  );
  if (body === null) return;
  call('PATCH', `/daily-wisement/${w.id}`, body, { rawText: true }).then(loadWisements);
}

async function wCreate() {
  const body = {};
  if (el('wc-text').value) body.text = el('wc-text').value;
  await call('POST', '/daily-wisement', body);
  el('wc-text').value = '';
  loadWisements();
}

async function wBulkCreate() {
  await call('POST', '/daily-wisement/bulk', el('wb-json').value, { rawText: true });
  loadWisements();
}

async function wBulkDeleteChecked() {
  const ids = [...document.querySelectorAll('#w-table input[type=checkbox]:checked')]
    .map(c => c.dataset.wid);
  await call('POST', '/daily-wisement/bulk-delete', { ids });
  loadWisements();
}

/* ================= my account ================= */
async function patchMine() {
  const file = el('me-image').files[0];
  if (file) {
    const fd = new FormData();
    if (el('me-name').value) fd.append('name', el('me-name').value);
    if (el('me-phone').value) fd.append('phoneNumber', el('me-phone').value);
    if (el('me-pass').value) fd.append('password', el('me-pass').value);
    fd.append('image', file);
    await call('PATCH', '/user/mine', fd, { form: true });
  } else {
    const body = {};
    if (el('me-name').value) body.name = el('me-name').value;
    if (el('me-phone').value) body.phoneNumber = el('me-phone').value;
    if (el('me-pass').value) body.password = el('me-pass').value;
    await call('PATCH', '/user/mine', body);
  }
}

/* ================= public content ================= */
async function piGet() {
  const d = await call('GET', '/public-content/info');
  el('pi-json').value = JSON.stringify(d, null, 2);
}

async function piSet() {
  await call('POST', '/public-content/info', el('pi-json').value, { rawText: true });
}

async function pfList() {
  const list = pickArray(await call('GET', '/public-content/faqs'));
  const tb = el('pf-table').tBodies[0];
  tb.innerHTML = '';
  showTable('pf-table', 'pf-empty', list.length);
  for (const f of list) {
    const tr = tb.insertRow();
    const t = tr.insertCell(); t.dir = 'auto'; t.textContent = f.title ?? '';
    const d = tr.insertCell(); d.dir = 'auto'; d.textContent = f.description ?? '';
    tr.insertCell().append(
      miniBtn('Edit…', () => pfEdit(f)),
      ' ', miniBtn('Delete', () => call('DELETE', `/public-content/faqs/${f.id}`).then(pfList), true),
    );
  }
}

function pfEdit(f) {
  const body = prompt(
    `PATCH /public-content/faqs/${f.id}\nJSON body — sent exactly as typed:`,
    JSON.stringify({ title: f.title, description: f.description }),
  );
  if (body === null) return;
  call('PATCH', `/public-content/faqs/${f.id}`, body, { rawText: true }).then(pfList);
}

async function pfCreate() {
  const body = {};
  if (el('pf-title').value) body.title = el('pf-title').value;
  if (el('pf-desc').value) body.description = el('pf-desc').value;
  await call('POST', '/public-content/faqs', body);
  el('pf-title').value = '';
  el('pf-desc').value = '';
  pfList();
}

/* ================= tools ================= */
function openFile() {
  if (!el('fi-id').value) return;
  window.open(`${API}/files/${el('fi-id').value}`, '_blank');
}

async function rawSend() {
  const body = el('raw-body').value;
  await call(el('raw-method').value, el('raw-path').value,
    body === '' ? undefined : body, { rawText: true });
}

/* ================= wire up ================= */
mountAction('s-login', 'POST', '/auth/login', 'Sign in', doLogin);
mountAction('s-signup', 'POST', '/auth/signUp', 'Sign up (new student)', doSignup);
mountAction('s-refresh', 'POST', '/auth/refreshToken', 'Refresh token', doRefresh);
mountAction('s-whoami', 'GET', '/user/mine', 'Who am I?', () => call('GET', '/user/mine'));

mountAction('s-stprofile', 'GET', '/student/profile', 'My profile', stProfile);
mountAction('s-stsub', 'GET', '/subscription/me', 'My subscription', stSub);
mountAction('s-stredeem', 'POST', '/subscription/subscribe', 'Redeem', stRedeem);
mountAction('s-sttrial', 'POST', '/subscription/freeTrial', 'Start free trial', stTrial);

mountAction('s-scget', 'GET', '/school/me', 'My school', scGet);
mountAction('s-scedit', 'PATCH', '/school/me', 'Update name / logo', scEdit);
mountAction('s-scdelimg', 'DELETE', '/school/me/image', 'Remove logo', () =>
  call('DELETE', '/school/me/image').then(scGet));

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

mountAction('s-okload', 'GET', '/subscription/keys/school', 'Load my keys', () => { S.okSkip = 0; okLoad(); });
mountAction('s-osload', 'GET', '/student/school', 'Load students', () => { S.osSkip = 0; osLoad(); });

mountAction('s-uload', 'GET', '/user', 'Load users', () => { S.uSkip = 0; loadUsers(); });
mountAction('s-ucreateuser', 'POST', '/user', 'Create user', createUser);

mountAction('s-smload', 'GET', '/school/manage', 'Load schools', () => { S.smSkip = 0; smLoad(); });
mountAction('s-smcreate', 'POST', '/school/manage', 'Create school', smCreate);
mountAction('s-smedit', 'PATCH', '/school/manage/:id', 'Save school', smEdit);
mountAction('s-smdelimg', 'DELETE', '/school/manage/:id/image', 'Remove logo', () =>
  call('DELETE', `/school/manage/${el('sme-id').value}/image`));

mountAction('s-acallow', 'POST', '/learning/admin/schoolAccess/:schoolId/:trackId', 'Grant access', acAllow);
mountAction('s-acrevoke', 'DELETE', '/learning/admin/schoolAccess/:schoolId/:trackId', 'Revoke access', acRevoke);

mountAction('s-abcourses', 'GET', '/learning/admin/courses', 'Load courses', abCourses);
mountAction('s-abunits', 'GET', '/learning/admin/units', 'Load units', abUnits);
mountAction('s-ablessons', 'GET', '/learning/admin/lessons', 'Load lessons', abLessons);
mountAction('s-abquestions', 'GET', '/learning/admin/questions', 'Load questions', () => { S.abQSkip = 0; abQuestions(); });

mountAction('s-kmint', 'POST', '/subscription/keys', 'Mint keys', kMint);
mountAction('s-kaload', 'GET', '/subscription/keys', 'Load all keys', () => { S.kaSkip = 0; kaLoad(); });
mountAction('s-kabulkdel', 'POST', '/subscription/keys/bulk-delete', 'Delete checked', kaBulkDeleteChecked);

mountAction('s-sbload', 'GET', '/subscription', 'Load subscriptions', () => { S.sbSkip = 0; sbLoad(); });
mountAction('s-asload', 'GET', '/student', 'Load students', () => { S.asSkip = 0; asLoad(); });

mountAction('s-wtoday', 'GET', '/daily-wisement/today', 'Fetch today', wToday);
mountAction('s-wload', 'GET', '/daily-wisement', 'Load wisements', () => { S.wSkip = 0; loadWisements(); });
mountAction('s-wcreate', 'POST', '/daily-wisement', 'Create wisement', wCreate);
mountAction('s-wbulk', 'POST', '/daily-wisement/bulk', 'Create batch', wBulkCreate);
mountAction('s-wbulkdel', 'POST', '/daily-wisement/bulk-delete', 'Delete checked', wBulkDeleteChecked);

mountAction('s-mine', 'GET', '/user/mine', 'Fetch my profile', () => call('GET', '/user/mine'));
mountAction('s-umeta', 'GET', '/user/metaData', 'Roles list', () => call('GET', '/user/metaData'));
mountAction('s-mepatch', 'PATCH', '/user/mine', 'Update profile', patchMine);
mountAction('s-medelimg', 'DELETE', '/user/mine/image', 'Remove my image', () => call('DELETE', '/user/mine/image'));
mountAction('s-mecomplete', 'POST', '/user/mine/complete-profile', 'Complete profile', () =>
  call('POST', '/user/mine/complete-profile', {
    ...(el('me-cname').value ? { name: el('me-cname').value } : {}),
    ...(el('me-cphone').value ? { phoneNumber: el('me-cphone').value } : {}),
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

mountAction('s-piget', 'GET', '/public-content/info', 'Fetch info', piGet);
mountAction('s-piset', 'POST', '/public-content/info', 'Set info (admin)', piSet);
mountAction('s-pflist', 'GET', '/public-content/faqs', 'Load FAQs', pfList);
mountAction('s-pfcreate', 'POST', '/public-content/faqs', 'Create FAQ (admin)', pfCreate);

mountAction('s-ping', 'GET', '/ping', 'Ping', () => call('GET', '/ping'));
mountAction('s-errcat', 'GET', '/errors', 'Error catalog', () => call('GET', '/errors'));
mountAction('s-lmeta', 'GET', '/learning/metaData', 'Learning enums', () => call('GET', '/learning/metaData'));
mountAction('s-tracks', 'GET', '/learning/tracks', 'Tracks', () => call('GET', '/learning/tracks'));

el('pk-track').onchange = onTrack;
el('pk-course').onchange = onCourse;
el('pk-unit').onchange = onUnit;
el('pk-lesson').onchange = onLesson;

/* ================= boot ================= */
const envSel = el('h-env');
for (const [k, v] of Object.entries(ENVS)) {
  const o = document.createElement('option');
  o.value = k; o.textContent = v.label;
  envSel.add(o);
}
envSel.value = ENV;
envSel.onchange = (e) => setEnv(e.target.value);

el('wb-json').value = JSON.stringify(
  { items: [{ text: 'حكمة اليوم الأولى' }, { text: 'حكمة اليوم الثانية' }] },
  null, 2,
);
el('se-email').value = localStorage.getItem('nk.lastEmail') || 'admin@hul.com';
el('se-pass').value = localStorage.getItem('nk.lastPass') || '12345678';
el('se-email').onchange = () => localStorage.setItem('nk.lastEmail', el('se-email').value);
el('se-pass').onchange = () => localStorage.setItem('nk.lastPass', el('se-pass').value);

applyEnv();
applyRole();
renderSession();
resetChainFrom('pk-course');
fillSelect(el('pk-track'), [], 'sign in first');
renderQuestions();
if (currentAccount()) bootRefs();
