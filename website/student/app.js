'use strict';
/* ══════════════════════════════════════════════════════════════════
   بوابة الطالب — تسجيل، اشتراك، حل الدروس والتحدي اليومي،
   المحاولات، الأسئلة المحفوظة، الكتب، المتصدّرون، الإحصاءات.
   ══════════════════════════════════════════════════════════════════ */

const St = { profile: null, solve: null };

/* subscription-guarded screens fail with a domain error — offer the way out */
function guarded(view, e) {
  view.innerHTML = '';
  view.appendChild(errorCard(e));
  const b = el('<button class="btn">اذهب إلى الاشتراك</button>');
  b.onclick = () => Portal.go('subscribe');
  view.appendChild(card('<div class="row" style="justify-content:center"></div>'));
  $('.row', view.lastChild).appendChild(b);
}

/* ─── header chips ───────────────────────────────────────────────── */
async function header(node) {
  try {
    const p = await api.get('/student/profile');
    St.profile = p;
    node.innerHTML = `
      <span class="chip xp">⭐ ${p.xp ?? 0} XP</span>
      <span class="chip gem">💎 ${p.gems ?? 0}</span>
      <span class="chip">🔥 ${p.currentStreak ?? 0}</span>`;
  } catch {
    node.innerHTML = '<span class="chip bad">بلا ملف طالب</span>';
  }
}

/* ─── 1. curriculum ──────────────────────────────────────────────── */
async function screenCurriculum(view) {
  let data;
  try {
    data = await api.get('/learning/curriculum');
  } catch (e) {
    return guarded(view, e);
  }
  const tree = data.tree || [];
  view.appendChild(
    card(`
      <h2>منهجي</h2>
      <h3>التقدّم الكلّي: ${data.overallProgress ?? 0}%</h3>
      <div class="progress"><i style="width:${data.overallProgress ?? 0}%"></i></div>`),
  );
  if (!tree.length) return view.appendChild(emptyCard('لا يوجد محتوى منشور بعد.'));

  tree.forEach((course) => {
    const c = card(`
      <div class="between">
        <b>📚 ${esc(course.title)}</b><span class="muted">${course.progress ?? 0}%</span>
      </div>
      <div class="progress"><i style="width:${course.progress ?? 0}%"></i></div>`);
    (course.units || []).forEach((u) => {
      const ub = el(`
        <div class="tree-unit">
          <div class="between"><b>${esc(u.title)}</b><span class="muted">${u.progress ?? 0}%</span></div>
        </div>`);
      (u.lessons || []).forEach((l) => {
        const row = el(`
          <div class="tree-lesson">
            <span>📝 ${esc(l.name)} <span class="muted">(${l.questionLength ?? 0} سؤال)</span></span>
            <span class="row">
              <span class="badge ${l.passed ? 'good' : ''}">${l.passed ? '✓ مكتمل' : 'غير مكتمل'}</span>
              <button class="btn sm">حلّ</button>
            </span>
          </div>`);
        $('button', row).onclick = () => startLesson(l.id);
        ub.appendChild(row);
      });
      c.appendChild(ub);
    });
    view.appendChild(c);
  });
}

/* ─── 2. solving a lesson ────────────────────────────────────────── */
// every solve run (lesson, daily challenge, saved practice) shares one screen;
// the kind picks the solve endpoint and where «تم» goes back to
const SOLVE_KINDS = {
  lesson: {
    solvePath: '/learning/solving/lesson/solve',
    resultTitle: 'نتيجة الدرس',
    backScreen: 'curriculum',
  },
  daily: {
    solvePath: '/learning/solving/daily-challenge/solve',
    resultTitle: 'نتيجة التحدي اليومي',
    backScreen: 'daily',
  },
  saved: {
    solvePath: '/learning/solving/saved/solve',
    resultTitle: 'نتيجة الأسئلة المحفوظة',
    backScreen: 'saved',
  },
};

async function startLesson(lessonId) {
  toast('جارٍ تحضير الدرس…');
  try {
    const d = await api.post('/learning/solving/lesson/start', { lessonId });
    St.solve = {
      kind: 'lesson',
      snapshotId: d.snapshotId,
      title: d.lesson?.title || 'درس',
      description: d.lesson?.description,
      questions: d.questions || [],
      answers: {},
    };
    Portal.go('solve');
  } catch (e) {
    toast(e.message, 'bad');
  }
}

