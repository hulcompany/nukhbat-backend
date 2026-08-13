'use strict';
/* ══════════════════════════════════════════════════════════════════
   Shared runtime for the three portals (admin / school / student).
   Dependency-free: API client + session + tiny UI kit + portal shell.
   Every portal keeps its own session key, so you can be logged in as
   admin, school and student at the same time in three tabs.
   ══════════════════════════════════════════════════════════════════ */

const API =
  (location.origin.startsWith('http')
    ? location.origin
    : 'http://localhost:3000') + '/api';

/* ─── session ────────────────────────────────────────────────────── */
const Session = {
  key: 'nkb-portal',
  data: {},
  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(this.key)) || {};
    } catch {
      this.data = {};
    }
    return this.data;
  },
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.data));
  },
  clear() {
    this.data = {};
    localStorage.removeItem(this.key);
  },
  get token() {
    return this.data.accessToken;
  },
  get user() {
    return this.data.user || {};
  },
};

/* ─── DOM helpers ────────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );

let toastTimer;
function toast(msg, kind = '') {
  let t = $('#toast');
  if (!t) {
    t = el('<div id="toast" class="toast" hidden></div>');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3600);
}

// never leave a dead button behind a silent failure
window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  toast('خطأ: ' + (e.message || 'غير معروف'), 'bad');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('خطأ: ' + (e.reason?.message || e.reason || 'غير معروف'), 'bad');
});

/* ─── API client (unwraps the { message, data } envelope) ────────── */
async function request(method, path, opts = {}, _retry) {
  const headers = {};
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token;

  let body;
  if (opts.form) {
    body = opts.form; // FormData — let the browser set the boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res;
  try {
    res = await fetch(API + path, { method, headers, body });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم — تأكد أن الـ API يعمل');
  }

  if (res.status === 401 && Session.data.refreshToken && !_retry) {
    if (await refreshToken()) return request(method, path, opts, true);
  }

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    let msg = payload && (payload.message || payload.error);
    if (Array.isArray(msg)) msg = msg.join(' • ');
    if (msg && typeof msg === 'object') msg = JSON.stringify(msg);
    const err = new Error(msg || `خطأ (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload && typeof payload === 'object' && 'data' in payload
    ? payload.data
    : payload;
}

const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  del: (p, body) => request('DELETE', p, { body }),
  postForm: (p, form) => request('POST', p, { form }),
  patchForm: (p, form) => request('PATCH', p, { form }),
};

async function refreshToken() {
  try {
    const res = await fetch(API + '/auth/refreshToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: Session.data.refreshToken }),
    });
    if (!res.ok) return false;
    const p = await res.json();
    const d = p.data || p;
    Session.data.accessToken = d.accessToken;
    Session.data.refreshToken = d.refreshToken;
    Session.save();
    return true;
  } catch {
    return false;
  }
}

/* query-string builder that drops empty values */
function qs(params) {
  const parts = [];
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  });
  return parts.length ? '?' + parts.join('&') : '';
}

/* ─── formatting ─────────────────────────────────────────────────── */
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
function fmtDateTime(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(d);
  }
}
const shortId = (id) => (id ? String(id).slice(0, 8) : '—');

/* ─── UI kit ─────────────────────────────────────────────────────── */
function card(inner, cls = '') {
  return el(`<div class="card ${cls}">${inner}</div>`);
}

function spinner() {
  return el('<div class="spinner"></div>');
}

function emptyCard(text) {
  return el(`<div class="card empty">${esc(text)}</div>`);
}

function errorCard(e) {
  return el(
    `<div class="card empty">⚠️ ${esc(e.message || e)}${
      e.status ? ` <span class="muted">(${e.status})</span>` : ''
    }</div>`,
  );
}

/* stat tiles: [['label', value], …] */
function statGrid(items) {
  const wrap = el('<div class="grid narrow"></div>');
  items.forEach(([lbl, num]) => {
    wrap.appendChild(
      el(
        `<div class="stat"><div class="num">${esc(num ?? '—')}</div><div class="lbl">${esc(lbl)}</div></div>`,
      ),
    );
  });
  return wrap;
}

/* key/value block */
function kv(pairs) {
  const rows = pairs
    .map(
      ([k, v]) =>
        `<tr><th style="width:170px">${esc(k)}</th><td class="wrap">${
          v && v.nodeType ? '' : esc(v ?? '—')
        }</td></tr>`,
    )
    .join('');
  const t = el(
    `<div class="table-wrap"><table class="tbl"><tbody>${rows}</tbody></table></div>`,
  );
  // re-insert any element values
  pairs.forEach(([, v], i) => {
    if (v && v.nodeType) t.querySelectorAll('td')[i].appendChild(v);
  });
  return t;
}

/* table: columns = [{label, render(row) -> string|Node, key}] */
function table(columns, rows, opts = {}) {
  if (!rows || !rows.length) return emptyCard(opts.empty || 'لا توجد بيانات.');
  const head = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const wrap = el(
    `<div class="table-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody></tbody></table></div>`,
  );
  const tbody = $('tbody', wrap);
  rows.forEach((row) => {
    const tr = el('<tr></tr>');
    columns.forEach((c) => {
      const td = el(`<td class="${c.wrap ? 'wrap' : ''}"></td>`);
      const val = c.render ? c.render(row) : row[c.key];
      if (val && val.nodeType) td.appendChild(val);
      else td.innerHTML = val === undefined || val === null ? '—' : String(val);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  return wrap;
}

/* button row helper */
function btnRow(buttons) {
  const row = el('<div class="row"></div>');
  buttons.forEach(([label, fn, cls]) => {
    const b = el(`<button class="btn sm ${cls || 'ghost'}">${label}</button>`);
    b.onclick = fn;
    row.appendChild(b);
  });
  return row;
}

/* pagination bar for BasePaginationModel results */
function pager(state, total, onChange) {
  const from = state.skip + 1;
  const to = Math.min(state.skip + state.limit, total);
  const bar = el(`
    <div class="between card">
      <span class="muted">${total ? `${from}–${to}` : 0} من ${total ?? 0}</span>
      <span class="row">
        <button class="btn ghost sm" id="pg-prev">السابق</button>
        <button class="btn ghost sm" id="pg-next">التالي</button>
      </span>
    </div>`);
  const prev = $('#pg-prev', bar);
  const next = $('#pg-next', bar);
  prev.disabled = state.skip <= 0;
  next.disabled = state.skip + state.limit >= (total ?? 0);
  prev.onclick = () => {
    state.skip = Math.max(0, state.skip - state.limit);
    onChange();
  };
  next.onclick = () => {
    state.skip += state.limit;
    onChange();
  };
  return bar;
}

/* ─── forms ───────────────────────────────────────────────────────
   fields: { name, label, type, options, value, required, placeholder,
             hint, accept }
   type: text | password | email | number | select | textarea | checkbox
       | file | tags (comma separated → array) | json (textarea → parsed)
   onSubmit(values, { form, setBusy }) — values omit empty optional fields.
   ──────────────────────────────────────────────────────────────── */
function form(fields, opts = {}) {
  const f = el(`<form class="${opts.grid === false ? '' : 'form-grid'}"></form>`);
  fields.forEach((fd) => {
    f.appendChild(fieldNode(fd));
  });
  const foot = el(
    `<div class="row" style="grid-column:1/-1;margin-top:6px">
       <button class="btn" type="submit">${esc(opts.submitLabel || 'حفظ')}</button>
     </div>`,
  );
  if (opts.extraButtons) opts.extraButtons.forEach((b) => foot.appendChild(b));
  f.appendChild(foot);

  const submitBtn = $('button[type=submit]', f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    let values;
    try {
      values = readForm(f, fields);
    } catch (err) {
      return toast(err.message, 'bad');
    }
    submitBtn.disabled = true;
    const old = submitBtn.textContent;
    submitBtn.textContent = 'جارٍ…';
    try {
      await opts.onSubmit(values, { form: f });
    } catch (err) {
      toast(err.message, 'bad');
    }
    submitBtn.disabled = false;
    submitBtn.textContent = old;
  });
  return f;
}

function fieldNode(fd) {
  const id = 'f-' + fd.name + '-' + Math.random().toString(36).slice(2, 7);
  const hint = fd.hint ? `<div class="hint">${esc(fd.hint)}</div>` : '';
  let inner;
  if (fd.type === 'select') {
    const opts = (fd.options || [])
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${String(fd.value ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
      })
      .join('');
    inner = `<select id="${id}" data-name="${fd.name}">${fd.required ? '' : '<option value="">— لا شيء —</option>'}${opts}</select>`;
  } else if (fd.type === 'textarea' || fd.type === 'json') {
    inner = `<textarea id="${id}" data-name="${fd.name}" placeholder="${esc(fd.placeholder || '')}">${esc(fd.value ?? '')}</textarea>`;
  } else if (fd.type === 'checkbox') {
    return el(
      `<label class="field check" style="grid-column:1/-1">
         <input id="${id}" type="checkbox" data-name="${fd.name}" ${fd.value ? 'checked' : ''}/>
         <span>${esc(fd.label)}</span>${hint}
       </label>`,
    );
  } else if (fd.type === 'file') {
    inner = `<input id="${id}" type="file" data-name="${fd.name}" accept="${fd.accept || 'image/*'}"/>`;
  } else {
    inner = `<input id="${id}" type="${fd.type || 'text'}" data-name="${fd.name}"
      value="${esc(fd.value ?? '')}" placeholder="${esc(fd.placeholder || '')}"/>`;
  }
  const node = el(
    `<label class="field ${fd.full ? '' : ''}" ${fd.full ? 'style="grid-column:1/-1"' : ''}>
       <span>${esc(fd.label)}${fd.required ? ' *' : ''}</span>${inner}${hint}
     </label>`,
  );
  return node;
}

function readForm(f, fields) {
  const values = {};
  fields.forEach((fd) => {
    const node = $(`[data-name="${fd.name}"]`, f);
    if (!node) return;
    if (fd.type === 'checkbox') {
      values[fd.name] = node.checked;
      return;
    }
    if (fd.type === 'file') {
      if (node.files && node.files[0]) values[fd.name] = node.files[0];
      return;
    }
    let v = node.value;
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) {
      if (fd.required) throw new Error(`الحقل «${fd.label}» مطلوب`);
      return;
    }
    if (fd.type === 'number') v = Number(v);
    if (fd.type === 'tags')
      v = v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    if (fd.type === 'json') {
      try {
        v = JSON.parse(v);
      } catch {
        throw new Error(`الحقل «${fd.label}» ليس JSON صالحاً`);
      }
    }
    values[fd.name] = v;
  });
  return values;
}

/* build a FormData out of plain values (files included) */
function toFormData(values) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.append(k, v);
  });
  return fd;
}

