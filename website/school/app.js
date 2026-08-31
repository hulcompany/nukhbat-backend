'use strict';
/* ══════════════════════════════════════════════════════════════════
   بوابة المدرسة (contentWriter) — كل ما يملكه مالك المدرسة:
   المنهج، الأسئلة، التحدي اليومي، الكتب، الطلاب، المفاتيح،
   المحاولات، المتصدّرون، الإحصاءات.
   ══════════════════════════════════════════════════════════════════ */

const School = { me: null, trackList: [] };

async function loadSchool(force) {
  if (!School.me || force) {
    School.me = await api.get('/school/me');
    School.trackList =
      School.me.allowedTracks ||
      School.me.tracks ||
      (School.me.schoolAccess || []).map((a) => a.track) ||
      [];
    School.trackList = School.trackList.filter(Boolean);
  }
  return School.me;
}
const trackOptions = () => School.trackList.map((t) => [t.id, t.name]);

/* the picked track is shared across screens */
const Picked = { trackId: null, courseId: null, unitId: null, lessonId: null };

function trackPicker(onChange, { label = 'المسار' } = {}) {
  if (!School.trackList.length)
    return el(
      '<div class="card empty">لا يوجد مسار مسموح لمدرستك — اطلب من الإدارة منح صلاحية مسار (POST /school-access).</div>',
    );
  if (!Picked.trackId) Picked.trackId = School.trackList[0].id;
  const wrap = el(`
    <label class="field"><span>${esc(label)}</span>
      <select>${School.trackList
        .map(
          (t) =>
            `<option value="${t.id}"${t.id === Picked.trackId ? ' selected' : ''}>${esc(t.name)}</option>`,
        )
        .join('')}</select></label>`);
  $('select', wrap).onchange = (e) => {
    Picked.trackId = e.target.value;
    Picked.courseId = Picked.unitId = Picked.lessonId = null;
    onChange(Picked.trackId);
  };
  return wrap;
}

/* ─── 1. school profile + statistics ─────────────────────────────── */
async function screenSchool(view) {
  const me = await loadSchool(true);

  const head = card(`
    <div class="between">
      <div>
        <h2>${esc(me.name)}</h2>
        <h3>المالك: ${esc(me.owner?.name || '—')} • ${esc(me.owner?.email || '')}</h3>
      </div>
      ${me.logo ? `<img src="${fileUrl(me.logo)}" style="max-height:64px;border-radius:12px"/>` : ''}
    </div>`);
  view.appendChild(head);

  const stats = card('<h2>إحصاءات المدرسة</h2><h3>GET /school/me/statistics</h3>');
  view.appendChild(stats);
  const s = await api.get('/school/me/statistics');
  stats.appendChild(
    statGrid([
      ['إجمالي الطلاب', s.totalStudents],
      ['طلاب نشطون', s.activeStudents],
      ['طلاب موقوفون', s.blockedStudents],
      ['اشتراكات فعّالة', s.activeSubscriptions],
      ['اشتراكات منتهية', s.expiredSubscriptions],
      ['مفاتيح غير مستخدمة', s.unusedKeys],
      ['فتحوا اليوم', s.openedTodayStudents],
      ['لم يفتحوا اليوم', s.notOpenedTodayStudents],
    ]),
  );

  const tracksBox = card('<h2>المسارات المسموحة</h2><h3>تُمنح من لوحة الإدارة</h3>');
  tracksBox.appendChild(
    School.trackList.length
      ? el(
          '<div class="row">' +
            School.trackList.map((t) => `<span class="badge good">${esc(t.name)}</span>`).join('') +
            '</div>',
        )
      : el('<div class="muted">لا يوجد مسار مسموح بعد.</div>'),
  );
  view.appendChild(tracksBox);

  const edit = card('<h2>تعديل المدرسة</h2><h3>PATCH /school/me (multipart)</h3>');
  edit.appendChild(
    form(
      [
        { name: 'name', label: 'اسم المدرسة', value: me.name },
        { name: 'image', label: 'الشعار', type: 'file' },
      ],
      {
        submitLabel: 'حفظ',
        onSubmit: async (v) => {
          await api.patchForm('/school/me', toFormData(v));
          toast('تم الحفظ', 'good');
          await loadSchool(true);
          Portal.reload();
        },
        extraButtons: [
          (() => {
            const b = el('<button type="button" class="btn ghost">حذف الشعار</button>');
            b.onclick = () =>
              confirmDialog('حذف شعار المدرسة؟', async () => {
                await api.del('/school/me/image');
                toast('تم الحذف', 'good');
                await loadSchool(true);
                Portal.reload();
              });
            return b;
          })(),
        ],
      },
    ),
  );
  view.appendChild(edit);

  const activity = card('<h2>نشاط الطلاب هذا الأسبوع</h2><h3>GET /student/school/aggregate/activity</h3>');
  view.appendChild(activity);
  const act = await api.get('/student/school/aggregate/activity');
  activity.appendChild(el(`<div class="muted">${esc(act.weekStart)} → ${esc(act.weekEnd)}</div>`));
  activity.appendChild(statGrid((act.week || []).map((d) => [d.date, d.openedStudents])));

  const subsAgg = card('<h2>الاشتراكات المستهلكة شهرياً</h2><h3>GET /subscription/school/aggregate/subscriptions</h3>');
  view.appendChild(subsAgg);
  const agg = await api.get('/subscription/school/aggregate/subscriptions');
  const rows = Array.isArray(agg) ? agg : agg?.months || [];
  subsAgg.appendChild(
    rows.length
      ? statGrid(rows.map((r) => [r.month ?? r.date ?? '—', r.count ?? r.total ?? 0]))
      : el(`<pre class="json">${esc(JSON.stringify(agg, null, 2))}</pre>`),
  );
}