function screenSolve(view) {
  const s = St.solve;
  if (!s) {
    const box = card(
      '<div class="empty">اختر درساً من «منهجي» لبدء الحل، أو ابدأ التحدي اليومي.</div>',
    );
    const b = el('<button class="btn">فتح المنهج</button>');
    b.onclick = () => Portal.go('curriculum');
    box.appendChild(el('<div class="row" style="justify-content:center"></div>')).appendChild(b);
    return view.appendChild(box);
  }

  view.appendChild(
    card(`
      <h2>${esc(s.title)}</h2>
      ${s.description ? `<h3>${esc(s.description)}</h3>` : ''}
      <div class="muted">${s.questions.length} سؤال — أجب ثم اضغط تسليم</div>`),
  );
  const qs_ = el('<div></div>');
  view.appendChild(qs_);
  renderSolveQuestions(qs_, s.questions, s.answers);

  const foot = card('<div class="between"></div>');
  const cancel = el('<button class="btn ghost">إلغاء</button>');
  const submit = el('<button class="btn">تسليم الإجابات</button>');
  cancel.onclick = () => {
    St.solve = null;
    Portal.go('curriculum');
  };
  submit.onclick = async () => {
    submit.disabled = true;
    submit.textContent = 'جارٍ التصحيح…';
    try {
      const answers = collectAnswers(s.questions, s.answers);
      const path = SOLVE_KINDS[s.kind].solvePath;
      const result = await api.post(path, { snapshotId: s.snapshotId, answers });
      St.solve = null;
      const holder = $('#view');
      renderResult(holder, result, {
        title: SOLVE_KINDS[s.kind].resultTitle,
        onDone: () => Portal.go(SOLVE_KINDS[s.kind].backScreen),
      });
      header($('#hdr-extra'));
    } catch (e) {
      toast(e.message, 'bad');
      submit.disabled = false;
      submit.textContent = 'تسليم الإجابات';
    }
  };
  $('.between', foot).append(cancel, submit);
  view.appendChild(foot);
}

/* ─── 3. daily challenge ─────────────────────────────────────────── */
async function screenDaily(view) {
  const head = card(
    '<h2>🔥 التحدي اليومي</h2><h3>POST /learning/solving/daily-challenge/start — محاولة واحدة يومياً</h3>',
  );
  const start = el('<button class="btn">ابدأ تحدي اليوم</button>');
  start.onclick = async () => {
    start.disabled = true;
    try {
      const d = await api.post('/learning/solving/daily-challenge/start');
      St.solve = {
        kind: 'daily',
        snapshotId: d.snapshotId,
        title: 'التحدي اليومي',
        questions: d.questions || [],
        answers: {},
      };
      Portal.go('solve');
    } catch (e) {
      toast(e.message, 'bad');
      start.disabled = false;
    }
  };
  head.appendChild(start);
  view.appendChild(head);
  view.appendChild(
    emptyCard(
      'إن كنت قد حللت تحدي اليوم فسيرفض الخادم البدء مجدداً — راجع نتيجتك من «محاولاتي».',
    ),
  );
}

/* ─── 4. my attempts ─────────────────────────────────────────────── */
async function screenAttempts(view) {
  const state = { skip: 0, limit: 10, completed: '', lessonId: '' };
  const head = card('<h2>محاولاتي</h2><h3>GET /learning/attempts/student</h3>');
  head.appendChild(
    form(
      [
        {
          name: 'completed',
          label: 'مكتمل',
          type: 'select',
          options: [
            ['true', 'مكتمل فقط'],
            ['false', 'غير مكتمل فقط'],
          ],
        },
        { name: 'lessonId', label: 'معرّف الدرس' },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(state, { skip: 0, completed: '', lessonId: '' }, v);
          await load();
        },
      },
    ),
  );
  view.appendChild(head);

  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    let page;
    try {
      page = await api.get('/learning/attempts/student' + qs(state));
    } catch (e) {
      return guarded(view, e);
    }
    box.innerHTML = '';
    (page.list || []).forEach((a) => {
      const row = el(`
        <div class="list-row">
          <div>
            <b>${esc(a.lessonTitle || 'درس')}</b>
            <span class="badge ${a.completed ? 'good' : ''}">${a.completed ? 'مكتمل' : 'غير مكتمل'}</span>
            <div class="meta">${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0} صحيح • محاولة #${
              a.attemptNumber ?? 1
            } • +${a.xpAwarded ?? 0} XP • ${fmtDateTime(a.createdAt)}</div>
          </div>
          <button class="btn ghost sm">التفاصيل</button>
        </div>`);
      $('button', row).onclick = () => showStudentAttempt(a);
      box.appendChild(row);
    });
    if (!(page.list || []).length) box.appendChild(emptyCard('لا توجد محاولات بعد.'));
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

