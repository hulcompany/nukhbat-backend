'use strict';
/* ══════════════════════════════════════════════════════════════════
   نخبة الأوائل — بوابة الطالب (student portal)
   A dependency-free SPA served at /student by the API itself.
   Login (no signup) → subscribe → solve → review achievements.
   ══════════════════════════════════════════════════════════════════ */

/* ─── config & storage ──────────────────────────────────────────── */
const BASE =
  (location.origin.startsWith('http')
    ? location.origin
    : 'http://localhost:3000') + '/api';

const STORE = 'nkb-student-v1';
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
};
let session = load(); // { accessToken, refreshToken, user }
const saveSession = () => localStorage.setItem(STORE, JSON.stringify(session));
const clearSession = () => {
  session = {};
  localStorage.removeItem(STORE);
};

/* per-view state kept in memory only */
const AppState = {
  screen: 'curriculum',
  profile: null, // student profile (xp/gems/school/track)
  subscription: null,
  solve: null, // active lesson attempt: { snapshotId, lesson, questions, answers }
};

/* ─── tiny DOM helpers ──────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]),
  );

let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

// surface any otherwise-silent failure instead of leaving a dead button
window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  toast('حدث خطأ: ' + (e.message || 'غير معروف'), 'bad');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('خطأ: ' + (e.reason?.message || e.reason || 'غير معروف'), 'bad');
});

/* ─── API layer (unwraps the { message, data } envelope) ────────── */
async function api(method, path, body, _retry) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.accessToken)
    headers.Authorization = 'Bearer ' + session.accessToken;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم');
  }

  // silent refresh + retry once on an expired token
  if (res.status === 401 && session.refreshToken && !_retry) {
    const ok = await refresh();
    if (ok) return api(method, path, body, true);
  }

  let payload = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const msg =
      (payload && (payload.message || payload.error)) ||
      `خطأ (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  // success envelope is { message, data }
  return payload && 'data' in payload ? payload.data : payload;
}

async function refresh() {
  try {
    const res = await fetch(BASE + '/auth/refreshToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.refreshToken }),
    });
    if (!res.ok) return false;
    const p = await res.json();
    const data = p.data || p;
    session.accessToken = data.accessToken;
    session.refreshToken = data.refreshToken;
    saveSession();
    return true;
  } catch {
    return false;
  }
}

/* ─── boot ───────────────────────────────────────────────────────
   The actual render() call lives at the very BOTTOM of this file. It
   must run only after every top-level declaration (TABS, the screen
   fns, …) is initialized — calling it here would hit `TABS` while it's
   still in its temporal dead zone and throw for any already-logged-in
   user (dead shell + dead logout). */

async function render() {
  if (!session.accessToken) return renderLogin();
  renderShell();
  renderScreen();
  // fetch profile/subscription lazily for the header chips
  refreshHeader();
}

/* ─── login ─────────────────────────────────────────────────────── */
function renderLogin() {
  const root = document.getElementById('app');
  root.innerHTML = '';
  const wrap = el(`
    <div class="login-wrap">
      <form class="card login-card" id="li-form" novalidate>
        <div class="brand">نخبة <span>الأوائل</span></div>
        <p>بوابة الطالب — سجّل الدخول للمتابعة</p>
        <label class="field"><span>البريد الإلكتروني</span>
          <input id="li-email" type="email" placeholder="student@example.com" autocomplete="username"/></label>
        <label class="field"><span>كلمة المرور</span>
          <div class="pass-wrap">
            <input id="li-pass" type="password" placeholder="••••••••" autocomplete="current-password"/>
            <button type="button" class="pass-toggle" id="li-eye" aria-label="إظهار كلمة المرور">👁</button>
          </div>
        </label>
        <button class="btn" id="li-btn" type="submit" style="width:100%">دخول</button>
      </form>
    </div>`);
  root.appendChild(wrap);

  const form = $('#li-form', root);
  const btn = $('#li-btn', root);
  const passInput = $('#li-pass', root);

  $('#li-eye', root).addEventListener('click', () => {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
    passInput.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // never let the browser reload the page
    const email = $('#li-email', root).value.trim();
    const password = passInput.value;
    if (!email || !password) return toast('أدخل البريد وكلمة المرور', 'bad');
    btn.disabled = true;
    btn.textContent = 'جارٍ الدخول…';
    try {
      const data = await api('POST', '/auth/login', { email, password });
      session = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };
      saveSession();
      AppState.screen = 'curriculum';
      render();
    } catch (err) {
      toast(err.message, 'bad');
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  });
  $('#li-email', root).focus();
}

/* ─── shell (topbar + nav) ──────────────────────────────────────── */
const TABS = [
  ['curriculum', 'المنهج'],
  ['solve', 'حل درس'],
  ['daily', 'التحدي اليومي'],
  ['attempts', 'محاولاتي'],
  ['saved', 'المحفوظة'],
  ['leaderboard', 'المتصدّرون'],
  ['subscribe', 'الاشتراك'],
  ['profile', 'حسابي'],
];

function renderShell() {
  const name = esc(session.user?.name || 'طالب');
  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <div class="brand">نخبة <span>الأوائل</span></div>
      <div class="stats" id="hdr-stats"></div>
      <span class="chip user" title="${esc(session.user?.email || '')}">👤 ${name}</span>
      <button class="logout" id="logout">خروج</button>
    </div>
    <div class="nav" id="nav"></div>
    <main id="view"></main>`;

  const nav = $('#nav');
  TABS.forEach(([key, label]) => {
    const b = el(`<button data-k="${key}">${label}</button>`);
    if (key === AppState.screen) b.classList.add('active');
    b.onclick = () => {
      AppState.screen = key;
      renderShell();
      renderScreen();
      refreshHeader();
    };
    nav.appendChild(b);
  });
  $('#logout').addEventListener('click', () => {
    clearSession();
    AppState.screen = 'curriculum';
    AppState.profile = null;
    AppState.subscription = null;
    AppState.solve = null;
    render();
  });
}