/* ─── modal ──────────────────────────────────────────────────────── */
function modal(title, content, opts = {}) {
  const back = el(`
    <div class="modal-back">
      <div class="modal">
        <div class="modal-head"><h2>${esc(title)}</h2><button class="x">×</button></div>
        <div class="modal-body"></div>
      </div>
    </div>`);
  const body = $('.modal-body', back);
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);
  const close = () => back.remove();
  $('.x', back).onclick = close;
  back.addEventListener('click', (e) => {
    if (e.target === back && opts.dismissable !== false) close();
  });
  document.body.appendChild(back);
  return { close, body };
}

function confirmDialog(message, onYes) {
  const box = el(`
    <div>
      <p>${esc(message)}</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn ghost" id="c-no">إلغاء</button>
        <button class="btn danger" id="c-yes">تأكيد</button>
      </div>
    </div>`);
  const m = modal('تأكيد', box);
  $('#c-no', box).onclick = m.close;
  $('#c-yes', box).onclick = async () => {
    m.close();
    await onYes();
  };
}

function jsonModal(title, data) {
  modal(title, `<pre class="json">${esc(JSON.stringify(data, null, 2))}</pre>`);
}

/* image link for a stored file id */
const fileUrl = (id) => (id ? `${API}/files/${id}` : '');