async function showStudentAttempt(a) {
  const body = el('<div></div>');
  body.appendChild(spinner());
  modal(`محاولة — ${a.lessonTitle || ''}`, body);
  try {
    const rows = await api.get(`/learning/attempts/student/${a.id}/questions`);
    body.innerHTML = '';
    body.appendChild(
      kv([
        ['النتيجة', `${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0}`],
        ['متروكة', a.questionsSkipped ?? 0],
        ['XP', a.xpAwarded],
        ['التاريخ', fmtDateTime(a.createdAt)],
      ]),
    );
    const review = el('<div></div>');
    renderReview(review, rows.map((r) => r.result).filter(Boolean));
    body.appendChild(review);
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(errorCard(e));
  }
}

/* ─── 5. saved questions ─────────────────────────────────────────── */
// Questions save themselves when answered wrong in a lesson; the student
// practises them one course at a time, and each solved question leaves the list.
async function screenSaved(view) {
  let courses;
  try {
    courses = (await api.get('/learning/saved-questions')) || [];
  } catch (e) {
    return guarded(view, e);
  }
  const withSaved = courses.filter((c) => (c.savedQuestionsCount || 0) > 0);
  const total = withSaved.reduce((sum, c) => sum + c.savedQuestionsCount, 0);
  view.appendChild(
    card(
      `<h2>الأسئلة المحفوظة</h2><h3>${total} سؤال — تُحفظ تلقائياً عند الخطأ وتُحذف بعد حلّها</h3>`,
    ),
  );
  if (!withSaved.length) return view.appendChild(emptyCard('لا توجد أسئلة محفوظة.'));

  withSaved.forEach((c) => {
    const box = card(
      `<h2>${esc(c.title || '')}</h2><h3>${c.savedQuestionsCount} سؤال محفوظ</h3>`,
    );
    const b = el('<button class="btn">ابدأ الحل</button>');
    b.onclick = () => startSaved(c, b);
    box.appendChild(el('<div class="row"></div>')).appendChild(b);
    view.appendChild(box);
  });
}

async function startSaved(course, btn) {
  btn.disabled = true;
  try {
    const d = await api.post('/learning/solving/saved/start', { courseId: course.id });
    St.solve = {
      kind: 'saved',
      snapshotId: d.snapshotId,
      title: `أسئلة محفوظة — ${course.title || ''}`,
      questions: d.questions || [],
      answers: {},
    };
    Portal.go('solve');
  } catch (e) {
    toast(e.message, 'bad');
    btn.disabled = false;
  }
}

/* ─── 6. books ───────────────────────────────────────────────────── */
async function screenBooks(view) {
  let list;
  try {
    list = (await api.get('/books/student')) || [];
  } catch (e) {
    return guarded(view, e);
  }
  view.appendChild(card(`<h2>الكتب</h2><h3>${list.length} كتاب من مدرستي</h3>`));
  if (!list.length) return view.appendChild(emptyCard('لا توجد كتب.'));
  list.forEach((b) =>
    view.appendChild(
      card(
        `<h2>${esc(b.name)}</h2><h3>${esc(b.lesson?.title || '')}</h3><div>${esc(b.text || '')}</div>`,
      ),
    ),
  );
}

/* ─── 7. leaderboard ─────────────────────────────────────────────── */
async function screenLeaderboard(view) {
  const state = { skip: 0, limit: 20 };
  view.appendChild(card('<h2>🏅 المتصدّرون</h2><h3>ترتيب مدرستك ومسارك حسب XP</h3>'));
  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    let page;
    try {
      page = await api.get('/learning/leaderboard/student' + qs(state));
    } catch (e) {
      return guarded(view, e);
    }
    box.innerHTML = '';
    const me = St.profile?.id;
    (page.list || []).forEach((r) => {
      const isMe = r.student?.id === me;
      box.appendChild(
        el(`
        <div class="list-row" ${isMe ? 'style="border-color:var(--brand)"' : ''}>
          <div class="row"><b>#${r.rank}</b> <b>${esc(r.student?.user?.name || 'طالب')}</b>${
            isMe ? ' <span class="muted">(أنت)</span>' : ''
          }</div>
          <span class="chip xp">⭐ ${r.xp} XP</span>
        </div>`),
      );
    });
    if (!(page.list || []).length) box.appendChild(emptyCard('لا يوجد ترتيب بعد.'));
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── 8. subscription ────────────────────────────────────────────── */
async function screenSubscribe(view) {
  const cur = card('<h2>اشتراكي الحالي</h2><h3>GET /subscription/me</h3>');
  view.appendChild(cur);
  const body = el('<div></div>');
  cur.appendChild(body);

  async function loadCurrent() {
    body.innerHTML = '';
    body.appendChild(spinner());
    try {
      const sub = await api.get('/subscription/me');
      const exp = sub?.expireDate ? new Date(sub.expireDate) : null;
      const live = exp && exp.getTime() > Date.now();
      const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400000) : null;
      body.innerHTML = '';
      body.appendChild(
        kv([
          ['النوع', sub?.type === 'freeTrial' ? 'تجربة مجانية' : sub?.type === 'paid' ? 'مدفوع' : '—'],
          ['الحالة', live ? 'فعّال' : 'منتهٍ'],
          ['ينتهي في', exp ? `${fmtDateTime(sub.expireDate)}${live ? ` (${days} يوماً متبقياً)` : ''}` : '—'],
        ]),
      );
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
    }
  }
  await loadCurrent();

  const trackList = await api.get('/curriculum/tracks');

  const grid = el('<div class="grid"></div>');
  const trial = card('<h2>🎁 تجربة مجانية</h2><h3>POST /subscription/freeTrial — مرة واحدة</h3>');
  trial.appendChild(
    form(
      [
        {
          name: 'trackId',
          label: 'المسار',
          type: 'select',
          required: true,
          full: true,
          options: trackList.map((t) => [t.id, t.name]),
        },
      ],
      {
        submitLabel: 'ابدأ التجربة',
        onSubmit: async (v) => {
          await api.post('/subscription/freeTrial', v);
          toast('تم تفعيل التجربة المجانية 🎉', 'good');
          await loadCurrent();
          header($('#hdr-extra'));
        },
      },
    ),
  );
  grid.appendChild(trial);

  const key = card('<h2>🔑 تفعيل بمفتاح</h2><h3>POST /subscription/subscribe</h3>');
  key.appendChild(
    form([{ name: 'key', label: 'المفتاح', required: true, full: true }], {
      submitLabel: 'تفعيل',
      onSubmit: async (v) => {
        await api.post('/subscription/subscribe', v);
        toast('تم تفعيل الاشتراك 🎉', 'good');
        await loadCurrent();
        header($('#hdr-extra'));
      },
    }),
  );
  grid.appendChild(key);
  view.appendChild(grid);
}