async function refreshHeader() {
  try {
    const p = await api('GET', '/student/profile');
    AppState.profile = p;
    const stats = $('#hdr-stats');
    if (stats)
      stats.innerHTML = `
        <span class="chip xp">⭐ ${p.xp ?? 0} XP</span>
        <span class="chip gem">💎 ${p.gems ?? 0}</span>`;
  } catch {
    /* not subscribed yet — leave header bare */
  }
}

/* ─── screen router ─────────────────────────────────────────────── */
function renderScreen() {
  const v = $('#view');
  if (!v) return;
  v.innerHTML = '<div class="spinner"></div>';
  const fn = {
    curriculum: screenCurriculum,
    solve: screenSolve,
    daily: screenDaily,
    attempts: screenAttempts,
    saved: screenSaved,
    leaderboard: screenLeaderboard,
    subscribe: screenSubscribe,
    profile: screenProfile,
  }[AppState.screen];
  fn(v);
}

function fail(v, e) {
  v.innerHTML = `<div class="card empty">⚠️ ${esc(e.message)}${
    /اشتراك|subscription|Subscription/i.test(e.message)
      ? '<br/><br/><button class="btn" id="goSub">اذهب للاشتراك</button>'
      : ''
  }</div>`;
  const g = $('#goSub', v);
  if (g)
    g.onclick = () => {
      AppState.screen = 'subscribe';
      renderShell();
      renderScreen();
    };
}

/* ─── screen: curriculum tree ───────────────────────────────────── */
async function screenCurriculum(v) {
  try {
    const data = await api('GET', '/learning/curriculum');
    const tree = data.tree || [];
    v.innerHTML = `
      <div class="card">
        <h2>منهجي</h2>
        <h3>تقدّمك الكلّي: ${data.overallProgress ?? 0}%</h3>
        <div class="progress"><i style="width:${data.overallProgress ?? 0}%"></i></div>
      </div>`;
    if (!tree.length) {
      v.appendChild(el('<div class="card empty">لا يوجد محتوى بعد.</div>'));
      return;
    }
    tree.forEach((course) => {
      const card = el(`
        <div class="card">
          <div class="course-title">
            <span>📚 ${esc(course.title)}</span>
            <span class="muted">${course.progress ?? 0}%</span>
          </div>
          <div class="progress"><i style="width:${course.progress ?? 0}%"></i></div>
          <div class="units"></div>
        </div>`);
      const units = $('.units', card);
      (course.units || []).forEach((u) => {
        const ub = el(`
          <div class="unit">
            <div class="row" style="justify-content:space-between">
              <b>${esc(u.title)}</b><span class="muted">${u.progress ?? 0}%</span>
            </div>
            <div class="lessons"></div>
          </div>`);
        const lessons = $('.lessons', ub);
        (u.lessons || []).forEach((l) => {
          const row = el(`
            <div class="lesson">
              <span class="name">📝 ${esc(l.name)} <span class="muted">(${l.questionLength ?? 0} سؤال)</span></span>
              <span class="row">
                <span class="badge ${l.passed ? 'done' : 'todo'}">${l.passed ? '✓ مكتمل' : 'غير مكتمل'}</span>
                <button class="btn sm" data-lesson="${l.id}" data-title="${esc(l.name)}">حلّ</button>
              </span>
            </div>`);
          $('button', row).onclick = () => startLesson(l.id);
          lessons.appendChild(row);
        });
        units.appendChild(ub);
      });
      v.appendChild(card);
    });
  } catch (e) {
    fail(v, e);
  }
}