/* ─── portal shell ────────────────────────────────────────────────
   Portal.start({
     key, name, subtitle, role, tabs:[{k,label,render(view)}],
     signup: bool, header(): Promise<Node|null>
   })
   ──────────────────────────────────────────────────────────────── */
const Portal = {
  cfg: null,
  screen: null,
  start(cfg) {
    this.cfg = cfg;
    Session.key = 'nkb-' + cfg.key;
    Session.load();
    document.body.classList.add('portal-' + cfg.key);
    this.screen = cfg.tabs[0].k;
    this.render();
  },
  go(k) {
    this.screen = k;
    this.render();
  },
  reload() {
    this.renderScreen();
  },
  render() {
    if (!Session.token) return this.renderLogin();
    const root = $('#app');
    const u = Session.user;
    root.innerHTML = `
      <div class="topbar">
        <div class="brand">نخبة <span>الأوائل</span><small>${esc(this.cfg.name)}</small></div>
        <div class="row" id="hdr-extra"></div>
        <div class="grow"></div>
        <span class="chip" title="${esc(u.email || '')}">👤 ${esc(u.name || '—')}</span>
        <button class="btn ghost sm" id="logout">خروج</button>
      </div>
      <div class="nav" id="nav"></div>
      <main id="view"></main>`;
    const nav = $('#nav', root);
    this.cfg.tabs.forEach((t) => {
      const b = el(`<button data-k="${t.k}">${t.label}</button>`);
      if (t.k === this.screen) b.classList.add('active');
      b.onclick = () => this.go(t.k);
      nav.appendChild(b);
    });
    $('#logout', root).onclick = () => {
      Session.clear();
      this.screen = this.cfg.tabs[0].k;
      this.render();
    };
    this.renderScreen();
    if (this.cfg.header) this.cfg.header($('#hdr-extra', root));
  },
  async renderScreen() {
    const view = $('#view');
    if (!view) return;
    view.innerHTML = '';
    view.appendChild(spinner());
    const tab = this.cfg.tabs.find((t) => t.k === this.screen);
    try {
      const holder = document.createElement('div');
      await tab.render(holder);
      view.innerHTML = '';
      view.appendChild(holder);
    } catch (e) {
      view.innerHTML = '';
      view.appendChild(errorCard(e));
      console.error(e);
    }
  },
  renderLogin() {
    const cfg = this.cfg;
    const root = $('#app');
    root.innerHTML = '';
    const wrap = el(`
      <div class="login-wrap">
        <div class="card login-card">
          <div class="brand">نخبة <span>الأوائل</span></div>
          <p>${esc(cfg.name)} — ${esc(cfg.subtitle || 'سجّل الدخول للمتابعة')}</p>
          <div class="tabs" id="lg-tabs"></div>
          <div id="lg-body"></div>
          <div class="sep"></div>
          <div class="row" style="justify-content:center">
            <a href="/" class="muted">↩ كل البوابات</a>
          </div>
        </div>
      </div>`);
    root.appendChild(wrap);

    const modes = [['login', 'دخول']];
    if (cfg.signup) modes.push(['signup', 'حساب جديد']);
    modes.push(['forgot', 'نسيت كلمة المرور']);

    const body = $('#lg-body', wrap);
    const tabs = $('#lg-tabs', wrap);
    const show = (mode) => {
      $$('button', tabs).forEach((b) =>
        b.classList.toggle('active', b.dataset.m === mode),
      );
      body.innerHTML = '';
      body.appendChild(
        mode === 'login'
          ? this.loginForm()
          : mode === 'signup'
            ? this.signupForm()
            : this.forgotForm(),
      );
    };
    modes.forEach(([m, label]) => {
      const b = el(`<button data-m="${m}">${label}</button>`);
      b.onclick = () => show(m);
      tabs.appendChild(b);
    });
    show('login');
  },
  loginForm() {
    return form(
      [
        {
          name: 'email',
          label: 'البريد الإلكتروني',
          type: 'email',
          required: true,
          full: true,
          placeholder: 'admin@hul.com',
        },
        {
          name: 'password',
          label: 'كلمة المرور',
          type: 'password',
          required: true,
          full: true,
        },
      ],
      {
        submitLabel: 'دخول',
        onSubmit: async (v) => {
          const d = await api.post('/auth/login', v);
          Session.data = {
            accessToken: d.accessToken,
            refreshToken: d.refreshToken,
            user: d.user,
          };
          Session.save();
          const role = d.user?.role?.name || d.user?.role;
          if (this.cfg.role && role && role !== this.cfg.role) {
            toast(
              `هذا الحساب دوره «${role}» — بوابة ${this.cfg.name} تتطلّب «${this.cfg.role}»`,
              'bad',
            );
          }
          this.screen = this.cfg.tabs[0].k;
          this.render();
        },
      },
    );
  },
  signupForm() {
    return form(
      [
        { name: 'name', label: 'الاسم', required: true, full: true },
        {
          name: 'email',
          label: 'البريد الإلكتروني',
          type: 'email',
          required: true,
          full: true,
        },
        {
          name: 'phoneNumber',
          label: 'رقم الهاتف',
          required: true,
          full: true,
          placeholder: '+963900000000',
          hint: 'رقم سوري (SY) — مثال ‎+963912345678',
        },
        {
          name: 'password',
          label: 'كلمة المرور',
          type: 'password',
          required: true,
          full: true,
          hint: '8 أحرف على الأقل',
        },
      ],
      {
        submitLabel: 'إنشاء الحساب',
        onSubmit: async (v) => {
          const d = await api.post('/auth/signUp', v);
          if (d && d.accessToken) {
            Session.data = {
              accessToken: d.accessToken,
              refreshToken: d.refreshToken,
              user: d.user,
            };
            Session.save();
            toast('تم إنشاء الحساب 🎉', 'good');
            this.render();
          } else {
            toast('تم إنشاء الحساب — سجّل الدخول الآن', 'good');
          }
        },
      },
    );
  },
  forgotForm() {
    const box = el('<div></div>');
    box.appendChild(
      el('<div class="muted" style="margin-bottom:8px">١ — اطلب رمزاً على بريدك</div>'),
    );
    box.appendChild(
      form(
        [
          {
            name: 'email',
            label: 'البريد الإلكتروني',
            type: 'email',
            required: true,
            full: true,
          },
        ],
        {
          submitLabel: 'إرسال الرمز',
          onSubmit: async (v) => {
            await api.post('/user/mine/forget-password', v);
            toast('تم إرسال الرمز (راجع سجلّ الخادم في بيئة التطوير)', 'good');
          },
        },
      ),
    );
    box.appendChild(el('<div class="sep"></div>'));
    box.appendChild(
      el('<div class="muted" style="margin-bottom:8px">٢ — عيّن كلمة مرور جديدة</div>'),
    );
    box.appendChild(
      form(
        [
          {
            name: 'email',
            label: 'البريد الإلكتروني',
            type: 'email',
            required: true,
            full: true,
          },
          { name: 'code', label: 'الرمز', required: true, full: true },
          {
            name: 'newPassword',
            label: 'كلمة المرور الجديدة',
            type: 'password',
            required: true,
            full: true,
          },
          {
            name: 'confirmPassword',
            label: 'تأكيد كلمة المرور',
            type: 'password',
            required: true,
            full: true,
          },
        ],
        {
          submitLabel: 'تغيير كلمة المرور',
          onSubmit: async (v) => {
            await api.post('/user/mine/reset-password', v);
            toast('تم تغيير كلمة المرور — سجّل الدخول', 'good');
          },
        },
      ),
    );
    return box;
  },
};