/* ─── 9. profile + statistics ────────────────────────────────────── */
async function screenProfile(view) {
  let p;
  try {
    p = await api.get('/student/profile');
    St.profile = p;
  } catch (e) {
    view.appendChild(errorCard(e));
    view.appendChild(
      emptyCard('لا يوجد ملف طالب بعد — فعّل اشتراكاً أو تجربة مجانية لإنشائه.'),
    );
    return;
  }

  view.appendChild(
    card(`
      <h2>${esc(p.user?.name || Session.user.name || 'طالب')}</h2>
      <h3>${esc(p.user?.email || Session.user.email || '')}</h3>`),
  );
  view.appendChild(
    kv([
      ['المدرسة', p.school?.name],
      ['المسار', p.track?.name],
      ['الحالة', p.active ? 'نشط' : 'موقوف'],
      ['السلسلة الحالية', p.currentStreak],
      ['أطول سلسلة', p.longestStreak],
      ['XP', p.xp],
      ['الجواهر', p.gems],
    ]),
  );

  const statsBox = card('<h2>إحصاءاتي</h2><h3>GET /student/statistics</h3>');
  view.appendChild(statsBox);
  try {
    const s = await api.get('/student/statistics');
    statsBox.appendChild(
      statGrid([
        ['XP', s.xp],
        ['الجواهر', s.gems],
        ['الترتيب', s.rank],
        ['الدقّة %', s.accuracy],
        ['دروس مكتملة', s.completedLessons],
        ['السلسلة', `${s.streak?.current ?? 0} / ${s.streak?.longest ?? 0}`],
      ]),
    );
    if (s.weeklyActivity)
      statsBox.appendChild(
        statGrid(s.weeklyActivity.map((d) => [d.day, d.lessons])),
      );
  } catch (e) {
    statsBox.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }
}

/* ─── boot ───────────────────────────────────────────────────────── */
Portal.start({
  key: 'student',
  name: 'بوابة الطالب',
  subtitle: 'سجّل دخولك أو أنشئ حساباً جديداً',
  role: 'student',
  signup: true,
  header,
  tabs: [
    { k: 'curriculum', label: 'منهجي', render: screenCurriculum },
    { k: 'solve', label: 'حل درس', render: screenSolve },
    { k: 'daily', label: 'التحدي اليومي', render: screenDaily },
    { k: 'attempts', label: 'محاولاتي', render: screenAttempts },
    { k: 'saved', label: 'المحفوظة', render: screenSaved },
    { k: 'books', label: 'الكتب', render: screenBooks },
    { k: 'leaderboard', label: 'المتصدّرون', render: screenLeaderboard },
    { k: 'subscribe', label: 'الاشتراك', render: screenSubscribe },
    { k: 'profile', label: 'ملفّي', render: screenProfile },
    { k: 'public', label: 'عن التطبيق', render: publicContentScreen },
    { k: 'notif', label: 'الإشعارات', render: (v) => notificationsScreen(v) },
    { k: 'account', label: 'حسابي', render: accountScreen },
  ],
});