/* ─── solve flow ────────────────────────────────────────────────── */
async function startLesson(lessonId) {
  toast('جارٍ تحضير الدرس…');
  try {
    const data = await api('POST', '/learning/solving/student/start', {
      lessonId,
    });
    AppState.solve = {
      snapshotId: data.id,
      lesson: data.lesson,
      questions: data.questions || [],
      answers: {},
    };
    AppState.screen = 'solve';
    renderShell();
    renderScreen();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

function screenSolve(v) {
  if (!AppState.solve) {
    v.innerHTML = `
      <div class="card empty">
        اختر درساً من <b>المنهج</b> لبدء الحل.
        <br/><br/><button class="btn" id="goCur">فتح المنهج</button>
      </div>`;
    $('#goCur', v).onclick = () => {
      AppState.screen = 'curriculum';
      renderShell();
      renderScreen();
    };
    return;
  }
  const s = AppState.solve;
  v.innerHTML = `
    <div class="card">
      <h2>${esc(s.lesson.title)}</h2>
      ${s.lesson.description ? `<h3>${esc(s.lesson.description)}</h3>` : ''}
      <div class="muted">${s.questions.length} سؤال — أجب ثم اضغط تسليم</div>
    </div>
    <div id="qs"></div>
    <div class="card row" style="justify-content:space-between">
      <button class="btn ghost" id="cancel">إلغاء</button>
      <button class="btn" id="submit">تسليم الإجابات</button>
    </div>`;
  renderQuestions($('#qs', v), s.questions, s.answers);
  $('#cancel', v).onclick = () => {
    AppState.solve = null;
    AppState.screen = 'curriculum';
    renderShell();
    renderScreen();
  };
  $('#submit', v).onclick = () => submitLesson(v);
}

async function submitLesson(v) {
  const s = AppState.solve;
  const btn = $('#submit', v);
  btn.disabled = true;
  btn.textContent = 'جارٍ التصحيح…';
  try {
    const answers = collectAnswers(s.questions, s.answers);
    const result = await api('POST', '/learning/solving/student/solve', {
      snapshotId: s.snapshotId,
      answers,
    });
    AppState.solve = null;
    renderResult(v, result, {
      title: 'نتيجة الدرس',
      onDone: () => {
        AppState.screen = 'curriculum';
        renderShell();
        renderScreen();
      },
    });
    refreshHeader();
  } catch (e) {
    toast(e.message, 'bad');
    btn.disabled = false;
    btn.textContent = 'تسليم الإجابات';
  }
}

/* build answer inputs for one set of questions into `answers` map */
function renderQuestions(root, questions, answers) {
  root.innerHTML = '';
  questions.forEach((q, i) => {
    const card = el(`
      <div class="q">
        <div class="q-head">
          <div class="q-title">${i + 1}. ${esc(q.title)}</div>
          <span class="q-type">${qTypeLabel(q.type)}</span>
        </div>
        <div class="q-body"></div>
        ${
          q.tips && q.tips.length
            ? `<div class="tips">💡 ${q.tips.map(esc).join(' • ')}</div>`
            : ''
        }
      </div>`);
    const body = $('.q-body', card);

    if (q.type === 'options') {
      (q.options || []).forEach((o) => {
        const row = el(`
          <label class="opt">
            <input type="radio" name="q-${q.id}"/>
            <span>${esc(o.text)}</span>
          </label>`);
        $('input', row).onchange = () => {
          answers[q.id] = { choiceId: o.id };
          body.querySelectorAll('.opt').forEach((x) => x.classList.remove('selected'));
          row.classList.add('selected');
        };
        body.appendChild(row);
      });
    } else if (q.type === 'trueFalse') {
      [['صحيح', true], ['خطأ', false]].forEach(([label, val]) => {
        const row = el(`
          <label class="opt">
            <input type="radio" name="q-${q.id}"/>
            <span>${label}</span>
          </label>`);
        $('input', row).onchange = () => {
          answers[q.id] = { boolAnswer: val };
          body.querySelectorAll('.opt').forEach((x) => x.classList.remove('selected'));
          row.classList.add('selected');
        };
        body.appendChild(row);
      });
    } else if (q.type === 'match') {
      const items = q.matchingItems || [];
      const bases = items.filter((m) => m.type === 'base');
      const matches = items.filter((m) => m.type === 'match');
      answers[q.id] = { matches: [] };
      const optionsHtml = matches
        .map((m) => `<option value="${m.id}">${esc(m.text)}</option>`)
        .join('');
      bases.forEach((base) => {
        const row = el(`
          <div class="match-row">
            <div class="base">${esc(base.text)}</div>
            <select><option value="">— اختر —</option>${optionsHtml}</select>
          </div>`);
        $('select', row).onchange = (e) => {
          const arr = answers[q.id].matches.filter((x) => x.baseId !== base.id);
          if (e.target.value) arr.push({ baseId: base.id, matchId: e.target.value });
          answers[q.id].matches = arr;
        };
        body.appendChild(row);
      });
    }
    root.appendChild(card);
  });
}

function collectAnswers(questions, answers) {
  // one entry per answered question; unanswered are simply omitted
  return questions
    .filter((q) => answers[q.id] !== undefined)
    .map((q) => ({ id: q.id, answer: answers[q.id] }))
    .filter((a) => {
      const v = a.answer;
      return (
        v.choiceId !== undefined ||
        v.boolAnswer !== undefined ||
        (v.matches && v.matches.length)
      );
    });
}

function qTypeLabel(t) {
  return { options: 'اختيار', trueFalse: 'صح/خطأ', match: 'توصيل' }[t] || t;
}

/* ─── the achievement / result panel (lesson + daily challenge) ─── */
function renderResult(v, result, opts) {
  const total = result.total ?? 0;
  const passed = result.passed ?? 0;
  const skipped = result.skipped ?? 0;
  const xps = result.xps ?? 0;
  const gems = result.gems ?? 0;
  const perfect = total > 0 && passed === total;
  const pct = total ? Math.round((100 * passed) / total) : 0;

  v.innerHTML = `
    <div class="result">
      <div class="result-hero ${perfect ? 'win' : ''}">
        <div class="verdict-emoji">${perfect ? '🏆' : passed > 0 ? '👍' : '💪'}</div>
        <h2>${perfect ? 'ممتاز! أجبت على كل الأسئلة' : passed > 0 ? 'أحسنت — استمر!' : 'لا بأس، حاول مجدداً'}</h2>
        <div class="sub">${esc(opts.title)} • ${passed} من ${total} (${pct}%)</div>
        <div class="rewards">
          <div class="reward score"><div class="num">${passed}/${total}</div><div class="lbl">إجابات صحيحة</div></div>
          <div class="reward skip"><div class="num">${skipped}</div><div class="lbl">متروكة</div></div>
          <div class="reward xp"><div class="num">${xps > 0 ? '+' : ''}${xps}</div><div class="lbl">نقاط XP</div></div>
          <div class="reward gem"><div class="num">${gems > 0 ? '+' : ''}${gems}</div><div class="lbl">جواهر 💎</div></div>
        </div>
        ${
          xps > 0 || gems > 0
            ? `<div style="margin-top:12px" class="gained">🎉 حصلت على ${xps} XP${gems ? ` و ${gems} جوهرة` : ''}!</div>`
            : `<div style="margin-top:12px" class="muted">أكمل كل الأسئلة بشكل صحيح لتربح النقاط.</div>`
        }
      </div>
      <div class="review" id="review"></div>
    </div>
    <div class="card row" style="justify-content:center">
      <button class="btn" id="doneBtn">تم</button>
    </div>`;
  renderReview($('#review', v), result.verdict || []);
  $('#doneBtn', v).onclick = opts.onDone;
}

/* per-question "your answer vs correct" review */
function renderReview(root, verdicts) {
  root.innerHTML = `<h3 style="margin-bottom:10px">مراجعة الأسئلة</h3>`;
  verdicts.forEach((vd, i) => {
    const state = questionState(vd);
    const box = el(`
      <div class="rev-q ${state.cls}">
        <div class="rev-title">
          <span>${i + 1}. ${esc(vd.title)}</span>
          <span class="row">
            <button class="btn ghost sm save-q" title="حفظ السؤال">☆ حفظ</button>
            <span class="tag ${state.cls}">${state.label}</span>
          </span>
        </div>
        <div class="rev-body"></div>
      </div>`);
    const saveBtn = $('.save-q', box);
    if (vd.id)
      saveBtn.onclick = () => {
        saveQuestion(vd.id);
        saveBtn.textContent = '★ محفوظ';
        saveBtn.disabled = true;
      };
    else saveBtn.remove();
    const body = $('.rev-body', box);

    if (vd.choiceVerdict) {
      const c = vd.choiceVerdict;
      body.innerHTML = `
        <div class="rev-line"><b>إجابتك:</b> <span class="${c.verdict ? 'answer-good' : 'answer-bad'}">${
          c.answered ? esc(c.answered.text) : '— (لم تجب)'
        }</span></div>
        ${
          !c.verdict && c.correctOption
            ? `<div class="rev-line"><b>الصحيحة:</b> <span class="answer-good">${esc(c.correctOption.text)}</span></div>`
            : ''
        }`;
    } else if (vd.trueOrFalseVerdict) {
      const t = vd.trueOrFalseVerdict;
      const b2s = (b) => (b === true ? 'صحيح' : b === false ? 'خطأ' : '— (لم تجب)');
      body.innerHTML = `
        <div class="rev-line"><b>إجابتك:</b> <span class="${t.verdict ? 'answer-good' : 'answer-bad'}">${b2s(t.answered)}</span></div>
        ${
          !t.verdict
            ? `<div class="rev-line"><b>الصحيحة:</b> <span class="answer-good">${b2s(t.correctAnswer)}</span></div>`
            : ''
        }`;
    } else if (vd.matchVerdicts) {
      body.innerHTML = vd.matchVerdicts
        .map((m) => {
          const yours = m.answeredMatch ? esc(m.answeredMatch.text) : '— (لم تجب)';
          const correct = m.baseCorrectMatch ? esc(m.baseCorrectMatch.text) : '—';
          return `<div class="rev-line"><b>${esc(m.answeredBase.text)}:</b>
            <span class="${m.verdict ? 'answer-good' : 'answer-bad'}">${yours}</span>${
            m.verdict ? '' : ` <span class="muted">← الصحيح:</span> <span class="answer-good">${correct}</span>`
          }</div>`;
        })
        .join('');
    }
    root.appendChild(box);
  });
}

function questionState(vd) {
  if (vd.isSkipped) return { cls: 'skipped', label: 'متروك' };
  let ok = false;
  if (vd.choiceVerdict) ok = vd.choiceVerdict.verdict;
  else if (vd.trueOrFalseVerdict) ok = vd.trueOrFalseVerdict.verdict;
  else if (vd.matchVerdicts) ok = vd.matchVerdicts.every((m) => m.verdict);
  return ok
    ? { cls: 'correct', label: '✓ صحيح' }
    : { cls: 'wrong', label: '✗ خطأ' };
}

/* ─── screen: daily challenge ───────────────────────────────────── */
async function screenDaily(v) {
  try {
    const dc = await api('GET', '/learning/solving/student/daily-challenge');
    if (dc.solved) {
      // already attempted → render the frozen verdict as a result panel
      renderResult(
        v,
        {
          passed: dc.score,
          total: dc.total,
          skipped: (dc.verdict || []).filter((x) => x.isSkipped).length,
          xps: 0,
          gems: 0,
          verdict: dc.verdict,
        },
        {
          title: 'تحدي اليوم (تم الحل)',
          onDone: () => renderScreen(),
        },
      );
      // the "done" button just re-renders; hide reward gain noise
      return;
    }
    const questions = dc.questions || [];
    const answers = {};
    v.innerHTML = `
      <div class="card">
        <h2>🔥 التحدي اليومي</h2>
        <h3>${dc.date ? esc(dc.date) : ''} — ${questions.length} سؤال. محاولة واحدة فقط!</h3>
      </div>
      <div id="qs"></div>
      <div class="card row" style="justify-content:flex-end">
        <button class="btn" id="submit">تسليم التحدي</button>
      </div>`;
    renderQuestions($('#qs', v), questions, answers);
    $('#submit', v).onclick = async () => {
      const btn = $('#submit', v);
      btn.disabled = true;
      btn.textContent = 'جارٍ التصحيح…';
      try {
        const result = await api(
          'POST',
          '/learning/solving/student/daily-challenge/solve',
          { answers: collectAnswers(questions, answers) },
        );
        renderResult(v, result, {
          title: 'نتيجة التحدي اليومي',
          onDone: () => renderScreen(),
        });
        refreshHeader();
      } catch (e) {
        toast(e.message, 'bad');
        btn.disabled = false;
        btn.textContent = 'تسليم التحدي';
      }
    };
  } catch (e) {
    fail(v, e);
  }
}

/* ─── screen: my attempts ───────────────────────────────────────── */
async function screenAttempts(v) {
  try {
    const page = await api('GET', '/learning/solving/student/attempts?limit=50');
    const list = page.list || [];
    v.innerHTML = `<div class="card"><h2>محاولاتي</h2><h3>${page.totalRecords ?? list.length} محاولة</h3></div>`;
    if (!list.length) {
      v.appendChild(el('<div class="card empty">لا توجد محاولات بعد.</div>'));
      return;
    }
    const holder = el('<div></div>');
    list.forEach((a) => {
      const row = el(`
        <div class="list-row">
          <div>
            <div><b>${esc(a.lessonTitle || 'درس')}</b> <span class="badge ${a.completed ? 'done' : 'todo'}">${a.completed ? 'مكتمل' : 'غير مكتمل'}</span></div>
            <div class="meta">${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0} صحيح • محاولة #${a.attemptNumber ?? 1} • +${a.xpAwarded ?? 0} XP • ${fmtDate(a.createdAt)}</div>
          </div>
          <button class="btn ghost sm">التفاصيل</button>
        </div>`);
      $('button', row).onclick = () => showAttemptDetail(a);
      holder.appendChild(row);
    });
    v.appendChild(holder);
  } catch (e) {
    fail(v, e);
  }
}

async function showAttemptDetail(a) {
  const v = $('#view');
  v.innerHTML = '<div class="spinner"></div>';
  try {
    const rows = await api(
      'GET',
      `/learning/solving/student/attempts/${a.id}/questions`,
    );
    // each QuestionAttempt.result is a full QuestionVerdict — reuse the review UI
    v.innerHTML = `
      <div class="card row" style="justify-content:space-between">
        <div><h2>${esc(a.lessonTitle || 'درس')}</h2>
        <div class="muted">${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0} صحيح • ${fmtDate(a.createdAt)}</div></div>
        <button class="btn ghost" id="back">رجوع</button>
      </div>
      <div class="card"><div class="review" id="review"></div></div>`;
    renderReview($('#review', v), rows.map((r) => r.result).filter(Boolean));
    $('#back', v).onclick = () => renderScreen();
  } catch (e) {
    fail(v, e);
  }
}

/* ─── screen: saved questions ───────────────────────────────────── */
async function screenSaved(v) {
  try {
    const list = await api('GET', '/learning/saved-questions');
    v.innerHTML = `<div class="card"><h2>الأسئلة المحفوظة</h2><h3>${list.length} سؤال</h3></div>`;
    if (!list.length) {
      v.appendChild(
        el('<div class="card empty">لم تحفظ أي سؤال بعد. احفظ الأسئلة أثناء المراجعة.</div>'),
      );
      return;
    }
    list.forEach((item) => {
      // saved rows may carry the question inline or just an id
      const q = item.question || item;
      const qid = q.id || item.questionId;
      const card = el(`
        <div class="q">
          <div class="q-head">
            <div class="q-title">${esc(q.title || 'سؤال محفوظ')}</div>
            <button class="btn ghost sm">إزالة</button>
          </div>
          ${q.type ? `<span class="q-type">${qTypeLabel(q.type)}</span>` : ''}
          ${
            q.options
              ? '<div>' +
                q.options.map((o) => `<div class="opt">${esc(o.text)}</div>`).join('') +
                '</div>'
              : ''
          }
        </div>`);
      $('button', card).onclick = () => unsaveQuestion(qid);
      v.appendChild(card);
    });
  } catch (e) {
    fail(v, e);
  }
}

async function saveQuestion(questionId) {
  try {
    await api('POST', '/learning/saved-questions', { questionId });
    toast('تم حفظ السؤال', 'good');
  } catch (e) {
    toast(e.message, 'bad');
  }
}
async function unsaveQuestion(questionId) {
  try {
    await api('DELETE', '/learning/saved-questions', { questionId });
    toast('تمت الإزالة', 'good');
    renderScreen();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

/* ─── screen: leaderboard ───────────────────────────────────────── */
async function screenLeaderboard(v) {
  try {
    const rows = await api('GET', '/learning/solving/student/leaderboard');
    v.innerHTML = `<div class="card"><h2>🏅 لوحة المتصدّرين</h2><h3>حسب نقاط XP في مسارك</h3></div>`;
    if (!rows.length) {
      v.appendChild(el('<div class="card empty">لا يوجد ترتيب بعد.</div>'));
      return;
    }
    const myId = AppState.profile?.id;
    rows.forEach((r, i) => {
      const rank = i + 1;
      const gcls = rank <= 3 ? ` g${rank}` : '';
      const isMe = r.studentId === myId;
      const name = esc(r.student?.user?.name || 'طالب');
      const row = el(`
        <div class="list-row">
          <div class="row">
            <span class="rank${gcls}${isMe ? ' me' : ''}">${rank}</span>
            <b>${name}${isMe ? ' <span class="muted">(أنت)</span>' : ''}</b>
          </div>
          <span class="chip xp">⭐ ${r.xp} XP</span>
        </div>`);
      v.appendChild(row);
    });
  } catch (e) {
    fail(v, e);
  }
}

/* ─── screen: subscribe (free trial / key) ──────────────────────── */
async function screenSubscribe(v) {
  v.innerHTML = `
    <div class="card" id="cur-sub"><h2>اشتراكي الحالي</h2><div class="spinner"></div></div>
    <div class="grid">
      <div class="card">
        <h2>🎁 تجربة مجانية</h2>
        <h3>اختر المسار لبدء تجربتك المجانية</h3>
        <label class="field"><span>المسار</span><select id="trk"><option value="">— جارٍ التحميل —</option></select></label>
        <button class="btn" id="ft-btn">ابدأ التجربة المجانية</button>
      </div>
      <div class="card">
        <h2>🔑 تفعيل بمفتاح</h2>
        <h3>أدخل مفتاح الاشتراك الخاص بك</h3>
        <label class="field"><span>المفتاح</span><input id="key" placeholder="XXXX-XXXX"/></label>
        <button class="btn gem" id="key-btn">تفعيل الاشتراك</button>
      </div>
    </div>`;

  // current subscription
  loadSubscriptionCard($('#cur-sub', v));

  // tracks for the free-trial selector (public endpoint)
  try {
    const tracks = await api('GET', '/curriculum/tracks');
    const sel = $('#trk', v);
    sel.innerHTML =
      '<option value="">— اختر مساراً —</option>' +
      (tracks || [])
        .map((t) => `<option value="${t.id}">${esc(t.title || t.name || t.id)}</option>`)
        .join('');
  } catch {
    $('#trk', v).innerHTML = '<option value="">تعذّر تحميل المسارات</option>';
  }

  $('#ft-btn', v).onclick = async () => {
    const trackId = $('#trk', v).value;
    if (!trackId) return toast('اختر مساراً أولاً', 'bad');
    const btn = $('#ft-btn', v);
    btn.disabled = true;
    try {
      await api('POST', '/subscription/freeTrial', { trackId });
      toast('تم تفعيل التجربة المجانية! 🎉', 'good');
      refreshHeader();
      loadSubscriptionCard($('#cur-sub', v));
    } catch (e) {
      toast(e.message, 'bad');
    }
    btn.disabled = false;
  };

  $('#key-btn', v).onclick = async () => {
    const key = $('#key', v).value.trim();
    if (!key) return toast('أدخل المفتاح', 'bad');
    const btn = $('#key-btn', v);
    btn.disabled = true;
    try {
      await api('POST', '/subscription/subscribe', { key });
      toast('تم تفعيل الاشتراك! 🎉', 'good');
      refreshHeader();
      loadSubscriptionCard($('#cur-sub', v));
    } catch (e) {
      toast(e.message, 'bad');
    }
    btn.disabled = false;
  };
}

async function loadSubscriptionCard(card) {
  try {
    const sub = await api('GET', '/subscription/me');
    AppState.subscription = sub;
    const exp = sub.expireDate ? new Date(sub.expireDate) : null;
    const live = exp && exp.getTime() > Date.now();
    const days = exp
      ? Math.ceil((exp.getTime() - Date.now()) / 86400000)
      : null;
    card.innerHTML = `
      <h2>اشتراكي الحالي</h2>
      <div class="kv">
        <b>النوع</b><span>${subTypeLabel(sub.type)}</span>
        <b>الحالة</b><span class="${live ? 'answer-good' : 'answer-bad'}">${live ? 'فعّال' : 'منتهٍ'}</span>
        <b>ينتهي في</b><span>${exp ? fmtDate(sub.expireDate) : '—'}${live && days != null ? ` (${days} يوم متبقٍ)` : ''}</span>
      </div>`;
  } catch (e) {
    card.innerHTML = `<h2>اشتراكي الحالي</h2><div class="muted">${esc(e.message)}</div>`;
  }
}

function subTypeLabel(t) {
  return { freeTrial: 'تجربة مجانية', paid: 'مدفوع' }[t] || t || '—';
}

/* ─── screen: my profile / school / subscription ────────────────── */
async function screenProfile(v) {
  v.innerHTML = `
    <div class="card row" style="justify-content:space-between">
      <h2>حسابي</h2>
      <div class="row">
        <button class="btn info sm" id="btn-prof">تحديث الملف</button>
        <button class="btn gem sm" id="btn-sub">عرض الاشتراك</button>
      </div>
    </div>
    <div id="prof-body"><div class="spinner"></div></div>`;
  $('#btn-prof', v).onclick = () => loadProfileBody($('#prof-body', v));
  $('#btn-sub', v).onclick = () => {
    AppState.screen = 'subscribe';
    renderShell();
    renderScreen();
  };
  loadProfileBody($('#prof-body', v));
}

async function loadProfileBody(body) {
  body.innerHTML = '<div class="spinner"></div>';
  try {
    const p = await api('GET', '/student/profile');
    AppState.profile = p;
    const school = p.school || {};
    const track = p.track || {};
    body.innerHTML = `
      <div class="card">
        <h3>الطالب</h3>
        <div class="kv">
          <b>الاسم</b><span>${esc(p.user?.name || session.user?.name || '—')}</span>
          <b>البريد</b><span>${esc(p.user?.email || session.user?.email || '—')}</span>
          <b>الهاتف</b><span>${esc(p.user?.phoneNumber || '—')}</span>
          <b>الحالة</b><span class="${p.active ? 'answer-good' : 'answer-bad'}">${p.active ? 'نشط' : 'موقوف'}</span>
        </div>
        <div class="rewards" style="justify-content:flex-start;margin-top:14px">
          <div class="reward xp"><div class="num">${p.xp ?? 0}</div><div class="lbl">XP</div></div>
          <div class="reward gem"><div class="num">${p.gems ?? 0}</div><div class="lbl">جواهر</div></div>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <h3>مدرستي</h3>
          <div class="kv">
            <b>الاسم</b><span>${esc(school.name || '—')}</span>
            <b>الوصف</b><span>${esc(school.description || '—')}</span>
          </div>
        </div>
        <div class="card">
          <h3>مساري</h3>
          <div class="kv">
            <b>المسار</b><span>${esc(track.title || track.name || '—')}</span>
          </div>
        </div>
      </div>
      <div class="card" id="prof-sub"><h3>الاشتراك</h3><div class="spinner"></div></div>`;
    loadSubscriptionCard($('#prof-sub', body));
  } catch (e) {
    fail(body, e);
  }
}

/* ─── utils ─────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(d);
  }
}

/* ─── boot (runs last, when every declaration above is initialized) ─ */
render();