/* ─── shared screens used by more than one portal ────────────────── */

/* "my account" — works for any logged-in role */
async function accountScreen(view) {
  const me = await api.get('/user/mine');
  const head = card(`
    <div class="between">
      <div>
        <h2>حسابي</h2>
        <h3>${esc(me.email || '')} • الدور: ${esc(me.role?.name || me.role || '—')}</h3>
      </div>
      <div class="row" id="acc-actions"></div>
    </div>`);
  view.appendChild(head);
  $('#acc-actions', head).appendChild(
    btnRow([
      ['البيانات الخام', () => jsonModal('user/mine', me)],
      [
        'طلب رمز التحقق',
        async () => {
          await api.post('/user/mine/request-verify');
          toast('تم إرسال رمز التحقق', 'good');
        },
      ],
      [
        'تأكيد الحساب برمز',
        () => {
          const f = form([{ name: 'code', label: 'الرمز', required: true, full: true }], {
            submitLabel: 'تأكيد',
            onSubmit: async (v) => {
              await api.post('/user/mine/verify', v);
              toast('تم تأكيد الحساب', 'good');
              Portal.reload();
            },
          });
          modal('تأكيد الحساب', f);
        },
      ],
    ]),
  );

  const info = card('<h2>البيانات</h2>');
  info.appendChild(
    kv([
      ['المعرّف', me.id],
      ['الاسم', me.name],
      ['البريد', me.email],
      ['الهاتف', me.phoneNumber],
      ['مؤكَّد', me.isVerified ?? me.verified ? 'نعم' : 'لا'],
      [
        'الصورة',
        me.image
          ? el(
              `<img src="${fileUrl(me.image)}" style="max-height:70px;border-radius:8px"/>`,
            )
          : '—',
      ],
    ]),
  );
  view.appendChild(info);

  const edit = card('<h2>تعديل الملف</h2><h3>PATCH /user/mine (multipart)</h3>');
  edit.appendChild(
    form(
      [
        { name: 'name', label: 'الاسم', value: me.name },
        { name: 'phoneNumber', label: 'الهاتف', value: me.phoneNumber },
        {
          name: 'password',
          label: 'كلمة مرور جديدة',
          type: 'password',
          hint: '8–32 حرفاً، اتركه فارغاً لعدم التغيير',
        },
        { name: 'image', label: 'صورة الحساب', type: 'file' },
      ],
      {
        submitLabel: 'حفظ',
        onSubmit: async (v) => {
          await api.patchForm('/user/mine', toFormData(v));
          toast('تم الحفظ', 'good');
          Portal.reload();
        },
        extraButtons: [
          (() => {
            const b = el('<button type="button" class="btn ghost">حذف الصورة</button>');
            b.onclick = async () => {
              await api.del('/user/mine/image');
              toast('تم حذف الصورة', 'good');
              Portal.reload();
            };
            return b;
          })(),
        ],
      },
    ),
  );
  view.appendChild(edit);
}

