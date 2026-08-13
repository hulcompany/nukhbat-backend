'use strict';
/* ══════════════════════════════════════════════════════════════════
   بوابة الإدارة (admin) — every admin-guarded endpoint in the API.
   ══════════════════════════════════════════════════════════════════ */

const Cache = { tracks: null, schools: null, meta: null };

async function tracks() {
  if (!Cache.tracks) Cache.tracks = await api.get('/curriculum/tracks');
  return Cache.tracks;
}
async function schools() {
  if (!Cache.schools) {
    const page = await api.get('/school/manage?limit=500');
    Cache.schools = page.list || page || [];
  }
  return Cache.schools;
}
const trackOptions = (list) => list.map((t) => [t.id, t.name]);
const schoolOptions = (list) => list.map((s) => [s.id, s.name]);

/* ─── 1. dashboard ───────────────────────────────────────────────── */
async function screenDashboard(view) {
  view.appendChild(
    card('<h2>لوحة الإدارة</h2><h3>نظرة عامة على المنصّة</h3>'),
  );

  const [trackList, schoolList] = await Promise.all([tracks(), schools()]);
  const users = await api.get('/user?limit=1');
  const students = await api.get('/student?limit=1');
  const subs = await api.get('/subscription?limit=1');
  const keys = await api.get('/subscription/keys?limit=1');

  view.appendChild(
    statGrid([
      ['المسارات', trackList.length],
      ['المدارس', schoolList.length],
      ['المستخدمون', users.totalRecords ?? '—'],
      ['ملفات الطلاب', students.totalRecords ?? '—'],
      ['الاشتراكات', subs.totalRecords ?? '—'],
      ['مفاتيح الاشتراك', keys.totalRecords ?? '—'],
    ]),
  );

  const activityBox = card(
    '<h2>نشاط الطلاب هذا الأسبوع</h2><h3>GET /student/admin/aggregate/activity</h3>',
  );
  view.appendChild(activityBox);
  const act = await api.get('/student/admin/aggregate/activity');
  activityBox.appendChild(
    el(`<div class="muted">${esc(act.weekStart)} → ${esc(act.weekEnd)}</div>`),
  );
  activityBox.appendChild(
    statGrid((act.week || []).map((d) => [d.date, d.openedStudents])),
  );

  const subsBox = card(
    '<h2>الاشتراكات المستهلكة شهرياً</h2><h3>GET /subscription/admin/aggregate/subscriptions</h3>',
  );
  view.appendChild(subsBox);
  const agg = await api.get('/subscription/admin/aggregate/subscriptions');
  const rows = Array.isArray(agg) ? agg : agg?.months || [];
  subsBox.appendChild(
    rows.length
      ? statGrid(rows.map((r) => [r.month ?? r.date ?? '—', r.count ?? r.total ?? 0]))
      : el(`<pre class="json">${esc(JSON.stringify(agg, null, 2))}</pre>`),
  );

  const metaBox = card('<h2>بيانات وصفية</h2><h3>GET /curriculum/metaData • /user/metaData</h3>');
  view.appendChild(metaBox);
  const [cm, um] = await Promise.all([
    api.get('/curriculum/metaData'),
    api.get('/user/metaData'),
  ]);
  metaBox.appendChild(
    kv([
      ['الأدوار', (um.roles || []).join(' • ')],
      ['أنواع الأسئلة', (cm.questionTypes || []).join(' • ')],
      ['أغراض الأسئلة', (cm.questionPurposeTypes || []).join(' • ')],
      ['حالات الدرس', (cm.lessonStatusType || []).join(' • ')],
      ['أنواع التوصيل', (cm.questionMatchTypes || []).join(' • ')],
    ]),
  );
}