/* ─── 2. curriculum: tree + units + lessons CRUD ─────────────────── */
async function screenCurriculum(view) {
  await loadSchool();
  const head = card('<h2>المنهج</h2><h3>الدورات تأتي من المسار — الوحدات والدروس ملك مدرستك</h3>');
  head.appendChild(trackPicker(() => Portal.reload()));
  view.appendChild(head);
  if (!School.trackList.length) return;

  /* full tree */
  const treeBox = card('<h2>الشجرة الكاملة</h2><h3>GET /curriculum/school/tree/:trackId — الدروس المنشورة فقط</h3>');
  view.appendChild(treeBox);
  try {
    const tree = await api.get('/curriculum/school/tree/' + Picked.trackId);
    if (!tree.length) treeBox.appendChild(el('<div class="empty">لا يوجد محتوى منشور بعد.</div>'));
    tree.forEach((course) => {
      const c = el(`<div style="margin-bottom:10px"><b>📚 ${esc(course.title)}</b></div>`);
      (course.units || []).forEach((u) => {
        const ub = el(`<div class="tree-unit"><b>${esc(u.title)}</b> <span class="muted">#${u.index}</span></div>`);
        (u.lessons || []).forEach((l) =>
          ub.appendChild(
            el(
              `<div class="tree-lesson"><span>📝 ${esc(l.title)}</span><span class="row"><span class="muted">#${l.index}</span>${
                l.used ? '<span class="badge warn">مستخدم</span>' : ''
              }</span></div>`,
            ),
          ),
        );
        c.appendChild(ub);
      });
      treeBox.appendChild(c);
    });
  } catch (e) {
    treeBox.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }

  /* courses → units → lessons */
  const courses = await api.get(`/curriculum/school/courses/${Picked.trackId}`);
  if (!Picked.courseId && courses.length) Picked.courseId = courses[0].id;

  const courseBox = card('<h2>الدورات</h2><h3>GET /curriculum/school/courses/:trackId</h3>');
  const courseSel = el(`
    <label class="field"><span>الدورة</span>
      <select>${courses
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === Picked.courseId ? ' selected' : ''}>${esc(c.title)}</option>`,
        )
        .join('')}</select></label>`);
  $('select', courseSel).onchange = (e) => {
    Picked.courseId = e.target.value;
    Picked.unitId = null;
    Portal.reload();
  };
  courseBox.appendChild(courseSel);
  view.appendChild(courseBox);
  if (!Picked.courseId) return;

  /* units */
  const units = await api.get(`/curriculum/school/units/${Picked.courseId}`);
  const unitBox = card('<h2>الوحدات</h2><h3>GET/POST/PATCH/DELETE /curriculum/school/units</h3>');
  unitBox.appendChild(
    form([{ name: 'title', label: 'وحدة جديدة', required: true }], {
      submitLabel: '+ إضافة وحدة',
      onSubmit: async (v) => {
        await api.post('/curriculum/school/units', { title: v.title, courseId: Picked.courseId });
        toast('تمت إضافة الوحدة', 'good');
        Portal.reload();
      },
    }),
  );
  const sortedUnits = [...units].sort((a, b) => a.index - b.index);
  sortedUnits.forEach((u, i) => {
    const row = el(`
      <div class="list-row">
        <div><b>${esc(u.title)}</b> <span class="meta">#${u.index} • ${shortId(u.id)}</span></div>
        <div class="row"></div>
      </div>`);
    if (u.id === Picked.unitId) row.style.borderColor = 'var(--brand)';
    $('.row', row).appendChild(
      btnRow([
        [
          'الدروس',
          () => {
            Picked.unitId = u.id;
            Portal.reload();
          },
        ],
        [
          'إعادة تسمية',
          () => {
            const f = form([{ name: 'title', label: 'العنوان', value: u.title, required: true, full: true }], {
              submitLabel: 'حفظ',
              onSubmit: async (v) => {
                await api.patch('/curriculum/school/units/' + u.id, v);
                toast('تم', 'good');
                m.close();
                Portal.reload();
              },
            });
            const m = modal('تعديل الوحدة', f);
          },
        ],
        [
          '▲',
          async () => {
            if (i === 0) return;
            const ids = sortedUnits.map((x) => x.id);
            [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
            await api.post(`/curriculum/school/units/order/${Picked.courseId}`, { ids });
            toast('تم تغيير الترتيب', 'good');
            Portal.reload();
          },
        ],
        [
          '▼',
          async () => {
            if (i === sortedUnits.length - 1) return;
            const ids = sortedUnits.map((x) => x.id);
            [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
            await api.post(`/curriculum/school/units/order/${Picked.courseId}`, { ids });
            toast('تم تغيير الترتيب', 'good');
            Portal.reload();
          },
        ],
        [
          'حذف',
          () =>
            confirmDialog('حذف الوحدة وكل دروسها؟', async () => {
              await api.del('/curriculum/school/units/' + u.id);
              toast('تم الحذف', 'good');
              Picked.unitId = null;
              Portal.reload();
            }),
          'danger',
        ],
      ]),
    );
    unitBox.appendChild(row);
  });
  if (!sortedUnits.length) unitBox.appendChild(el('<div class="empty">لا توجد وحدات.</div>'));
  view.appendChild(unitBox);

  if (!Picked.unitId) return;

  /* lessons */
  const lessons = await api.get(`/curriculum/school/lessons/${Picked.unitId}`);
  const meta = await api.get('/curriculum/metaData');
  const lessonBox = card('<h2>الدروس</h2><h3>GET/POST/PATCH/DELETE /curriculum/school/lessons</h3>');
  lessonBox.appendChild(
    form(
      [
        { name: 'title', label: 'عنوان الدرس', required: true },
        { name: 'description', label: 'الوصف' },
      ],
      {
        submitLabel: '+ إضافة درس',
        onSubmit: async (v) => {
          await api.post('/curriculum/school/lessons', { ...v, unitId: Picked.unitId });
          toast('تمت إضافة الدرس', 'good');
          Portal.reload();
        },
      },
    ),
  );
  const sortedLessons = [...lessons].sort((a, b) => a.index - b.index);
  sortedLessons.forEach((l, i) => {
    const row = el(`
      <div class="list-row">
        <div>
          <b>${esc(l.title)}</b>
          <span class="badge ${l.status === 'published' ? 'good' : 'warn'}">${esc(l.status)}</span>
          ${l.used ? '<span class="badge warn">مستخدم — لا يمكن تعديل أسئلته</span>' : ''}
          <div class="meta">${esc(l.description || '')} • #${l.index} • ${shortId(l.id)}</div>
        </div>
        <div class="row"></div>
      </div>`);
    $('.row', row).appendChild(
      btnRow([
        [
          'الأسئلة',
          () => {
            Picked.lessonId = l.id;
            Portal.go('questions');
          },
        ],
        [
          'تعديل',
          () => {
            const f = form(
              [
                { name: 'title', label: 'العنوان', value: l.title },
                { name: 'description', label: 'الوصف', value: l.description },
                {
                  name: 'status',
                  label: 'الحالة',
                  type: 'select',
                  value: l.status,
                  required: true,
                  options: meta.lessonStatusType || ['draft', 'published'],
                },
              ],
              {
                submitLabel: 'حفظ',
                onSubmit: async (v) => {
                  await api.patch('/curriculum/school/lessons/' + l.id, v);
                  toast('تم الحفظ', 'good');
                  m.close();
                  Portal.reload();
                },
              },
            );
            const m = modal('تعديل الدرس', f);
          },
        ],
        [
          '▲',
          async () => {
            if (i === 0) return;
            const ids = sortedLessons.map((x) => x.id);
            [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
            await api.post(`/curriculum/school/lessons/order/${Picked.unitId}`, { ids });
            toast('تم تغيير الترتيب', 'good');
            Portal.reload();
          },
        ],
        [
          '▼',
          async () => {
            if (i === sortedLessons.length - 1) return;
            const ids = sortedLessons.map((x) => x.id);
            [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
            await api.post(`/curriculum/school/lessons/order/${Picked.unitId}`, { ids });
            toast('تم تغيير الترتيب', 'good');
            Portal.reload();
          },
        ],
        [
          'حذف',
          () =>
            confirmDialog('حذف الدرس؟', async () => {
              await api.del('/curriculum/school/lessons/' + l.id);
              toast('تم الحذف', 'good');
              Portal.reload();
            }),
          'danger',
        ],
      ]),
    );
    lessonBox.appendChild(row);
  });
  if (!sortedLessons.length) lessonBox.appendChild(el('<div class="empty">لا توجد دروس.</div>'));
  view.appendChild(lessonBox);
}

/* ─── 3. questions ───────────────────────────────────────────────── */
async function screenQuestions(view) {
  await loadSchool();
  const head = card(
    '<h2>الأسئلة</h2><h3>GET /curriculum/school/questions — يجب تحديد درس <b>أو</b> دورة (وليس كليهما)</h3>',
  );
  head.appendChild(trackPicker(() => Portal.reload()));
  view.appendChild(head);
  if (!School.trackList.length) return;

  const courses = await api.get(`/curriculum/school/courses/${Picked.trackId}`);
  if (!Picked.courseId && courses.length) Picked.courseId = courses[0].id;

  /* build the lesson list of the picked course, for the scope selector
     and for the authoring form */
  const units = Picked.courseId
    ? await api.get(`/curriculum/school/units/${Picked.courseId}`)
    : [];
  const lessonGroups = await Promise.all(
    units.map((u) =>
      api
        .get(`/curriculum/school/lessons/${u.id}`)
        .then((ls) => ls.map((l) => ({ ...l, unitTitle: u.title })))
        .catch(() => []),
    ),
  );
  const lessons = lessonGroups.flat();

  const scope = { mode: 'lesson' };
  const scopeBox = card('<h3>نطاق العرض</h3>');
  scopeBox.appendChild(
    el(`
    <div class="form-grid">
      <label class="field"><span>الدورة</span>
        <select id="q-course">${courses
          .map(
            (c) => `<option value="${c.id}"${c.id === Picked.courseId ? ' selected' : ''}>${esc(c.title)}</option>`,
          )
          .join('')}</select></label>
      <label class="field"><span>النطاق</span>
        <select id="q-mode">
          <option value="lesson">أسئلة درس</option>
          <option value="course">مخزون التحدي اليومي (الدورة)</option>
        </select></label>
      <label class="field" id="q-lesson-wrap"><span>الدرس</span>
        <select id="q-lesson">${lessons
          .map(
            (l) =>
              `<option value="${l.id}"${l.id === Picked.lessonId ? ' selected' : ''}>${esc(l.unitTitle)} › ${esc(l.title)}</option>`,
          )
          .join('')}</select></label>
      <label class="field"><span>العنوان يحوي</span><input id="q-title"/></label>
    </div>`),
  );
  view.appendChild(scopeBox);
  if (!Picked.lessonId && lessons.length) Picked.lessonId = lessons[0].id;
  $('#q-lesson', scopeBox).value = Picked.lessonId || '';

  $('#q-course', scopeBox).onchange = (e) => {
    Picked.courseId = e.target.value;
    Picked.lessonId = null;
    Portal.reload();
  };
  $('#q-mode', scopeBox).onchange = (e) => {
    scope.mode = e.target.value;
    $('#q-lesson-wrap', scopeBox).style.display = scope.mode === 'lesson' ? '' : 'none';
    load();
  };
  $('#q-lesson', scopeBox).onchange = (e) => {
    Picked.lessonId = e.target.value;
    load();
  };
  $('#q-title', scopeBox).onchange = () => load();

  /* authoring */
  const authorBox = card('<h2>سؤال جديد</h2><h3>POST /curriculum/school/questions (JSON)</h3>');
  authorBox.appendChild(
    questionBuilder({
      lessons: lessons.map((l) => ({ id: l.id, title: `${l.unitTitle} › ${l.title}` })),
      courses: courses.map((c) => ({ id: c.id, title: c.title })),
      onCreate: async (dto) => {
        await api.post('/curriculum/school/questions', dto);
        toast('تم إنشاء السؤال', 'good');
        load();
      },
    }),
  );
  view.appendChild(authorBox);

  const bulkBox = card('<h2>إنشاء جماعي</h2><h3>POST /curriculum/school/questions/bulk — مصفوفة QuestionCreateDto</h3>');
  bulkBox.appendChild(
    form(
      [
        {
          name: 'questions',
          label: 'JSON',
          type: 'json',
          required: true,
          full: true,
          placeholder:
            '[{"title":"…","type":"trueFalse","purpose":"lesson","lessonId":"…","correctAnswer":true}]',
        },
      ],
      {
        submitLabel: 'إنشاء الكل',
        onSubmit: async (v) => {
          const questions = Array.isArray(v.questions) ? v.questions : [v.questions];
          await api.post('/curriculum/school/questions/bulk', { questions });
          toast(`تم إنشاء ${questions.length} سؤالاً`, 'good');
          load();
        },
      },
    ),
  );
  view.appendChild(bulkBox);

  const listBox = el('<div></div>');
  view.appendChild(listBox);
  const selected = new Set();

  async function load() {
    listBox.innerHTML = '';
    listBox.appendChild(spinner());
    const params = { title: $('#q-title', scopeBox).value.trim() || undefined, limit: 50 };
    if (scope.mode === 'lesson') {
      if (!Picked.lessonId) {
        listBox.innerHTML = '';
        listBox.appendChild(emptyCard('اختر درساً أولاً.'));
        return;
      }
      params.lessonId = Picked.lessonId;
    } else {
      params.courseId = Picked.courseId;
    }
    let page;
    try {
      page = await api.get('/curriculum/school/questions' + qs(params));
    } catch (e) {
      listBox.innerHTML = '';
      listBox.appendChild(errorCard(e));
      return;
    }
    const list = page.list || [];
    listBox.innerHTML = '';
    const box = card(`<h2>الأسئلة (${page.totalRecords ?? list.length})</h2>`);
    const bulkBar = el(
      '<div class="row" style="margin-bottom:8px"><button class="btn danger sm" id="qb-del">حذف المحدّد</button></div>',
    );
    $('#qb-del', bulkBar).onclick = () => {
      if (!selected.size) return toast('لم تحدّد أسئلة', 'bad');
      confirmDialog(`حذف ${selected.size} سؤالاً؟`, async () => {
        await api.post('/curriculum/school/questions/bulk-delete', { ids: [...selected] });
        selected.clear();
        toast('تم الحذف', 'good');
        load();
      });
    };
    box.appendChild(bulkBar);
    box.appendChild(
      table(
        [
          {
            label: '#',
            render: (q) => {
              const cb = el('<input type="checkbox"/>');
              cb.checked = selected.has(q.id);
              cb.onchange = () => (cb.checked ? selected.add(q.id) : selected.delete(q.id));
              return cb;
            },
          },
          { label: 'السؤال', wrap: true, render: (q) => esc(q.title) },
          { label: 'النوع', render: (q) => qTypeLabel(q.type) },
          { label: 'الغرض', render: (q) => esc(q.purpose) },
          { label: 'تلميحات', render: (q) => (q.tips || []).length },
          { label: 'شرح', render: (q) => (q.verdictText ? '✓' : '—') },
          {
            label: '',
            render: (q) =>
              btnRow([
                [
                  'معاينة',
                  async () => {
                    const full = await api.get('/curriculum/school/questions/' + q.id);
                    modal('السؤال', questionPreview(full));
                  },
                ],
                ['تعديل', () => editQuestion(q, load)],
                [
                  'حذف',
                  () =>
                    confirmDialog('حذف السؤال؟', async () => {
                      await api.del('/curriculum/school/questions/' + q.id);
                      toast('تم الحذف', 'good');
                      load();
                    }),
                  'danger',
                ],
              ]),
          },
        ],
        list,
        { empty: 'لا توجد أسئلة في هذا النطاق.' },
      ),
    );
    listBox.appendChild(box);
  }
  await load();
}

/* PATCH question — the DTO whitelists title + tips + verdictText (image via multipart) */
function editQuestion(q, done) {
  const f = form(
    [
      { name: 'title', label: 'نص السؤال', value: q.title, full: true },
      {
        name: 'tips',
        label: 'التلميحات (مفصولة بفواصل)',
        type: 'tags',
        value: (q.tips || []).join(', '),
        full: true,
      },
      {
        name: 'verdictText',
        label: 'شرح الإجابة (بعد التصحيح)',
        type: 'textarea',
        value: q.verdictText || '',
        hint: 'أفرغ الحقل لحذف الشرح (لا يُحذف عند رفع صورة في نفس الطلب).',
        full: true,
      },
      { name: 'image', label: 'صورة السؤال', type: 'file', full: true },
    ],
    {
      submitLabel: 'حفظ',
      onSubmit: async (v) => {
        // an emptied box is dropped by readForm — send an explicit null so the
        // school can clear the explanation
        if (q.verdictText && v.verdictText === undefined) v.verdictText = null;
        if (v.image) {
          await api.patchForm('/curriculum/school/questions/' + q.id, toFormData(v));
        } else {
          await api.patch('/curriculum/school/questions/' + q.id, v);
        }
        toast('تم الحفظ', 'good');
        m.close();
        done();
      },
    },
  );
  const m = modal('تعديل السؤال', f);
}

/* ─── 4. daily challenge ─────────────────────────────────────────── */
async function screenDailyChallenge(view) {
  await loadSchool();
  const head = card(
    '<h2>التحدي اليومي</h2><h3>GET /curriculum/school/daily-challenge — تحدٍّ واحد لكل (مدرسة، مسار) يومياً</h3>',
  );
  const create = el('<button class="btn">توليد تحدي اليوم</button>');
  create.onclick = async () => {
    create.disabled = true;
    try {
      const res = await api.post('/curriculum/school/daily-challenge');
      toast('تم التوليد (العملية غير تكرارية — آمنة للإعادة)', 'good');
      jsonModal('نتيجة التوليد', res);
      Portal.reload();
    } catch (e) {
      toast(e.message, 'bad');
    }
    create.disabled = false;
  };
  head.appendChild(create);
  view.appendChild(head);

  const data = await api.get('/curriculum/school/daily-challenge');
  const challenges = data.challenges || [];
  const unUsed = data.unUsedQuestions || [];

  const pool = card('<h2>مخزون الأسئلة المتبقّي</h2><h3>أسئلة الغرض dailyChallenge لكل دورة</h3>');
  pool.appendChild(
    table(
      [
        { label: 'المسار', render: (r) => esc(r.trackName) },
        { label: 'الدورة', render: (r) => esc(r.courseName) },
        {
          label: 'أسئلة متبقّية',
          render: (r) =>
            `<span class="badge ${r.remainingQuestions > 0 ? 'good' : 'bad'}">${r.remainingQuestions}</span>`,
        },
      ],
      unUsed,
      { empty: 'لا يوجد مخزون — أضف أسئلة بغرض «التحدي اليومي».' },
    ),
  );
  view.appendChild(pool);

  if (!challenges.length) {
    view.appendChild(emptyCard('لا يوجد تحدٍّ لليوم بعد — اضغط «توليد تحدي اليوم».'));
    return;
  }
  challenges.forEach((ch) => {
    const box = card(
      `<h2>تحدي ${esc(ch.date)}</h2><h3>المسار: ${esc(ch.track?.name || '—')} • ${(ch.usedQuestions || []).length} سؤال</h3>`,
    );
    (ch.usedQuestions || []).forEach((u) => {
      if (u.question) box.appendChild(questionPreview(u.question));
    });
    view.appendChild(box);
  });
}

/* ─── 5. books ───────────────────────────────────────────────────── */
async function screenBooks(view) {
  await loadSchool();
  const head = card('<h2>الكتب</h2><h3>/books/school — كل كتاب مرتبط بدرس</h3>');
  head.appendChild(trackPicker(() => Portal.reload()));
  view.appendChild(head);

  /* every lesson of the picked track, for the lesson selector */
  const courses = School.trackList.length
    ? await api.get(`/curriculum/school/courses/${Picked.trackId}`)
    : [];
  const lessons = [];
  for (const c of courses) {
    const units = await api.get(`/curriculum/school/units/${c.id}`);
    for (const u of units) {
      const ls = await api.get(`/curriculum/school/lessons/${u.id}`).catch(() => []);
      ls.forEach((l) => lessons.push({ id: l.id, title: `${c.title} › ${u.title} › ${l.title}` }));
    }
  }

  const create = card('<h2>كتاب جديد</h2><h3>POST /books/school</h3>');
  create.appendChild(
    form(
      [
        { name: 'name', label: 'الاسم', required: true },
        {
          name: 'lessonId',
          label: 'الدرس',
          type: 'select',
          required: true,
          options: lessons.map((l) => [l.id, l.title]),
        },
        { name: 'text', label: 'المحتوى', type: 'textarea', required: true, full: true },
      ],
      {
        submitLabel: 'إضافة',
        onSubmit: async (v) => {
          await api.post('/books/school', v);
          toast('تمت الإضافة', 'good');
          await load();
        },
      },
    ),
  );
  view.appendChild(create);

  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    const list = (await api.get('/books/school')) || [];
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'الاسم', render: (b) => esc(b.name) },
          { label: 'الدرس', render: (b) => esc(b.lesson?.title || '—') },
          { label: 'المحتوى', wrap: true, render: (b) => esc(String(b.text || '').slice(0, 120)) },
          {
            label: '',
            render: (b) =>
              btnRow([
                [
                  'تعديل',
                  () => {
                    const f = form(
                      [
                        { name: 'name', label: 'الاسم', value: b.name },
                        { name: 'text', label: 'المحتوى', type: 'textarea', value: b.text, full: true },
                      ],
                      {
                        submitLabel: 'حفظ',
                        onSubmit: async (v) => {
                          await api.patch('/books/school/' + b.id, v);
                          toast('تم الحفظ', 'good');
                          m.close();
                          load();
                        },
                      },
                    );
                    const m = modal('تعديل الكتاب', f);
                  },
                ],
                [
                  'حذف',
                  () =>
                    confirmDialog('حذف الكتاب؟', async () => {
                      await api.del('/books/school/' + b.id);
                      toast('تم الحذف', 'good');
                      load();
                    }),
                  'danger',
                ],
              ]),
          },
        ],
        list,
        { empty: 'لا توجد كتب.' },
      ),
    );
  }
  await load();
}

/* ─── 6. students ────────────────────────────────────────────────── */
async function screenStudents(view) {
  await loadSchool();
  const state = { skip: 0, limit: 10, name: '', trackId: '' };

  const head = card('<h2>طلاب مدرستي</h2><h3>GET /student/school</h3>');
  head.appendChild(
    form(
      [
        { name: 'name', label: 'الاسم' },
        { name: 'trackId', label: 'المسار', type: 'select', options: trackOptions() },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(state, { skip: 0, name: '', trackId: '' }, v);
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
    const page = await api.get('/student/school' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'الطالب', render: (s) => esc(s.user?.name || '—') },
          { label: 'البريد', render: (s) => esc(s.user?.email || '—') },
          { label: 'المسار', render: (s) => esc(s.track?.name || '—') },
          { label: 'XP', render: (s) => `<span class="chip xp">${s.xp ?? 0}</span>` },
          { label: 'جواهر', render: (s) => `<span class="chip gem">${s.gems ?? 0}</span>` },
          { label: 'السلسلة', render: (s) => `${s.currentStreak ?? 0} / ${s.longestStreak ?? 0}` },
          {
            label: 'الحالة',
            render: (s) =>
              s.active ? '<span class="badge good">نشط</span>' : '<span class="badge bad">موقوف</span>',
          },
          {
            label: '',
            render: (s) =>
              btnRow([
                [
                  'تفاصيل',
                  async () => jsonModal('student', await api.get('/student/school/' + s.id)),
                ],
                [
                  s.active ? 'إيقاف' : 'تفعيل',
                  async () => {
                    await api.patch('/student/school/activation/' + s.id, { active: !s.active });
                    toast('تم التحديث', 'good');
                    load();
                  },
                  s.active ? 'danger' : 'ok',
                ],
                [
                  'محاولاته',
                  () => {
                    Picked.studentId = s.id;
                    Portal.go('attempts');
                  },
                ],
              ]),
          },
        ],
        page.list || [],
        { empty: 'لا يوجد طلاب.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── 7. subscription keys ───────────────────────────────────────── */
async function screenKeys(view) {
  await loadSchool();
  const state = { skip: 0, limit: 10, trackId: '' };

  const head = card(
    '<h2>مفاتيح الاشتراك</h2><h3>GET /subscription/keys/school — التوليد من صلاحية الإدارة فقط</h3>',
  );
  head.appendChild(
    form([{ name: 'trackId', label: 'المسار', type: 'select', options: trackOptions() }], {
      submitLabel: 'بحث',
      onSubmit: async (v) => {
        Object.assign(state, { skip: 0, trackId: '' }, v);
        await load();
      },
    }),
  );
  view.appendChild(head);

  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    const page = await api.get('/subscription/keys/school' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'المفتاح', render: (k) => `<span class="mono">${esc(k.key)}</span>` },
          { label: 'المسار', render: (k) => esc(k.track?.name || shortId(k.trackId)) },
          {
            label: 'الحالة',
            render: (k) =>
              k.usedById ? '<span class="badge bad">مستخدم</span>' : '<span class="badge good">متاح</span>',
          },
          { label: 'أُنشئ', render: (k) => fmtDate(k.createdAt) },
        ],
        page.list || [],
        { empty: 'لا توجد مفاتيح — اطلب من الإدارة توليدها.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── 8. attempts ────────────────────────────────────────────────── */
async function screenAttempts(view) {
  await loadSchool();
  const state = {
    skip: 0,
    limit: 10,
    studentId: Picked.studentId || '',
    completed: '',
    lessonId: '',
  };

  const head = card('<h2>محاولات الطلاب</h2><h3>GET /learning/attempts/school</h3>');
  head.appendChild(
    form(
      [
        { name: 'studentId', label: 'معرّف الطالب', value: state.studentId },
        { name: 'lessonId', label: 'معرّف الدرس' },
        {
          name: 'completed',
          label: 'مكتمل',
          type: 'select',
          options: [
            ['true', 'مكتمل فقط'],
            ['false', 'غير مكتمل فقط'],
          ],
        },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(state, { skip: 0, studentId: '', lessonId: '', completed: '' }, v);
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
    const page = await api.get('/learning/attempts/school' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'الطالب', render: (a) => esc(a.student?.user?.name || shortId(a.studentId)) },
          { label: 'الدرس', render: (a) => esc(a.lessonTitle || '—') },
          { label: 'النتيجة', render: (a) => `${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0}` },
          { label: 'المحاولة', render: (a) => '#' + (a.attemptNumber ?? 1) },
          {
            label: 'مكتمل',
            render: (a) =>
              a.completed ? '<span class="badge good">نعم</span>' : '<span class="badge">لا</span>',
          },
          { label: 'XP', render: (a) => a.xpAwarded ?? 0 },
          { label: 'التاريخ', render: (a) => fmtDateTime(a.createdAt) },
          {
            label: '',
            render: (a) =>
              btnRow([['التفاصيل', () => showAttempt(a, '/learning/attempts/school')]]),
          },
        ],
        page.list || [],
        { empty: 'لا توجد محاولات.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* shared by both portals: per-question review of one attempt */
async function showAttempt(a, base) {
  const body = el('<div></div>');
  body.appendChild(spinner());
  const m = modal(`محاولة — ${a.lessonTitle || ''}`, body);
  try {
    const rows = await api.get(`${base}/${a.id}/questions`);
    body.innerHTML = '';
    body.appendChild(
      kv([
        ['النتيجة', `${a.questionsCorrect ?? 0}/${a.questionsTotal ?? 0}`],
        ['متروكة', a.questionsSkipped ?? 0],
        ['رقم المحاولة', a.attemptNumber],
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
  return m;
}

/* ─── 9. leaderboard ─────────────────────────────────────────────── */
async function screenLeaderboard(view) {
  await loadSchool();
  const head = card('<h2>المتصدّرون</h2><h3>GET /learning/leaderboard/school?trackId</h3>');
  head.appendChild(trackPicker(() => Portal.reload()));
  view.appendChild(head);
  if (!School.trackList.length) return;

  const state = { skip: 0, limit: 20, trackId: Picked.trackId };
  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    state.trackId = Picked.trackId;
    box.innerHTML = '';
    box.appendChild(spinner());
    const page = await api.get('/learning/leaderboard/school' + qs(state));
    box.innerHTML = '';
    (page.list || []).forEach((r) =>
      box.appendChild(
        el(`
        <div class="list-row">
          <div class="row"><b>#${r.rank}</b> <b>${esc(r.student?.user?.name || '—')}</b></div>
          <span class="chip xp">⭐ ${r.xp} XP</span>
        </div>`),
      ),
    );
    if (!(page.list || []).length) box.appendChild(emptyCard('لا يوجد ترتيب بعد.'));
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── boot ───────────────────────────────────────────────────────── */
Portal.start({
  key: 'school',
  name: 'بوابة المدرسة',
  subtitle: 'دخول بحساب contentWriter',
  role: 'contentWriter',
  tabs: [
    { k: 'school', label: 'مدرستي', render: screenSchool },
    { k: 'curriculum', label: 'المنهج', render: screenCurriculum },
    { k: 'questions', label: 'الأسئلة', render: screenQuestions },
    { k: 'daily', label: 'التحدي اليومي', render: screenDailyChallenge },
    { k: 'books', label: 'الكتب', render: screenBooks },
    { k: 'students', label: 'الطلاب', render: screenStudents },
    { k: 'keys', label: 'المفاتيح', render: screenKeys },
    { k: 'attempts', label: 'المحاولات', render: screenAttempts },
    { k: 'leaderboard', label: 'المتصدّرون', render: screenLeaderboard },
    { k: 'notif', label: 'الإشعارات', render: (v) => notificationsScreen(v) },
    { k: 'account', label: 'حسابي', render: accountScreen },
  ],
});