/* notifications — same endpoints for every role (send is admin-only) */
async function notificationsScreen(view, { canSend } = {}) {
  const state = { skip: 0, limit: 10 };

  const head = card('<h2>الإشعارات</h2><h3>GET /notifications/me • /notifications/stats</h3>');
  view.appendChild(head);

  const statsBox = card('<h3>الإحصاءات</h3>');
  view.appendChild(statsBox);
  try {
    const s = await api.get('/notifications/stats');
    statsBox.appendChild(
      statGrid(
        Object.entries(s || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
      ),
    );
  } catch (e) {
    statsBox.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }

  const device = card('<h3>تسجيل جهاز (FCM)</h3>');
  device.appendChild(
    form([{ name: 'deviceToken', label: 'Device token', required: true, full: true }], {
      submitLabel: 'اشتراك',
      onSubmit: async (v) => {
        await api.post('/notifications/subscribe', v);
        toast('تم تسجيل الجهاز', 'good');
      },
      extraButtons: [
        (() => {
          const b = el('<button type="button" class="btn ghost">إلغاء الاشتراك</button>');
          b.onclick = async () => {
            const t = $('[data-name=deviceToken]', device).value.trim();
            if (!t) return toast('أدخل التوكن', 'bad');
            await api.post('/notifications/unsubscribe', { deviceToken: t });
            toast('تم إلغاء الاشتراك', 'good');
          };
          return b;
        })(),
      ],
    }),
  );
  view.appendChild(device);

  if (canSend) {
    const send = card('<h3>إرسال إشعار لمستخدم (admin)</h3>');
    send.appendChild(
      form(
        [
          { name: 'userId', label: 'معرّف المستخدم (UUID)', required: true },
          { name: 'title', label: 'العنوان', required: true },
          { name: 'description', label: 'النص', required: true, full: true },
        ],
        {
          submitLabel: 'إرسال',
          onSubmit: async (v) => {
            await api.post('/notifications/send', v);
            toast('تم الإرسال', 'good');
            load();
          },
        },
      ),
    );
    view.appendChild(send);
  }

  const listBox = card('<h3>إشعاراتي</h3>');
  view.appendChild(listBox);

  async function load() {
    const body = $('.list-body', listBox) || el('<div class="list-body"></div>');
    body.innerHTML = '';
    if (!body.parentNode) listBox.appendChild(body);
    body.appendChild(spinner());
    const page = await api.get('/notifications/me' + qs(state));
    const list = page.list || page || [];
    body.innerHTML = '';
    body.appendChild(
      table(
        [
          { label: 'العنوان', render: (r) => esc(r.title || r.notification?.title || '—'), wrap: true },
          {
            label: 'النص',
            render: (r) => esc(r.description || r.notification?.description || '—'),
            wrap: true,
          },
          { label: 'مقروء', render: (r) => (r.readAt || r.isRead ? '✓' : '—') },
          { label: 'مفتوح', render: (r) => (r.openedAt || r.isOpened ? '✓' : '—') },
          { label: 'التاريخ', render: (r) => fmtDateTime(r.createdAt) },
          {
            label: '',
            render: (r) =>
              btnRow([
                [
                  'تعليم كمقروء',
                  async () => {
                    await api.post('/notifications/read', { ids: [r.id] });
                    toast('تم', 'good');
                    load();
                  },
                ],
                [
                  'فتح',
                  async () => {
                    await api.post('/notifications/open', { ids: [r.id] });
                    toast('تم', 'good');
                    load();
                  },
                ],
              ]),
          },
        ],
        list,
        { empty: 'لا توجد إشعارات.' },
      ),
    );
    if (page.totalRecords !== undefined)
      body.appendChild(pager(state, page.totalRecords, load));
  }
  await load();
}

/* public content (FAQs / info / daily wisement) — read-only viewer */
async function publicContentScreen(view) {
  const wis = card('<h2>حكمة اليوم</h2><h3>GET /daily-wisement/today</h3>');
  view.appendChild(wis);
  try {
    const w = await api.get('/daily-wisement/today');
    wis.appendChild(
      el(`<div style="font-size:17px;font-weight:700">“${esc(w?.text || '—')}”</div>`),
    );
  } catch (e) {
    wis.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }

  const info = card('<h2>معلومات التطبيق</h2><h3>GET /public-content/info</h3>');
  view.appendChild(info);
  try {
    const i = (await api.get('/public-content/info')) || {};
    info.appendChild(
      kv([
        ['Google Play', i.googlePlay],
        ['App Store', i.appStore],
        ['الهاتف', i.phone],
        ['الموقع', i.location],
        ['الإحداثيات', i.position ? `${i.position.lat}, ${i.position.lng}` : '—'],
        ['من نحن', i.about],
        ['سياسة الخصوصية', i.privacyPolicy],
        ['الشروط والأحكام', i.termsAndConditions],
      ]),
    );
  } catch (e) {
    info.appendChild(el(`<div class="muted">${esc(e.message)}</div>`));
  }

  const faqs = card('<h2>الأسئلة الشائعة</h2><h3>GET /public-content/faqs</h3>');
  view.appendChild(faqs);
  const list = (await api.get('/public-content/faqs')) || [];
  if (!list.length) faqs.appendChild(el('<div class="empty">لا توجد أسئلة.</div>'));
  list.forEach((f) =>
    faqs.appendChild(
      el(
        `<div class="list-row"><div><b>${esc(f.title)}</b><div class="meta">${esc(f.description)}</div></div></div>`,
      ),
    ),
  );
}