/* ─── 2. users ───────────────────────────────────────────────────── */
async function screenUsers(view) {
  const state = { skip: 0, limit: 10, name: '', email: '', phoneNumber: '', role: '' };
  const meta = await api.get('/user/metaData');

  const filters = card('<h2>المستخدمون</h2><h3>GET /user (admin)</h3>');
  filters.appendChild(
    form(
      [
        { name: 'name', label: 'الاسم' },
        { name: 'email', label: 'البريد' },
        { name: 'phoneNumber', label: 'الهاتف' },
        { name: 'role', label: 'الدور', type: 'select', options: meta.roles || [] },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(state, { skip: 0, name: '', email: '', phoneNumber: '', role: '' }, v);
          await load();
        },
      },
    ),
  );
  view.appendChild(filters);

  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    const page = await api.get('/user' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'الاسم', render: (u) => esc(u.name) },
          { label: 'البريد', render: (u) => esc(u.email) },
          { label: 'الهاتف', render: (u) => esc(u.phoneNumber || '—') },
          { label: 'الدور', render: (u) => `<span class="badge">${esc(u.role?.name || u.role || '—')}</span>` },
          { label: 'المعرّف', render: (u) => `<span class="mono">${shortId(u.id)}</span>` },
          {
            label: '',
            render: (u) =>
              btnRow([
                ['تفاصيل', () => showUser(u.id)],
                ['تعديل', () => editUser(u, load)],
                [
                  'حذف الصورة',
                  () =>
                    confirmDialog('حذف صورة المستخدم؟', async () => {
                      await api.del(`/user/${u.id}/image`);
                      toast('تم', 'good');
                      load();
                    }),
                ],
              ]),
          },
        ],
        page.list || [],
        { empty: 'لا يوجد مستخدمون.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

async function showUser(id) {
  const u = await api.get('/user/' + id);
  const body = el('<div></div>');
  body.appendChild(
    kv([
      ['المعرّف', u.id],
      ['الاسم', u.name],
      ['البريد', u.email],
      ['الهاتف', u.phoneNumber],
      ['الدور', u.role?.name || u.role],
      ['أُنشئ', fmtDateTime(u.createdAt)],
      [
        'الصورة',
        u.image ? el(`<img src="${fileUrl(u.image)}" style="max-height:80px;border-radius:8px"/>`) : '—',
      ],
    ]),
  );
  const raw = el('<button class="btn ghost sm">البيانات الخام</button>');
  raw.onclick = () => jsonModal('user', u);
  body.appendChild(raw);
  modal('المستخدم', body);
}

function editUser(u, done) {
  const f = form(
    [
      { name: 'name', label: 'الاسم', value: u.name },
      { name: 'phoneNumber', label: 'الهاتف', value: u.phoneNumber },
      { name: 'password', label: 'كلمة مرور جديدة', type: 'password' },
      { name: 'image', label: 'الصورة', type: 'file' },
    ],
    {
      submitLabel: 'حفظ',
      onSubmit: async (v) => {
        await api.patchForm(`/user/${u.id}`, toFormData(v));
        toast('تم الحفظ', 'good');
        m.close();
        done();
      },
    },
  );
  const m = modal('تعديل المستخدم', f);
}

/* ─── 3. schools + track access ──────────────────────────────────── */
async function screenSchools(view) {
  const state = { skip: 0, limit: 10, name: '' };
  const trackList = await tracks();

  const head = card('<h2>المدارس</h2><h3>GET /school/manage</h3>');
  head.appendChild(
    form([{ name: 'name', label: 'اسم المدرسة' }], {
      submitLabel: 'بحث',
      onSubmit: async (v) => {
        state.skip = 0;
        state.name = v.name || '';
        await load();
      },
    }),
  );
  view.appendChild(head);

  const create = card(
    '<h2>إنشاء مدرسة</h2><h3>POST /school/manage — ينشئ مالكاً بدور contentWriter</h3>',
  );
  create.appendChild(
    form(
      [
        { name: 'schoolName', label: 'اسم المدرسة', required: true },
        { name: 'name', label: 'اسم المالك', required: true },
        { name: 'email', label: 'بريد المالك', type: 'email', required: true },
        {
          name: 'phoneNumber',
          label: 'هاتف المالك',
          required: true,
          placeholder: '+963912345678',
          hint: 'رقم سوري بطول 13 محرفاً',
        },
        { name: 'password', label: 'كلمة المرور', type: 'password', required: true },
        { name: 'image', label: 'شعار المدرسة', type: 'file' },
      ],
      {
        submitLabel: 'إنشاء',
        onSubmit: async (v) => {
          await api.postForm('/school/manage', toFormData(v));
          toast('تم إنشاء المدرسة', 'good');
          Cache.schools = null;
          await load();
        },
      },
    ),
  );
  view.appendChild(create);

  const access = card(
    '<h2>صلاحية المسارات</h2><h3>POST / DELETE /school-access — أي مسار تستطيع المدرسة استخدامه</h3>',
  );
  const schoolList = await schools();
  const accessFields = [
    {
      name: 'schoolId',
      label: 'المدرسة',
      type: 'select',
      required: true,
      options: schoolOptions(schoolList),
    },
    {
      name: 'trackId',
      label: 'المسار',
      type: 'select',
      required: true,
      options: trackOptions(trackList),
    },
  ];
  const revoke = el('<button type="button" class="btn danger">سحب الصلاحية</button>');
  access.appendChild(
    form(accessFields, {
      submitLabel: 'منح الصلاحية',
      onSubmit: async (v) => {
        await api.post('/school-access', v);
        toast('تم منح الصلاحية', 'good');
        Cache.schools = null;
        await load();
      },
      extraButtons: [revoke],
    }),
  );
  revoke.onclick = async () => {
    const f = revoke.closest('form');
    const body = {
      schoolId: $('[data-name=schoolId]', f).value,
      trackId: $('[data-name=trackId]', f).value,
    };
    if (!body.schoolId || !body.trackId) return toast('اختر المدرسة والمسار', 'bad');
    try {
      await api.del('/school-access', body);
      toast('تم سحب الصلاحية', 'good');
      Cache.schools = null;
      await load();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  view.appendChild(access);

  const box = el('<div></div>');
  view.appendChild(box);

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    const page = await api.get('/school/manage' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          {
            label: 'المدرسة',
            render: (s) =>
              `${s.logo ? `<img src="${fileUrl(s.logo)}" style="height:26px;vertical-align:middle;border-radius:6px"/> ` : ''}${esc(s.name)}`,
          },
          { label: 'المالك', render: (s) => esc(s.owner?.name || '—') },
          { label: 'بريد المالك', render: (s) => esc(s.owner?.email || '—') },
          {
            label: 'المسارات المسموحة',
            wrap: true,
            render: (s) =>
              (s.tracks || s.allowedTracks || s.schoolAccess?.map((a) => a.track) || [])
                .map((t) => `<span class="badge">${esc(t?.name || '—')}</span>`)
                .join(' ') || '—',
          },
          { label: 'المعرّف', render: (s) => `<span class="mono">${shortId(s.id)}</span>` },
          {
            label: '',
            render: (s) =>
              btnRow([
                ['تفاصيل', async () => jsonModal('school', await api.get('/school/manage/' + s.id))],
                [
                  'تعديل',
                  () => {
                    const f = form(
                      [
                        { name: 'name', label: 'اسم المدرسة', value: s.name },
                        { name: 'image', label: 'الشعار', type: 'file' },
                      ],
                      {
                        submitLabel: 'حفظ',
                        onSubmit: async (v) => {
                          await api.patchForm(`/school/manage/${s.id}`, toFormData(v));
                          toast('تم الحفظ', 'good');
                          m.close();
                          Cache.schools = null;
                          load();
                        },
                      },
                    );
                    const m = modal('تعديل المدرسة', f);
                  },
                ],
                [
                  'حذف الشعار',
                  () =>
                    confirmDialog('حذف شعار المدرسة؟', async () => {
                      await api.del(`/school/manage/${s.id}/image`);
                      toast('تم', 'good');
                      load();
                    }),
                ],
              ]),
          },
        ],
        page.list || [],
        { empty: 'لا توجد مدارس.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── 4. curriculum (read-only admin views) ──────────────────────── */
async function screenCurriculum(view) {
  const [trackList, schoolList] = await Promise.all([tracks(), schools()]);

  const head = card('<h2>المنهج</h2><h3>GET /curriculum/admin/* — قراءة عبر كل المدارس</h3>');
  view.appendChild(head);

  const tracksBox = card('<h3>المسارات — GET /curriculum/tracks</h3>');
  tracksBox.appendChild(
    table(
      [
        { label: 'الاسم', render: (t) => esc(t.name) },
        { label: 'المعرّف', render: (t) => `<span class="mono">${t.id}</span>` },
        { label: 'أُنشئ', render: (t) => fmtDate(t.createdAt) },
      ],
      trackList,
    ),
  );
  view.appendChild(tracksBox);

  const filters = {
    trackId: '',
    schoolId: '',
    courseId: '',
    unitId: '',
    lessonId: '',
    title: '',
  };

  const bar = card('<h3>مرشّحات</h3>');
  bar.appendChild(
    form(
      [
        { name: 'trackId', label: 'المسار', type: 'select', options: trackOptions(trackList) },
        { name: 'schoolId', label: 'المدرسة', type: 'select', options: schoolOptions(schoolList) },
        { name: 'title', label: 'العنوان يحوي' },
      ],
      {
        submitLabel: 'تطبيق',
        onSubmit: async (v) => {
          Object.assign(filters, { trackId: '', schoolId: '', title: '' }, v);
          await loadAll();
        },
      },
    ),
  );
  view.appendChild(bar);

  const out = el('<div></div>');
  view.appendChild(out);

  async function loadAll() {
    out.innerHTML = '';
    out.appendChild(spinner());
    const base = { trackId: filters.trackId, title: filters.title };
    const [courses, units, lessons, questions] = await Promise.all([
      api.get('/curriculum/admin/courses' + qs(base)),
      api.get('/curriculum/admin/units' + qs({ ...base, schoolId: filters.schoolId })),
      api.get('/curriculum/admin/lessons' + qs({ ...base, schoolId: filters.schoolId })),
      api.get(
        '/curriculum/admin/questions' +
          qs({ trackId: filters.trackId, schoolId: filters.schoolId, title: filters.title, limit: 20 }),
      ),
    ]);
    out.innerHTML = '';

    const cBox = card(`<h3>الدورات (${courses.length})</h3>`);
    cBox.appendChild(
      table(
        [
          { label: 'العنوان', render: (c) => esc(c.title) },
          { label: 'المسار', render: (c) => `<span class="mono">${shortId(c.trackId)}</span>` },
          { label: 'المعرّف', render: (c) => `<span class="mono">${c.id}</span>` },
        ],
        courses,
      ),
    );
    out.appendChild(cBox);

    const uBox = card(`<h3>الوحدات (${units.length})</h3>`);
    uBox.appendChild(
      table(
        [
          { label: 'العنوان', render: (u) => esc(u.title) },
          { label: 'الترتيب', render: (u) => u.index },
          { label: 'المدرسة', render: (u) => esc(u.school?.name || shortId(u.schoolId)) },
          { label: 'الدورة', render: (u) => `<span class="mono">${shortId(u.courseId)}</span>` },
        ],
        units,
      ),
    );
    out.appendChild(uBox);

    const lBox = card(`<h3>الدروس (${lessons.length})</h3>`);
    lBox.appendChild(
      table(
        [
          { label: 'العنوان', render: (l) => esc(l.title) },
          { label: 'الحالة', render: (l) => `<span class="badge ${l.status === 'published' ? 'good' : 'warn'}">${esc(l.status)}</span>` },
          { label: 'الترتيب', render: (l) => l.index },
          { label: 'المدرسة', render: (l) => esc(l.school?.name || shortId(l.schoolId)) },
          { label: 'مستخدم', render: (l) => (l.used ? '✓' : '—') },
        ],
        lessons,
      ),
    );
    out.appendChild(lBox);

    const qBox = card(`<h3>الأسئلة (${questions.totalRecords ?? 0})</h3>`);
    qBox.appendChild(
      table(
        [
          { label: 'السؤال', wrap: true, render: (q) => esc(q.title) },
          { label: 'النوع', render: (q) => qTypeLabel(q.type) },
          { label: 'الغرض', render: (q) => esc(q.purpose) },
          { label: 'المدرسة', render: (q) => esc(q.school?.name || '—') },
          {
            label: '',
            render: (q) =>
              btnRow([['معاينة', () => modal('السؤال', questionPreview(q))]]),
          },
        ],
        questions.list || [],
      ),
    );
    out.appendChild(qBox);
  }
  await loadAll();
}

/* ─── 5. subscriptions + keys ────────────────────────────────────── */
async function screenSubscriptions(view) {
  const [trackList, schoolList] = await Promise.all([tracks(), schools()]);

  /* keys */
  const gen = card('<h2>توليد مفاتيح اشتراك</h2><h3>POST /subscription/keys</h3>');
  gen.appendChild(
    form(
      [
        { name: 'schoolId', label: 'المدرسة', type: 'select', required: true, options: schoolOptions(schoolList) },
        { name: 'trackId', label: 'المسار', type: 'select', required: true, options: trackOptions(trackList) },
        { name: 'count', label: 'العدد', type: 'number', required: true, value: 5, hint: '1 – 500' },
      ],
      {
        submitLabel: 'توليد',
        onSubmit: async (v) => {
          const created = await api.post('/subscription/keys', v);
          toast(`تم توليد ${Array.isArray(created) ? created.length : v.count} مفتاحاً`, 'good');
          if (Array.isArray(created)) jsonModal('المفاتيح المولّدة', created);
          await loadKeys();
        },
      },
    ),
  );
  view.appendChild(gen);

  const keyState = { skip: 0, limit: 10, schoolId: '', trackId: '' };
  const keyFilters = card('<h2>المفاتيح</h2><h3>GET /subscription/keys</h3>');
  keyFilters.appendChild(
    form(
      [
        { name: 'schoolId', label: 'المدرسة', type: 'select', options: schoolOptions(schoolList) },
        { name: 'trackId', label: 'المسار', type: 'select', options: trackOptions(trackList) },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(keyState, { skip: 0, schoolId: '', trackId: '' }, v);
          await loadKeys();
        },
      },
    ),
  );
  view.appendChild(keyFilters);

  const keysBox = el('<div></div>');
  view.appendChild(keysBox);
  const selected = new Set();

  async function loadKeys() {
    keysBox.innerHTML = '';
    keysBox.appendChild(spinner());
    const page = await api.get('/subscription/keys' + qs(keyState));
    keysBox.innerHTML = '';
    const bulk = el(
      '<div class="row" style="margin-bottom:8px"><button class="btn danger sm" id="bulk-del">حذف المحدّد</button><span class="muted" id="sel-count"></span></div>',
    );
    $('#bulk-del', bulk).onclick = () => {
      if (!selected.size) return toast('لم تحدّد مفاتيح', 'bad');
      confirmDialog(`حذف ${selected.size} مفتاحاً؟`, async () => {
        await api.post('/subscription/keys/bulk-delete', { ids: [...selected] });
        selected.clear();
        toast('تم الحذف', 'good');
        loadKeys();
      });
    };
    keysBox.appendChild(bulk);
    keysBox.appendChild(
      table(
        [
          {
            label: '#',
            render: (k) => {
              const cb = el('<input type="checkbox"/>');
              cb.checked = selected.has(k.id);
              cb.onchange = () => {
                cb.checked ? selected.add(k.id) : selected.delete(k.id);
                $('#sel-count', bulk).textContent = `${selected.size} محدّد`;
              };
              return cb;
            },
          },
          { label: 'المفتاح', render: (k) => `<span class="mono">${esc(k.key)}</span>` },
          { label: 'المدرسة', render: (k) => esc(k.school?.name || shortId(k.schoolId)) },
          { label: 'المسار', render: (k) => esc(k.track?.name || shortId(k.trackId)) },
          {
            label: 'الحالة',
            render: (k) =>
              k.usedById
                ? '<span class="badge bad">مستخدم</span>'
                : '<span class="badge good">متاح</span>',
          },
          { label: 'أُنشئ', render: (k) => fmtDate(k.createdAt) },
          {
            label: '',
            render: (k) =>
              btnRow([
                [
                  'حذف',
                  () =>
                    confirmDialog('حذف المفتاح؟', async () => {
                      await api.del('/subscription/keys/' + k.id);
                      toast('تم الحذف', 'good');
                      loadKeys();
                    }),
                  'danger',
                ],
              ]),
          },
        ],
        page.list || [],
        { empty: 'لا توجد مفاتيح.' },
      ),
    );
    keysBox.appendChild(pager(keyState, page.totalRecords, loadKeys));
  }
  await loadKeys();

  /* subscriptions */
  const subState = { skip: 0, limit: 10, userId: '', type: '', status: '' };
  const subFilters = card('<h2>الاشتراكات</h2><h3>GET /subscription</h3>');
  subFilters.appendChild(
    form(
      [
        { name: 'userId', label: 'معرّف المستخدم' },
        { name: 'type', label: 'النوع', type: 'select', options: [['freeTrial', 'تجربة مجانية'], ['paid', 'مدفوع']] },
        { name: 'status', label: 'الحالة', type: 'select', options: [['active', 'فعّال'], ['expired', 'منتهٍ']] },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(subState, { skip: 0, userId: '', type: '', status: '' }, v);
          await loadSubs();
        },
      },
    ),
  );
  view.appendChild(subFilters);

  const subsBox = el('<div></div>');
  view.appendChild(subsBox);

  async function loadSubs() {
    subsBox.innerHTML = '';
    subsBox.appendChild(spinner());
    const page = await api.get('/subscription' + qs(subState));
    subsBox.innerHTML = '';
    subsBox.appendChild(
      table(
        [
          { label: 'الطالب', render: (s) => esc(s.studentProfile?.user?.name || shortId(s.studentProfileId)) },
          { label: 'النوع', render: (s) => `<span class="badge">${esc(s.type)}</span>` },
          {
            label: 'الحالة',
            render: (s) =>
              new Date(s.expireDate) > new Date()
                ? '<span class="badge good">فعّال</span>'
                : '<span class="badge bad">منتهٍ</span>',
          },
          { label: 'ينتهي', render: (s) => fmtDateTime(s.expireDate) },
          { label: 'أُنشئ', render: (s) => fmtDate(s.createdAt) },
          { label: '', render: (s) => btnRow([['خام', () => jsonModal('subscription', s)]]) },
        ],
        page.list || [],
        { empty: 'لا توجد اشتراكات.' },
      ),
    );
    subsBox.appendChild(pager(subState, page.totalRecords, loadSubs));
  }
  await loadSubs();
}

/* ─── 6. students ────────────────────────────────────────────────── */
async function screenStudents(view) {
  const [trackList, schoolList] = await Promise.all([tracks(), schools()]);
  const state = { skip: 0, limit: 10, name: '', trackId: '', schoolId: '' };

  const head = card('<h2>الطلاب</h2><h3>GET /student (admin)</h3>');
  head.appendChild(
    form(
      [
        { name: 'name', label: 'الاسم' },
        { name: 'schoolId', label: 'المدرسة', type: 'select', options: schoolOptions(schoolList) },
        { name: 'trackId', label: 'المسار', type: 'select', options: trackOptions(trackList) },
      ],
      {
        submitLabel: 'بحث',
        onSubmit: async (v) => {
          Object.assign(state, { skip: 0, name: '', trackId: '', schoolId: '' }, v);
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
    const page = await api.get('/student' + qs(state));
    box.innerHTML = '';
    box.appendChild(
      table(
        [
          { label: 'الطالب', render: (s) => esc(s.user?.name || '—') },
          { label: 'البريد', render: (s) => esc(s.user?.email || '—') },
          { label: 'المدرسة', render: (s) => esc(s.school?.name || '—') },
          { label: 'المسار', render: (s) => esc(s.track?.name || '—') },
          { label: 'XP', render: (s) => `<span class="chip xp">${s.xp ?? 0}</span>` },
          { label: 'جواهر', render: (s) => `<span class="chip gem">${s.gems ?? 0}</span>` },
          {
            label: 'الحالة',
            render: (s) =>
              s.active ? '<span class="badge good">نشط</span>' : '<span class="badge bad">موقوف</span>',
          },
          {
            label: '',
            render: (s) =>
              btnRow([
                ['تفاصيل', async () => jsonModal('student profile', await api.get('/student/' + s.id))],
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

/* ─── 7. daily wisements ─────────────────────────────────────────── */
async function screenWisements(view) {
  const state = { skip: 0, limit: 10, text: '' };

  const today = card('<h2>حكمة اليوم</h2><h3>GET /daily-wisement/today</h3>');
  view.appendChild(today);
  try {
    const w = await api.get('/daily-wisement/today');
    today.appendChild(el(`<div style="font-size:17px;font-weight:700">“${esc(w?.text || '—')}”</div>`));
  } catch (e) {
    today.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }

  const create = card('<h2>إضافة حكم</h2><h3>POST /daily-wisement • /daily-wisement/bulk</h3>');
  create.appendChild(
    form([{ name: 'text', label: 'نص الحكمة', type: 'textarea', required: true, full: true }], {
      submitLabel: 'إضافة',
      onSubmit: async (v) => {
        await api.post('/daily-wisement', v);
        toast('تمت الإضافة', 'good');
        await load();
      },
    }),
  );
  create.appendChild(el('<div class="sep"></div>'));
  create.appendChild(
    form(
      [
        {
          name: 'bulk',
          label: 'إضافة جماعية (سطر لكل حكمة)',
          type: 'textarea',
          required: true,
          full: true,
        },
      ],
      {
        submitLabel: 'إضافة الكل',
        onSubmit: async (v) => {
          const items = String(v.bulk)
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((text) => ({ text }));
          if (!items.length) throw new Error('لا توجد أسطر');
          await api.post('/daily-wisement/bulk', { items });
          toast(`تمت إضافة ${items.length}`, 'good');
          await load();
        },
      },
    ),
  );
  view.appendChild(create);

  const listHead = card('<h2>كل الحكم</h2><h3>GET /daily-wisement</h3>');
  listHead.appendChild(
    form([{ name: 'text', label: 'النص يحوي' }], {
      submitLabel: 'بحث',
      onSubmit: async (v) => {
        state.skip = 0;
        state.text = v.text || '';
        await load();
      },
    }),
  );
  view.appendChild(listHead);

  const box = el('<div></div>');
  view.appendChild(box);
  const selected = new Set();

  async function load() {
    box.innerHTML = '';
    box.appendChild(spinner());
    const page = await api.get('/daily-wisement' + qs(state));
    box.innerHTML = '';
    const bulkBar = el(
      '<div class="row" style="margin-bottom:8px"><button class="btn danger sm" id="wb-del">حذف المحدّد</button></div>',
    );
    $('#wb-del', bulkBar).onclick = () => {
      if (!selected.size) return toast('لم تحدّد شيئاً', 'bad');
      confirmDialog(`حذف ${selected.size} حكمة؟`, async () => {
        await api.post('/daily-wisement/bulk-delete', { ids: [...selected] });
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
            render: (w) => {
              const cb = el('<input type="checkbox"/>');
              cb.checked = selected.has(w.id);
              cb.onchange = () => (cb.checked ? selected.add(w.id) : selected.delete(w.id));
              return cb;
            },
          },
          { label: 'النص', wrap: true, render: (w) => esc(w.text) },
          { label: 'التاريخ', render: (w) => fmtDate(w.createdAt) },
          {
            label: '',
            render: (w) =>
              btnRow([
                [
                  'تعديل',
                  () => {
                    const f = form(
                      [{ name: 'text', label: 'النص', type: 'textarea', value: w.text, required: true, full: true }],
                      {
                        submitLabel: 'حفظ',
                        onSubmit: async (v) => {
                          await api.patch('/daily-wisement/' + w.id, v);
                          toast('تم الحفظ', 'good');
                          m.close();
                          load();
                        },
                      },
                    );
                    const m = modal('تعديل الحكمة', f);
                  },
                ],
                [
                  'حذف',
                  () =>
                    confirmDialog('حذف الحكمة؟', async () => {
                      await api.del('/daily-wisement/' + w.id);
                      toast('تم الحذف', 'good');
                      load();
                    }),
                  'danger',
                ],
              ]),
          },
        ],
        page.list || [],
        { empty: 'لا توجد حكم.' },
      ),
    );
    box.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* ─── 8. public content (FAQs + info) ────────────────────────────── */
async function screenPublic(view) {
  const faqBox = card('<h2>الأسئلة الشائعة</h2><h3>/public-content/faqs</h3>');
  faqBox.appendChild(
    form(
      [
        { name: 'title', label: 'السؤال', required: true },
        { name: 'description', label: 'الجواب', required: true, type: 'textarea', full: true },
      ],
      {
        submitLabel: 'إضافة',
        onSubmit: async (v) => {
          await api.post('/public-content/faqs', v);
          toast('تمت الإضافة', 'good');
          await loadFaqs();
        },
      },
    ),
  );
  view.appendChild(faqBox);
  const faqList = el('<div></div>');
  view.appendChild(faqList);

  async function loadFaqs() {
    faqList.innerHTML = '';
    const list = (await api.get('/public-content/faqs')) || [];
    faqList.appendChild(
      table(
        [
          { label: 'السؤال', wrap: true, render: (f) => esc(f.title) },
          { label: 'الجواب', wrap: true, render: (f) => esc(f.description) },
          {
            label: '',
            render: (f) =>
              btnRow([
                [
                  'تعديل',
                  () => {
                    const fm = form(
                      [
                        { name: 'title', label: 'السؤال', value: f.title },
                        { name: 'description', label: 'الجواب', type: 'textarea', value: f.description, full: true },
                      ],
                      {
                        submitLabel: 'حفظ',
                        onSubmit: async (v) => {
                          await api.patch('/public-content/faqs/' + f.id, v);
                          toast('تم الحفظ', 'good');
                          m.close();
                          loadFaqs();
                        },
                      },
                    );
                    const m = modal('تعديل السؤال', fm);
                  },
                ],
                [
                  'حذف',
                  () =>
                    confirmDialog('حذف السؤال؟', async () => {
                      await api.del('/public-content/faqs/' + f.id);
                      toast('تم الحذف', 'good');
                      loadFaqs();
                    }),
                  'danger',
                ],
              ]),
          },
        ],
        list,
        { empty: 'لا توجد أسئلة.' },
      ),
    );
  }
  await loadFaqs();

  const info = (await api.get('/public-content/info')) || {};
  const infoBox = card('<h2>معلومات التطبيق</h2><h3>POST /public-content/info — يحفظ السجلّ كاملاً</h3>');
  infoBox.appendChild(
    form(
      [
        { name: 'googlePlay', label: 'رابط Google Play', value: info.googlePlay, placeholder: 'https://…' },
        { name: 'appStore', label: 'رابط App Store', value: info.appStore, placeholder: 'https://…' },
        { name: 'phone', label: 'الهاتف', value: info.phone, placeholder: '+963912345678' },
        { name: 'location', label: 'الموقع', value: info.location },
        { name: 'lat', label: 'خط العرض', type: 'number', value: info.position?.lat },
        { name: 'lng', label: 'خط الطول', type: 'number', value: info.position?.lng },
        { name: 'about', label: 'من نحن', type: 'textarea', value: info.about, full: true },
        { name: 'privacyPolicy', label: 'سياسة الخصوصية', type: 'textarea', value: info.privacyPolicy, full: true },
        { name: 'termsAndConditions', label: 'الشروط والأحكام', type: 'textarea', value: info.termsAndConditions, full: true },
      ],
      {
        submitLabel: 'حفظ',
        onSubmit: async (v) => {
          const { lat, lng, ...rest } = v;
          const body = { ...rest };
          if (lat !== undefined && lng !== undefined) body.position = { lat, lng };
          await api.post('/public-content/info', body);
          toast('تم الحفظ', 'good');
        },
      },
    ),
  );
  view.appendChild(infoBox);
}

/* ─── boot ───────────────────────────────────────────────────────── */
Portal.start({
  key: 'admin',
  name: 'لوحة الإدارة',
  subtitle: 'دخول بحساب admin',
  role: 'admin',
  tabs: [
    { k: 'dash', label: 'اللوحة', render: screenDashboard },
    { k: 'users', label: 'المستخدمون', render: screenUsers },
    { k: 'schools', label: 'المدارس', render: screenSchools },
    { k: 'curriculum', label: 'المنهج', render: screenCurriculum },
    { k: 'subs', label: 'الاشتراكات', render: screenSubscriptions },
    { k: 'students', label: 'الطلاب', render: screenStudents },
    { k: 'wisements', label: 'الحكم', render: screenWisements },
    { k: 'public', label: 'المحتوى العام', render: screenPublic },
    { k: 'notif', label: 'الإشعارات', render: (v) => notificationsScreen(v, { canSend: true }) },
    { k: 'account', label: 'حسابي', render: accountScreen },
  ],
});
