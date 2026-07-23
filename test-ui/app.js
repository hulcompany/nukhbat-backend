'use strict';
/* ═══════════════════════════════════════════════════════════════════
   نخبة الأوائل — API Workbench
   Role-based testing console for the nukhba_alawael backend.
   No dependencies. Served statically at /test-ui by the API itself.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── constants ─────────────────────────────────────────────────── */

const ENVS = {
  local: {
    label: 'Local',
    // follow the origin the page is served from; fall back for file:// opens
    base:
      (location.origin.startsWith('http')
        ? location.origin
        : 'http://localhost:3000') + '/api',
  },
  prod: { label: 'Prod', base: 'https://alnokhba-app.com/api' },
};

const ROLE_META = {
  admin: { color: '#a78bfa', label: 'admin' },
  contentWriter: { color: '#2dd4bf', label: 'school owner' },
  student: { color: '#fbbf24', label: 'student' },
  none: { color: '#7dd3fc', label: 'guest' },
};

const PHONE_HINT = '+9639XXXXXXXX';

/* ─── persisted state ───────────────────────────────────────────── */

const STORE_KEY = 'nkb-workbench-v2';

function freshStore() {
  return {
    env: 'local',
    sessions: { local: [], prod: [] },
    active: { local: null, prod: null },
    ctx: { local: {}, prod: {} },
    lastScreen: 'home',
  };
}

let store = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.sessions && raw.ctx) return Object.assign(freshStore(), raw);
  } catch {
    /* ignore */
  }
  return freshStore();
})();

const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(store));

const envKey = () => store.env;
const base = () => ENVS[envKey()].base;
const sessions = () => store.sessions[envKey()];
const activeSession = () =>
  sessions().find((s) => s.id === store.active[envKey()]) || null;
const ctx = () => store.ctx[envKey()];

/* ─── tiny DOM helper ───────────────────────────────────────────── */

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === undefined || kid === null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
}

const $ = (id) => document.getElementById(id);

/* ─── toasts ────────────────────────────────────────────────────── */

function toast(msg, isErr = false) {
  const t = el('div', { class: 'toast' + (isErr ? ' err' : ''), text: msg });
  $('toasts').append(t);
  setTimeout(() => t.remove(), isErr ? 5200 : 2800);
}

/* ─── console drawer ────────────────────────────────────────────── */

const consoleLog = [];

function pretty(v) {
  if (v === undefined || v === null || v === '') return '∅';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function addLog(entry) {
  entry.time = new Date().toLocaleTimeString();
  consoleLog.unshift(entry);
  if (consoleLog.length > 80) consoleLog.pop();
  renderConsole();
}

function renderConsole() {
  const list = $('consolelist');
  list.innerHTML = '';
  const last = consoleLog[0];
  $('consolelast').textContent = last
    ? `${last.method} ${last.url.replace(base(), '')} → ${last.status} (${last.ms}ms)`
    : 'no requests yet';
  for (const e of consoleLog) {
    const sClass = 's' + String(e.status)[0];
    const row = el(
      'div',
      { class: 'row' },
      el('span', { class: 'st ' + sClass, text: e.status || 'ERR' }),
      el('span', { class: 'mtag ' + e.method, text: e.method }),
      el('span', { class: 'u', text: e.url }),
      el('span', { class: 'who', text: e.who }),
      el('span', { class: 'ms', text: `${e.ms}ms · ${e.time}` }),
    );
    const detail = el(
      'div',
      { class: 'detail' },
      el(
        'div',
        {},
        el('h4', { text: 'Request' }),
        el('pre', { text: pretty(e.req) }),
      ),
      el(
        'div',
        {},
        el('h4', { text: 'Response' }),
        el('pre', { text: pretty(e.res) }),
      ),
    );
    const wrap = el('div', { class: 'centry' }, row, detail);
    row.onclick = () => {
      wrap.classList.toggle('open');
      $('console').classList.remove('closed');
    };
    list.append(wrap);
  }
}

/* ─── api core ──────────────────────────────────────────────────── */

function describeForm(fd) {
  const out = {};
  for (const [k, v] of fd.entries())
    out[k] = v instanceof File ? `⟨file: ${v.name}, ${v.size}b⟩` : v;
  return out;
}

function extractMsg(parsed) {
  if (!parsed) return 'no response body';
  if (typeof parsed === 'string') return parsed.slice(0, 140);
  const m = parsed.message;
  if (Array.isArray(m)) return m.join(' · ');
  if (typeof m === 'string') return m;
  return JSON.stringify(parsed).slice(0, 140);
}

async function api(opts) {
  const { method = 'GET', path, query, body, form, auth = true } = opts;
  let url = base() + path;
  if (query) {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === '' || v === undefined || v === null) continue;
      qp.set(k, v);
    }
    const qstr = qp.toString();
    if (qstr) url += '?' + qstr;
  }

  const sess = auth === false ? null : auth === true ? activeSession() : auth;
  const headers = {};
  if (sess?.accessToken) headers.Authorization = 'Bearer ' + sess.accessToken;

  let fetchBody;
  if (form) fetchBody = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const t0 = performance.now();
  let res, text, parsed;
  try {
    res = await fetch(url, { method, headers, body: fetchBody });
    text = await res.text();
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
  } catch (err) {
    addLog({
      method,
      url,
      status: 0,
      ms: Math.round(performance.now() - t0),
      req: form ? describeForm(form) : body,
      res: String(err),
      who: sess?.label || 'guest',
    });
    toast(`Can't reach ${ENVS[envKey()].label} — is the server up?`, true);
    return { ok: false, status: 0, data: null, message: String(err) };
  }
  const ms = Math.round(performance.now() - t0);

  // one silent refresh + retry when the access token has expired
  if (res.status === 401 && sess?.refreshToken && !opts._retried) {
    const refreshed = await tryRefresh(sess);
    if (refreshed) return api({ ...opts, _retried: true });
  }

  addLog({
    method,
    url,
    status: res.status,
    ms,
    req: form ? describeForm(form) : body,
    res: parsed,
    who: sess?.label || 'guest',
  });

  if (!res.ok) toast(`${res.status} — ${extractMsg(parsed)}`, true);
  const envl = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    ok: res.ok,
    status: res.status,
    data: envl.data !== undefined ? envl.data : parsed,
    message: envl.message,
    raw: parsed,
  };
}

async function tryRefresh(sess) {
  try {
    const r = await fetch(base() + '/auth/refreshToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sess.refreshToken }),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    const d = j?.data;
    if (!d?.accessToken) return false;
    sess.accessToken = d.accessToken;
    sess.refreshToken = d.refreshToken || sess.refreshToken;
    if (d.user) {
      sess.user = d.user;
      sess.role = d.user.role || sess.role;
    }
    save();
    renderSessions();
    toast(`Session refreshed — ${sess.label}`);
    return true;
  } catch {
    return false;
  }
}

function toFormData(values, files) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values))
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  for (const [k, f] of Object.entries(files)) fd.append(k, f);
  return fd;
}

/* ─── sessions ──────────────────────────────────────────────────── */

function roleLabel(role) {
  return (ROLE_META[role] || ROLE_META.none).label;
}
function roleColor(role) {
  return (ROLE_META[role] || ROLE_META.none).color;
}

function addSessionFromAuth(d, fallbackEmail) {
  const u = d.user || {};
  const s = {
    id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
    label: u.name || fallbackEmail || 'user',
    role: u.role || 'student',
    email: u.email || fallbackEmail || '',
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    user: u,
  };
  const list = sessions();
  const i = list.findIndex((x) => x.email && x.email === s.email);
  if (i >= 0) list.splice(i, 1, s);
  else list.push(s);
  store.active[envKey()] = s.id;
  save();
  renderSessions();
  toast(`Signed in as ${s.label} — ${roleLabel(s.role)}`);
}

function renderSessions() {
  const host = $('sessions');
  host.innerHTML = '';

  const guest = el(
    'button',
    {
      class: 'chip' + (activeSession() ? '' : ' active'),
      onclick: () => {
        store.active[envKey()] = null;
        save();
        renderSessions();
      },
    },
    el('span', { class: 'rdot', style: `background:${ROLE_META.none.color}` }),
    'guest',
  );
  host.append(guest);

  for (const s of sessions()) {
    const chip = el(
      'button',
      {
        class: 'chip' + (activeSession()?.id === s.id ? ' active' : ''),
        title: `${s.email}\n${roleLabel(s.role)} — click to use this session`,
        onclick: () => {
          store.active[envKey()] = s.id;
          save();
          renderSessions();
        },
      },
      el('span', { class: 'rdot', style: `background:${roleColor(s.role)}` }),
      s.label,
      el(
        'span',
        {
          class: 'x',
          title: 'forget this session',
          onclick: (ev) => {
            ev.stopPropagation();
            store.sessions[envKey()] = sessions().filter((x) => x.id !== s.id);
            if (store.active[envKey()] === s.id) store.active[envKey()] = null;
            save();
            renderSessions();
          },
        },
        '×',
      ),
    );
    host.append(chip);
  }

  host.append(
    el('button', { class: 'chip add', onclick: openSignInModal }, '＋ sign in'),
  );
  document.body.dataset.role = activeSession()?.role || 'none';
}

/* ─── modal ─────────────────────────────────────────────────────── */

function openModal(node) {
  const m = $('modal');
  m.innerHTML = '';
  m.append(node);
  $('modalback').classList.add('show');
}
function closeModal() {
  $('modalback').classList.remove('show');
}
$('modalback')?.addEventListener('click', (e) => {
  if (e.target.id === 'modalback') closeModal();
});

function modalJson(title, value) {
  openModal(
    el(
      'div',
      {},
      el('h3', { text: title }),
      el('pre', {
        style:
          'margin-top:10px;max-height:56vh;overflow:auto;background:#0b0e13;border:1px solid var(--line);border-radius:8px;padding:10px;font-family:var(--mono);font-size:11.5px;white-space:pre-wrap;word-break:break-word;',
        text: pretty(value),
      }),
      el(
        'div',
        { style: 'margin-top:12px;text-align:right' },
        el('button', { class: 'btn ghost', onclick: closeModal }, 'Close'),
      ),
    ),
  );
}

function modalForm({ title, sub, fields, submitLabel = 'Save', onSubmit }) {
  const form = buildForm(fields);
  const btn = el('button', { class: 'btn' }, submitLabel);
  btn.onclick = async () => {
    let got;
    try {
      got = form.get();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const ok = await onSubmit(got, form);
    if (ok !== false) closeModal();
  };
  openModal(
    el(
      'div',
      {},
      el('h3', { text: title }),
      sub ? el('div', { class: 'sub', text: sub }) : null,
      form.el,
      el(
        'div',
        {
          style:
            'margin-top:14px;display:flex;gap:8px;justify-content:flex-end',
        },
        el('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'),
        btn,
      ),
    ),
  );
  return form;
}

function openSignInModal() {
  let tab = 'in';
  const render = () => {
    const wrap = el('div', {});
    wrap.append(
      el('h3', { text: 'Add a session' }),
      el('div', {
        class: 'sub',
        text: `Sessions are saved per environment — you are adding one to ${ENVS[envKey()].label}.`,
      }),
      el(
        'div',
        { class: 'tabs' },
        el(
          'button',
          {
            class: tab === 'in' ? 'on' : '',
            onclick: () => {
              tab = 'in';
              render();
            },
          },
          'Sign in',
        ),
        el(
          'button',
          {
            class: tab === 'up' ? 'on' : '',
            onclick: () => {
              tab = 'up';
              render();
            },
          },
          'Sign up (student)',
        ),
      ),
    );
    if (tab === 'in') {
      const form = buildForm([
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          req: true,
          ph: 'admin@hul.com',
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          req: true,
          ph: '12345678',
        },
      ]);
      const btn = el(
        'button',
        { class: 'btn', style: 'margin-top:12px' },
        'Sign in',
      );
      btn.onclick = async () => {
        const { values } = form.get();
        if (!values.email || !values.password) {
          toast('Email and password are required', true);
          return;
        }
        const r = await api({
          method: 'POST',
          path: '/auth/login',
          body: values,
          auth: false,
        });
        if (r.ok) {
          addSessionFromAuth(r.data, values.email);
          closeModal();
        }
      };
      wrap.append(
        form.el,
        btn,
        el(
          'div',
          { class: 'quick' },
          el(
            'button',
            {
              onclick: () =>
                form.set({ email: 'admin@hul.com', password: '12345678' }),
            },
            'fill seeded admin (admin@hul.com)',
          ),
        ),
      );
    } else {
      const form = buildForm([
        { name: 'name', label: 'Name', req: true },
        { name: 'email', label: 'Email', type: 'email', req: true },
        {
          name: 'phoneNumber',
          label: 'Phone',
          req: true,
          ph: PHONE_HINT,
          hint: 'Syrian format, 13 chars',
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          req: true,
          hint: '8–32 chars',
        },
      ]);
      const btn = el(
        'button',
        { class: 'btn', style: 'margin-top:12px' },
        'Create student account',
      );
      btn.onclick = async () => {
        const { values } = form.get();
        const r = await api({
          method: 'POST',
          path: '/auth/signUp',
          body: values,
          auth: false,
        });
        if (r.ok) {
          addSessionFromAuth(r.data, values.email);
          closeModal();
        }
      };
      wrap.append(form.el, btn);
    }
    openModal(wrap);
  };
  render();
}

/* ─── context strip ─────────────────────────────────────────────── */

function setCtx(slot, id, label) {
  ctx()[slot] = { id, label: label || '' };
  save();
  renderCtx();
}
function clearCtx(slot) {
  delete ctx()[slot];
  save();
  renderCtx();
}
function ctxVal(slot) {
  return ctx()[slot]?.id || '';
}

function renderCtx() {
  const host = $('ctxstrip');
  host.innerHTML = '';
  host.append(el('span', { class: 'lbl' }, 'context'));
  const entries = Object.entries(ctx());
  if (!entries.length) {
    host.append(
      el(
        'span',
        { class: 'empty' },
        'Empty — press “Select” on any row and its id follows you into every related form.',
      ),
    );
    return;
  }
  for (const [slot, v] of entries) {
    host.append(
      el(
        'span',
        { class: 'ctxchip', title: v.id },
        el('b', {}, slot),
        el('span', {}, v.label || v.id),
        el(
          'button',
          {
            class: 'x',
            title: 'clear',
            onclick: () => clearCtx(slot),
          },
          '×',
        ),
      ),
    );
  }
  host.append(
    el(
      'button',
      {
        class: 'ctxbtn',
        style: 'margin-left:4px',
        onclick: () => {
          store.ctx[envKey()] = {};
          save();
          renderCtx();
        },
      },
      'clear all',
    ),
  );
}

/* ─── form builder ──────────────────────────────────────────────── */
/* spec: { name, label, type: text|email|password|number|select|bool|
           textarea|json|file|uuid, options, req, ph, hint, def, ctx, wide } */

function buildForm(specs) {
  const wrap = el('div', { class: 'frm' });
  const ctl = {};
  for (const f of specs) {
    const fld = el('div', { class: 'fld' + (f.wide ? ' wide' : '') });
    const lab = el(
      'label',
      {},
      f.label || f.name,
      f.req ? el('span', { class: 'req' }, ' *') : '',
    );
    let input;
    if (f.type === 'select') {
      const opts = f.options.map((o) =>
        typeof o === 'string' ? { v: o, l: o } : o,
      );
      if (!opts.some((o) => o.v === ''))
        opts.unshift({ v: '', l: f.req ? 'choose…' : '(omit)' });
      input = el(
        'select',
        {},
        ...opts.map((o) => el('option', { value: o.v }, o.l)),
      );
      if (f.def !== undefined) input.value = String(f.def);
    } else if (f.type === 'bool') {
      input = el(
        'select',
        {},
        el('option', { value: '' }, f.req ? 'choose…' : '(omit)'),
        el('option', { value: 'true' }, 'true'),
        el('option', { value: 'false' }, 'false'),
      );
      if (f.def !== undefined) input.value = String(f.def);
    } else if (f.type === 'textarea' || f.type === 'json') {
      input = el('textarea', {
        placeholder: f.ph || (f.type === 'json' ? '{ … }' : ''),
      });
      if (f.def !== undefined) input.value = f.def;
    } else if (f.type === 'file') {
      input = el('input', { type: 'file' });
      if (f.accept) input.setAttribute('accept', f.accept);
    } else {
      input = el('input', {
        type:
          f.type === 'password'
            ? 'password'
            : f.type === 'number'
              ? 'number'
              : 'text',
        placeholder: f.ph || (f.type === 'uuid' ? 'uuid…' : ''),
      });
      if (f.def !== undefined) input.value = f.def;
    }
    ctl[f.name] = { input, spec: f };

    if (f.ctx) {
      const btn = el(
        'button',
        {
          class: 'ctxbtn',
          type: 'button',
          title: `fill from context (${f.ctx})`,
          onclick: () => {
            const v = ctxVal(f.ctx);
            if (v) input.value = v;
            else
              toast(
                `Nothing in context for “${f.ctx}” — Select a row first.`,
                true,
              );
          },
        },
        '⤓ ' + f.ctx,
      );
      if (!input.value && ctxVal(f.ctx)) input.value = ctxVal(f.ctx);
      fld.append(lab, el('div', { class: 'withbtn' }, input, btn));
    } else {
      fld.append(lab, input);
    }
    if (f.hint) fld.append(el('div', { class: 'hint', text: f.hint }));
    wrap.append(fld);
  }
  return {
    el: wrap,
    ctl,
    get() {
      const values = {},
        files = {};
      for (const [name, { input, spec }] of Object.entries(ctl)) {
        if (spec.type === 'file') {
          if (input.files[0]) files[name] = input.files[0];
          continue;
        }
        let v = input.value;
        if (typeof v === 'string') v = v.trim();
        if (v === '') continue;
        if (spec.type === 'number') v = Number(v);
        else if (spec.type === 'bool') v = v === 'true';
        else if (spec.type === 'json') {
          try {
            v = JSON.parse(v);
          } catch {
            throw new Error(`“${spec.label || name}” is not valid JSON`);
          }
        }
        values[name] = v;
      }
      return { values, files };
    },
    set(vals) {
      for (const [k, v] of Object.entries(vals)) {
        const c = ctl[k];
        if (!c || c.spec.type === 'file') continue;
        c.input.value =
          v === null || v === undefined
            ? ''
            : typeof v === 'object'
              ? JSON.stringify(v, null, 2)
              : String(v);
      }
    },
  };
}

/* ─── request block (single endpoint form) ──────────────────────── */

function substitutePath(path, values) {
  let p = path;
  for (const m of path.matchAll(/:([A-Za-z]+)/g)) {
    const t = m[1];
    const v = values[t];
    if (v === undefined || v === '')
      throw new Error(`“${t}” is required (path parameter)`);
    p = p.replace(':' + t, encodeURIComponent(v));
    delete values[t];
  }
  return p;
}

function formBlock({
  method = 'GET',
  title,
  path,
  auth = true,
  fields = [],
  note,
  submitLabel,
  confirmMsg,
  buildBody,
  onDone,
}) {
  const form = buildForm(fields);
  const btn = el(
    'button',
    { class: 'btn' },
    submitLabel || (method === 'GET' ? 'Fetch' : 'Send'),
  );
  btn.onclick = async () => {
    let got;
    try {
      got = form.get();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const { values, files } = got;
    let p;
    try {
      p = substitutePath(path, values);
    } catch (e) {
      toast(e.message, true);
      return;
    }
    if (confirmMsg && !confirm(confirmMsg)) return;

    let r;
    if (method === 'GET') {
      r = await api({ method, path: p, query: values, auth });
    } else {
      let body;
      try {
        body = buildBody ? buildBody(values) : values;
      } catch (e) {
        toast(e.message, true);
        return;
      }
      if (body === false) return;
      if (Object.keys(files).length) {
        r = await api({ method, path: p, form: toFormData(body, files), auth });
      } else {
        r = await api({ method, path: p, body, auth });
      }
    }
    if (r.ok) {
      toast(`${title} — ${r.status}`);
      onDone?.(r, form);
    }
  };
  const block = el(
    'div',
    { class: 'block' },
    el(
      'div',
      { class: 'bh' },
      el('span', { class: 'mtag ' + method, text: method }),
      el('span', { class: 't', text: title }),
      el('span', { class: 'm', text: path }),
    ),
    el(
      'div',
      { class: 'bb' },
      note ? el('div', { class: 'note', html: note }) : null,
      fields.length ? form.el : null,
      el('div', { style: fields.length ? 'margin-top:12px' : '' }, btn),
    ),
  );
  block.formRef = form;
  return block;
}

/* ─── generic table ─────────────────────────────────────────────── */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_KEYS = ['image', 'profileimage', 'attachment', 'logo', 'cover'];

function pickColumns(rows) {
  const keys = [];
  for (const r of rows.slice(0, 5))
    for (const k of Object.keys(r || {}))
      if (!keys.includes(k) && k !== 'password') keys.push(k);
  const prio = [
    'id',
    'key',
    'name',
    'title',
    'email',
    'text',
    'question',
    'role',
    'status',
    'type',
    'purpose',
    'active',
    'order',
    'phoneNumber',
  ];
  keys.sort((a, b) => {
    const ia = prio.indexOf(a),
      ib = prio.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return keys.slice(0, 10);
}

function copyText(v) {
  navigator.clipboard
    ?.writeText(v)
    .then(() => toast('Copied ' + v.slice(0, 24) + '…'));
}

function renderCell(v, key) {
  const k = (key || '').toLowerCase();
  if (v === null || v === undefined)
    return el('span', { style: 'color:var(--faint)' }, '—');
  if (typeof v === 'boolean')
    return el(
      'span',
      { class: v ? 'b-yes' : 'b-no' },
      v ? '✓ true' : '✗ false',
    );
  if (typeof v === 'object') {
    if (v.id && v.type && String(v.type).startsWith('image'))
      return el('img', {
        class: 'thumb',
        src: `${base()}/files/${v.id}`,
        title: v.id,
        onerror: (e) => e.target.replaceWith('⌧'),
      });
    const isArr = Array.isArray(v);
    return el(
      'button',
      {
        class: 'jsonpeek',
        onclick: () => modalJson(key, v),
      },
      isArr ? `[${v.length}] peek` : '{…} peek',
    );
  }
  const s = String(v);
  if (UUID_RE.test(s)) {
    if (IMAGE_KEYS.includes(k))
      return el(
        'a',
        {
          href: `${base()}/files/${s}`,
          target: '_blank',
          style: 'color:var(--accent);font-family:var(--mono);font-size:11px',
          title: s,
        },
        'file ⧉',
      );
    return el(
      'code',
      {
        title: s + ' — click to copy',
        style: 'cursor:pointer',
        onclick: () => copyText(s),
      },
      s.slice(0, 8) + '…',
    );
  }
  if (/at$/i.test(k) && !Number.isNaN(Date.parse(s)) && s.length > 15)
    return el('span', { title: s }, s.replace('T', ' ').slice(0, 16));
  return el('span', { title: s }, s.length > 70 ? s.slice(0, 70) + '…' : s);
}

/* ─── list block (filters + table + actions) ────────────────────── */

function listBlock({
  title,
  path,
  auth = true,
  filters = [],
  pag = false,
  columns,
  note,
  select,
  rowActions = [],
  bulk,
  mapData,
  autoFetch = false,
}) {
  const specs = [...filters];
  if (pag)
    specs.push(
      { name: 'skip', label: 'skip', type: 'number', def: 0 },
      { name: 'limit', label: 'limit', type: 'number', def: 10 },
      {
        name: 'sort',
        label: 'sort',
        type: 'select',
        options: [{ v: '', l: '(DESC)' }, 'DESC', 'ASC'],
      },
    );
  const form = buildForm(specs);
  const fetchBtn = el('button', { class: 'btn' }, 'Fetch');
  const tblHost = el('div');
  const countEl = el('div', { class: 'rowcount' });
  const editHost = el('div');
  let lastRows = [];
  let lastTotal;
  const checked = new Set();
  let bulkBtn = null;

  const defaultMap = (d) =>
    Array.isArray(d)
      ? d
      : d?.list
        ? d.list
        : d && typeof d === 'object'
          ? [d]
          : [];

  async function refetch() {
    let got;
    try {
      got = form.get();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const { values } = got;
    let p;
    try {
      p = substitutePath(path, values);
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const r = await api({ method: 'GET', path: p, query: values, auth });
    if (!r.ok) return;
    lastRows = (mapData || defaultMap)(r.data) || [];
    lastTotal = r.data?.totalRecords;
    checked.clear();
    renderTable();
  }

  function openEdit({ title: t, fields, prefill, submit }) {
    editHost.innerHTML = '';
    const f = buildForm(fields);
    if (prefill) f.set(prefill);
    const saveBtn = el('button', { class: 'btn' }, 'Save');
    const cancel = el(
      'button',
      { class: 'btn ghost', onclick: () => (editHost.innerHTML = '') },
      'Cancel',
    );
    saveBtn.onclick = async () => {
      let got;
      try {
        got = f.get();
      } catch (e) {
        toast(e.message, true);
        return;
      }
      const ok = await submit(got);
      if (ok) {
        editHost.innerHTML = '';
        refetch();
      }
    };
    editHost.append(
      el(
        'div',
        { class: 'editpanel' },
        el('div', { class: 'ep-t', text: t }),
        f.el,
        el(
          'div',
          { style: 'margin-top:10px;display:flex;gap:8px' },
          saveBtn,
          cancel,
        ),
      ),
    );
    editHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const tools = { refetch, openEdit };

  function updateBulkBtn() {
    if (bulkBtn) {
      bulkBtn.textContent = `${bulk.label} (${checked.size})`;
      bulkBtn.disabled = checked.size === 0;
    }
  }

  function renderTable() {
    tblHost.innerHTML = '';
    editHost.innerHTML = '';
    countEl.textContent = lastRows.length
      ? `${lastRows.length} row${lastRows.length === 1 ? '' : 's'}${lastTotal !== undefined ? ` — ${lastTotal} total` : ''}`
      : '';
    if (!lastRows.length) {
      tblHost.append(
        el(
          'div',
          {
            class: 'cempty',
            style: 'padding:14px 4px;color:var(--faint);font-style:italic',
          },
          'No rows. Adjust the filters and fetch again.',
        ),
      );
      return;
    }
    const cols = columns || pickColumns(lastRows);
    const hasActs = select || rowActions.length;

    const headCk = bulk
      ? el('input', {
          type: 'checkbox',
          onchange: (e) => {
            checked.clear();
            if (e.target.checked)
              lastRows.forEach((r) => r?.id && checked.add(r.id));
            tblHost
              .querySelectorAll('tbody input[type=checkbox]')
              .forEach((c) => (c.checked = e.target.checked));
            updateBulkBtn();
          },
        })
      : null;

    const thead = el(
      'thead',
      {},
      el(
        'tr',
        {},
        bulk ? el('th', { style: 'width:30px' }, headCk) : null,
        ...cols.map((c) => el('th', { text: c })),
        hasActs ? el('th', {}, '') : null,
      ),
    );

    const tbody = el('tbody', {});
    for (const row of lastRows) {
      const tds = [];
      if (bulk) {
        tds.push(
          el(
            'td',
            {},
            el('input', {
              type: 'checkbox',
              onchange: (e) => {
                if (e.target.checked) checked.add(row.id);
                else checked.delete(row.id);
                updateBulkBtn();
              },
            }),
          ),
        );
      }
      for (const c of cols) tds.push(el('td', {}, renderCell(row[c], c)));
      if (hasActs) {
        const acts = el('td', { class: 'acts' });
        if (select) {
          acts.append(
            el(
              'button',
              {
                class: 'mini sel',
                title: `save into context as ${select.slot}`,
                onclick: () => {
                  const label = select.label
                    ? select.label(row)
                    : row.name || row.title || '';
                  setCtx(select.slot, row.id, label);
                  select.also?.(row);
                  toast(`${select.slot} ← ${label || row.id}`);
                },
              },
              'Select',
            ),
          );
        }
        for (const a of rowActions) {
          acts.append(
            el(
              'button',
              {
                class: 'mini' + (a.kind === 'del' ? ' del' : ''),
                onclick: () => a.onClick(row, tools),
              },
              typeof a.label === 'function' ? a.label(row) : a.label,
            ),
          );
        }
        tds.push(acts);
      }
      tbody.append(el('tr', {}, tds));
    }

    tblHost.append(
      el('div', { class: 'tblwrap' }, el('table', {}, thead, tbody)),
    );

    if (bulk) {
      bulkBtn = el(
        'button',
        {
          class: 'btn danger',
          disabled: true,
          onclick: async () => {
            if (!checked.size) return;
            if (!confirm(`${bulk.label}: ${checked.size} item(s)?`)) return;
            const r = await api({
              method: 'POST',
              path: bulk.path,
              body: { ids: [...checked] },
              auth,
            });
            if (r.ok) {
              toast(`${bulk.label} — done`);
              refetch();
            }
          },
        },
        bulk.label + ' (0)',
      );
      tblHost.append(el('div', { style: 'margin-top:10px' }, bulkBtn));
    }
  }

  fetchBtn.onclick = refetch;

  const pagBar = pag
    ? el(
        'div',
        { class: 'pagbar' },
        el(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              const skip = form.ctl.skip.input,
                limit = Number(form.ctl.limit.input.value) || 10;
              skip.value = Math.max(0, (Number(skip.value) || 0) - limit);
              refetch();
            },
          },
          '‹ back',
        ),
        el(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              const skip = form.ctl.skip.input,
                limit = Number(form.ctl.limit.input.value) || 10;
              skip.value = (Number(skip.value) || 0) + limit;
              refetch();
            },
          },
          'next ›',
        ),
      )
    : null;

  const block = el(
    'div',
    { class: 'block' },
    el(
      'div',
      { class: 'bh' },
      el('span', { class: 'mtag GET' }, 'GET'),
      el('span', { class: 't', text: title }),
      el('span', { class: 'm', text: path }),
    ),
    el(
      'div',
      { class: 'bb' },
      note ? el('div', { class: 'note', html: note }) : null,
      form.el,
      el(
        'div',
        { style: 'margin-top:12px;display:flex;gap:8px;align-items:center' },
        fetchBtn,
        pagBar,
      ),
      countEl,
      tblHost,
      editHost,
    ),
  );
  if (autoFetch) setTimeout(refetch, 40);
  block.refetch = refetch;
  return block;
}

/* ─── shared row actions ────────────────────────────────────────── */

function deleteAction({ path, auth = true, label = 'Delete', what = 'item' }) {
  return {
    label,
    kind: 'del',
    onClick: async (row, { refetch }) => {
      if (
        !confirm(
          `Delete this ${what}?\n${row.name || row.title || row.text || row.id}`,
        )
      )
        return;
      const r = await api({ method: 'DELETE', path: path(row), auth });
      if (r.ok) {
        toast(`${what} deleted`);
        refetch();
      }
    },
  };
}

function editAction({
  title,
  fields,
  prefill,
  method = 'PATCH',
  path,
  auth = true,
}) {
  return {
    label: 'Edit',
    onClick: (row, { openEdit }) =>
      openEdit({
        title: `${title} — ${row.name || row.title || row.text || row.id}`,
        fields,
        prefill: prefill ? prefill(row) : row,
        submit: async ({ values, files }) => {
          const r = Object.keys(files).length
            ? await api({
                method,
                path: path(row),
                form: toFormData(values, files),
                auth,
              })
            : await api({ method, path: path(row), body: values, auth });
          if (r.ok) toast('Saved');
          return r.ok;
        },
      }),
  };
}

/* ─── screen helpers ────────────────────────────────────────────── */

function screenHead(title, sub) {
  return [
    el('div', { class: 'screen-title', text: title }),
    el('div', { class: 'screen-sub', html: sub || '' }),
  ];
}

const PAGF = true;

/* ════════════════════════ SCREENS ══════════════════════════════ */

/* ─── Start / overview ──────────────────────────────────────────── */

function renderHome(m) {
  m.append(
    ...screenHead(
      'نخبة الأوائل — API Workbench',
      'One console for every role and endpoint. Sign in once per role, keep the sessions as chips up top, and switch identity with a single click.',
    ),
  );

  m.append(
    el(
      'div',
      { class: 'hero' },
      el(
        'p',
        {},
        '1 — Pick an environment (top-left). Sessions and context are kept separately per environment.',
      ),
      el(
        'p',
        {},
        '2 — Add sessions with “＋ sign in”. The chrome re-tints to the active role: ',
        el(
          'span',
          { style: `color:${ROLE_META.admin.color}` },
          'violet = admin',
        ),
        ', ',
        el(
          'span',
          { style: `color:${ROLE_META.contentWriter.color}` },
          'teal = school owner',
        ),
        ', ',
        el(
          'span',
          { style: `color:${ROLE_META.student.color}` },
          'amber = student',
        ),
        ', ',
        el('span', { style: `color:${ROLE_META.none.color}` }, 'sky = guest'),
        '.',
      ),
      el(
        'p',
        {},
        '3 — Press “Select” on any row: its id lands in the context strip and every related form can pull it with the ⤓ buttons. No copy-pasting uuids.',
      ),
      el(
        'p',
        {},
        '4 — Every request and response is recorded in the console drawer at the bottom.',
      ),
    ),
  );

  const cards = el('div', { class: 'cards' });
  cards.append(
    el(
      'div',
      { class: 'card' },
      el(
        'h4',
        {},
        el('span', {
          class: 'rdot',
          style: `background:${ROLE_META.admin.color}`,
        }),
        'Admin',
      ),
      el(
        'p',
        {},
        'Users, schools, track access, full content overview, subscription keys, daily wisdom.',
      ),
      el(
        'div',
        { class: 'quick' },
        el(
          'button',
          {
            onclick: async () => {
              const r = await api({
                method: 'POST',
                path: '/auth/login',
                body: { email: 'admin@hul.com', password: '12345678' },
                auth: false,
              });
              if (r.ok) addSessionFromAuth(r.data, 'admin@hul.com');
            },
          },
          'sign in seeded admin',
        ),
      ),
    ),
    el(
      'div',
      { class: 'card' },
      el(
        'h4',
        {},
        el('span', {
          class: 'rdot',
          style: `background:${ROLE_META.contentWriter.color}`,
        }),
        'School owner',
      ),
      el(
        'p',
        {},
        'contentWriter role. My school, books, units → lessons tree, questions, students, keys. Create the school (and its owner login) from Admin → Schools first.',
      ),
    ),
    el(
      'div',
      { class: 'card' },
      el(
        'h4',
        {},
        el('span', {
          class: 'rdot',
          style: `background:${ROLE_META.student.color}`,
        }),
        'Student',
      ),
      el(
        'p',
        {},
        'Sign up creates a student. Then redeem a subscription key or start a free trial, and read the profile.',
      ),
      el(
        'div',
        { class: 'quick' },
        el('button', { onclick: openSignInModal }, 'sign up a fresh student'),
      ),
    ),
    el(
      'div',
      { class: 'card' },
      el(
        'h4',
        {},
        el('span', {
          class: 'rdot',
          style: `background:${ROLE_META.none.color}`,
        }),
        'Guest',
      ),
      el(
        'p',
        {},
        'No token. Use the guest chip to verify public endpoints stay public — and protected ones reject you.',
      ),
    ),
  );
  m.append(cards);

  m.append(
    listBlock({
      title: 'Registered error catalog',
      path: '/errors',
      auth: false,
      note: 'Every domain error code the backend can throw, straight from <code>GET /api/errors</code>.',
      mapData: (d) => {
        if (Array.isArray(d)) return d;
        if (d && typeof d === 'object')
          return Object.entries(d).map(([code, v]) =>
            typeof v === 'object' ? { code, ...v } : { code, value: v },
          );
        return [];
      },
    }),
  );
}

/* ─── Auth & tokens ─────────────────────────────────────────────── */

function renderAuth(m) {
  m.append(
    ...screenHead(
      'Sign in & tokens',
      'Login / signup here also saves the result as a session chip. Seeded admin: <code>admin@hul.com</code> / <code>12345678</code>.',
    ),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Sign in',
      path: '/auth/login',
      auth: false,
      fields: [
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          req: true,
          ph: 'admin@hul.com',
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          req: true,
          ph: '12345678',
        },
      ],
      onDone: (r, form) =>
        addSessionFromAuth(r.data, form.ctl.email.input.value.trim()),
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Sign up (creates a student)',
      path: '/auth/signUp',
      auth: false,
      fields: [
        { name: 'name', label: 'Name', req: true },
        { name: 'email', label: 'Email', type: 'email', req: true },
        {
          name: 'phoneNumber',
          label: 'Phone',
          req: true,
          ph: PHONE_HINT,
          hint: 'Syrian number, e.g. ' + PHONE_HINT,
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          req: true,
          hint: '8–32 chars',
        },
      ],
      onDone: (r, form) =>
        addSessionFromAuth(r.data, form.ctl.email.input.value.trim()),
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Refresh token',
      path: '/auth/refreshToken',
      auth: false,
      note: 'Leave the field empty to refresh the <b>active session</b>. (Expired access tokens are also refreshed automatically on any 401.)',
      fields: [
        {
          name: 'token',
          label: 'Refresh token',
          wide: true,
          ph: 'empty = active session’s refresh token',
        },
      ],
      buildBody: (v) => {
        const token = v.token || activeSession()?.refreshToken;
        if (!token)
          throw new Error('No refresh token — sign in first or paste one.');
        return { token };
      },
      onDone: (r) => addSessionFromAuth(r.data, r.data?.user?.email),
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Forgot password (sends OTP)',
      path: '/user/mine/forget-password',
      auth: false,
      fields: [{ name: 'email', label: 'Email', type: 'email', req: true }],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Reset password with OTP',
      path: '/user/mine/reset-password',
      auth: false,
      fields: [
        { name: 'email', label: 'Email', type: 'email', req: true },
        { name: 'code', label: 'OTP code', req: true },
        {
          name: 'newPassword',
          label: 'New password',
          type: 'password',
          req: true,
        },
        {
          name: 'confirmPassword',
          label: 'Confirm password',
          type: 'password',
          req: true,
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Roles metadata',
      path: '/user/metaData',
      auth: false,
    }),
  );
}

/* ─── My account ────────────────────────────────────────────────── */

function renderAccount(m) {
  m.append(
    ...screenHead(
      'My account',
      'Runs as whichever session chip is active — great for testing the same endpoint across roles.',
    ),
  );

  m.append(formBlock({ method: 'GET', title: 'Who am I', path: '/user/mine' }));

  m.append(
    formBlock({
      method: 'PATCH',
      title: 'Update my profile',
      path: '/user/mine',
      note: 'Only filled fields are sent. Attach an image to test the multipart path (field name <code>image</code>).',
      fields: [
        { name: 'name', label: 'Name' },
        {
          name: 'password',
          label: 'New password',
          type: 'password',
          hint: '8–32 chars',
        },
        { name: 'phoneNumber', label: 'Phone', ph: PHONE_HINT },
        {
          name: 'image',
          label: 'Profile image',
          type: 'file',
          accept: 'image/*',
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'DELETE',
      title: 'Remove my profile image',
      path: '/user/mine/image',
      confirmMsg: 'Remove your profile image?',
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Request account verification (OTP)',
      path: '/user/mine/request-verify',
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Verify with OTP code',
      path: '/user/mine/verify',
      fields: [{ name: 'code', label: 'OTP code', req: true }],
    }),
  );
}

/* ─── Public: tracks & metadata ─────────────────────────────────── */

function renderTracks(m) {
  m.append(
    ...screenHead(
      'Tracks & metadata',
      'Public endpoints. “Select” a track — nearly everything else (courses, keys, trials) hangs off <code>trackId</code>.',
    ),
  );

  m.append(
    listBlock({
      title: 'All tracks',
      path: '/curriculum/tracks',
      auth: false,
      autoFetch: true,
      select: { slot: 'trackId', label: (r) => r.title || r.name || '' },
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Curriculum metadata (enums)',
      path: '/curriculum/metaData',
      auth: false,
      note: 'Lesson statuses, question types, match types and purposes — the vocabulary used by the question builder.',
    }),
  );
}

/* ─── Public content: FAQs + info ───────────────────────────────── */

function renderPublicContent(m) {
  m.append(
    ...screenHead(
      'FAQs & app info',
      'Reading is public. Creating an FAQ and saving info require an <b>admin</b> session.',
    ),
  );

  m.append(
    listBlock({
      title: 'FAQs',
      path: '/public-content/faqs',
      auth: false,
      autoFetch: true,
      note: 'Heads-up: PATCH/DELETE on FAQs currently have <b>no guard</b> on the backend — try them as guest and they will succeed.',
      rowActions: [
        editAction({
          title: 'Edit FAQ',
          fields: [
            { name: 'title', label: 'Title', wide: true },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              wide: true,
            },
          ],
          prefill: (r) => ({ title: r.title, description: r.description }),
          path: (r) => `/public-content/faqs/${r.id}`,
        }),
        deleteAction({
          path: (r) => `/public-content/faqs/${r.id}`,
          what: 'FAQ',
        }),
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Create FAQ (admin)',
      path: '/public-content/faqs',
      fields: [
        { name: 'title', label: 'Title', req: true, wide: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          req: true,
          wide: true,
        },
      ],
    }),
  );

  const infoForm = formBlock({
    method: 'POST',
    title: 'Save app info (admin)',
    path: '/public-content/info',
    note: 'Use “Fetch current info” to prefill this form, tweak, then save.',
    fields: [
      { name: 'googlePlay', label: 'Google Play URL' },
      { name: 'appStore', label: 'App Store URL' },
      { name: 'phone', label: 'Phone', ph: PHONE_HINT },
      { name: 'location', label: 'Location (text)' },
      {
        name: 'position',
        label: 'Position (lat/lng JSON)',
        type: 'json',
        ph: '{"lat": 33.51, "lng": 36.29}',
        wide: true,
      },
      { name: 'about', label: 'About', type: 'textarea', wide: true },
      {
        name: 'privacyPolicy',
        label: 'Privacy policy',
        type: 'textarea',
        wide: true,
      },
      {
        name: 'termsAndConditions',
        label: 'Terms & conditions',
        type: 'textarea',
        wide: true,
      },
    ],
  });

  m.append(
    formBlock({
      method: 'GET',
      title: 'Fetch current info',
      path: '/public-content/info',
      auth: false,
      submitLabel: 'Fetch & prefill form below',
      onDone: (r) => {
        const d = { ...(r.data || {}) };
        if (d.position && typeof d.position === 'object')
          d.position = JSON.stringify(d.position);
        infoForm.formRef.set(d);
        toast('Form prefilled with current info');
      },
    }),
    infoForm,
  );
}

/* ─── Daily wisdom ──────────────────────────────────────────────── */

function renderWisdom(m) {
  m.append(
    ...screenHead(
      'Daily wisdom',
      '“Today” is public; management is <b>admin</b>-only.',
    ),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Today’s wisdom (public)',
      path: '/daily-wisement/today',
      auth: false,
    }),
  );

  m.append(
    listBlock({
      title: 'All wisdom entries (admin)',
      path: '/daily-wisement',
      pag: PAGF,
      filters: [{ name: 'text', label: 'text contains' }],
      bulk: { label: 'Delete selected', path: '/daily-wisement/bulk-delete' },
      rowActions: [
        editAction({
          title: 'Edit wisdom',
          fields: [
            { name: 'text', label: 'Text', type: 'textarea', wide: true },
          ],
          prefill: (r) => ({ text: r.text }),
          path: (r) => `/daily-wisement/${r.id}`,
        }),
        deleteAction({
          path: (r) => `/daily-wisement/${r.id}`,
          what: 'wisdom entry',
        }),
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Add one (admin)',
      path: '/daily-wisement',
      fields: [
        {
          name: 'text',
          label: 'Text',
          type: 'textarea',
          req: true,
          wide: true,
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Bulk add (admin)',
      path: '/daily-wisement/bulk',
      note: 'One entry per line.',
      fields: [
        {
          name: 'lines',
          label: 'Entries',
          type: 'textarea',
          req: true,
          wide: true,
          ph: 'wisdom one\nwisdom two',
        },
      ],
      buildBody: (v) => {
        const items = String(v.lines || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((text) => ({ text }));
        if (!items.length) throw new Error('Add at least one line');
        return { items };
      },
    }),
  );
}

/* ─── Files ─────────────────────────────────────────────────────── */

function renderFiles(m) {
  m.append(
    ...screenHead(
      'File viewer',
      'Any stored file is publicly served at <code>GET /api/files/:id</code>. Paste an id (or copy one from any image cell) and preview it.',
    ),
  );

  const input = el('input', {
    placeholder: 'file uuid…',
    style: 'max-width:340px',
  });
  const preview = el('div', { style: 'margin-top:14px' });
  const show = () => {
    const id = input.value.trim();
    if (!UUID_RE.test(id)) {
      toast('That is not a uuid', true);
      return;
    }
    const url = `${base()}/files/${id}`;
    preview.innerHTML = '';
    preview.append(
      el(
        'div',
        { style: 'margin-bottom:8px' },
        el(
          'a',
          {
            href: url,
            target: '_blank',
            style: 'color:var(--accent);font-family:var(--mono);font-size:12px',
          },
          url,
        ),
      ),
      el('img', {
        src: url,
        style:
          'max-width:420px;max-height:320px;border-radius:8px;border:1px solid var(--line)',
        onerror: (e) =>
          e.target.replaceWith(
            el(
              'div',
              { class: 'note' },
              'Not an image (or 404) — use the link above to open it directly.',
            ),
          ),
      }),
    );
  };
  m.append(
    el(
      'div',
      { class: 'block' },
      el(
        'div',
        { class: 'bh' },
        el('span', { class: 'mtag GET' }, 'GET'),
        el('span', { class: 't' }, 'Preview a file'),
        el('span', { class: 'm' }, '/files/:id'),
      ),
      el(
        'div',
        { class: 'bb' },
        el(
          'div',
          { style: 'display:flex;gap:8px' },
          input,
          el('button', { class: 'btn', onclick: show }, 'Preview'),
        ),
        preview,
      ),
    ),
  );
}

/* ─── Admin: users ──────────────────────────────────────────────── */

function renderAdmUsers(m) {
  m.append(
    ...screenHead('Users (admin)', 'Search, inspect and edit any user.'),
  );

  m.append(
    listBlock({
      title: 'Search users',
      path: '/user',
      pag: PAGF,
      filters: [
        { name: 'name', label: 'name contains' },
        {
          name: 'role',
          label: 'role',
          type: 'select',
          options: ['admin', 'contentWriter', 'student'],
        },
        { name: 'email', label: 'email contains' },
        { name: 'phoneNumber', label: 'phone contains' },
      ],
      select: { slot: 'userId', label: (r) => r.name || r.email || '' },
      rowActions: [
        editAction({
          title: 'Edit user',
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'password', label: 'New password', type: 'password' },
            { name: 'phoneNumber', label: 'Phone', ph: PHONE_HINT },
            {
              name: 'image',
              label: 'Profile image',
              type: 'file',
              accept: 'image/*',
            },
          ],
          prefill: (r) => ({ name: r.name, phoneNumber: r.phoneNumber }),
          path: (r) => `/user/${r.id}`,
        }),
        {
          label: 'Del image',
          kind: 'del',
          onClick: async (row, { refetch }) => {
            if (!confirm('Remove this user’s profile image?')) return;
            const r = await api({
              method: 'DELETE',
              path: `/user/${row.id}/image`,
            });
            if (r.ok) {
              toast('Image removed');
              refetch();
            }
          },
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Get user by id',
      path: '/user/:id',
      fields: [
        {
          name: 'id',
          label: 'User id',
          type: 'uuid',
          ctx: 'userId',
          req: true,
        },
      ],
      onDone: (r) => modalJson('User', r.data),
    }),
  );
}

/* ─── Admin: schools ────────────────────────────────────────────── */

function renderAdmSchools(m) {
  m.append(
    ...screenHead(
      'Schools (admin)',
      'Creating a school also creates its <b>owner login</b> (contentWriter) — sign in with that email afterwards to work the owner screens.',
    ),
  );

  m.append(
    listBlock({
      title: 'Search schools',
      path: '/school/manage',
      pag: PAGF,
      filters: [{ name: 'name', label: 'name contains' }],
      select: { slot: 'schoolId', label: (r) => r.name || '' },
      rowActions: [
        editAction({
          title: 'Edit school',
          fields: [
            { name: 'name', label: 'School name' },
            { name: 'image', label: 'Logo', type: 'file', accept: 'image/*' },
          ],
          prefill: (r) => ({ name: r.name }),
          path: (r) => `/school/manage/${r.id}`,
        }),
        {
          label: 'Del image',
          kind: 'del',
          onClick: async (row, { refetch }) => {
            if (!confirm('Remove this school’s logo?')) return;
            const r = await api({
              method: 'DELETE',
              path: `/school/manage/${row.id}/image`,
            });
            if (r.ok) {
              toast('Logo removed');
              refetch();
            }
          },
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Create school + owner account',
      path: '/school/manage',
      fields: [
        { name: 'schoolName', label: 'School name', req: true },
        { name: 'name', label: 'Owner name', req: true },
        { name: 'email', label: 'Owner email', type: 'email', req: true },
        {
          name: 'password',
          label: 'Owner password',
          type: 'password',
          req: true,
          hint: '8–32 chars',
        },
        {
          name: 'phoneNumber',
          label: 'Owner phone',
          req: true,
          ph: PHONE_HINT,
        },
        { name: 'image', label: 'Logo', type: 'file', accept: 'image/*' },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Get school by id',
      path: '/school/manage/:id',
      fields: [
        {
          name: 'id',
          label: 'School id',
          type: 'uuid',
          ctx: 'schoolId',
          req: true,
        },
      ],
      onDone: (r) => modalJson('School', r.data),
    }),
  );
}

/* ─── Admin: track access ───────────────────────────────────────── */

function renderAdmAccess(m) {
  m.append(
    ...screenHead(
      'School ↔ track access (admin)',
      'A school can only build content inside tracks it was granted. Grab <code>schoolId</code> from Schools and <code>trackId</code> from Tracks.',
    ),
  );

  const flds = [
    {
      name: 'schoolId',
      label: 'School id',
      type: 'uuid',
      ctx: 'schoolId',
      req: true,
    },
    {
      name: 'trackId',
      label: 'Track id',
      type: 'uuid',
      ctx: 'trackId',
      req: true,
    },
  ];
  m.append(
    formBlock({
      method: 'POST',
      title: 'Grant track to school',
      path: '/school-access',
      fields: flds,
    }),
  );
  m.append(
    formBlock({
      method: 'DELETE',
      title: 'Revoke track from school',
      path: '/school-access',
      fields: flds,
      confirmMsg: 'Revoke this track from the school?',
    }),
  );
}

/* ─── Admin: content overview ───────────────────────────────────── */

function renderAdmContent(m) {
  m.append(
    ...screenHead(
      'Content overview (admin)',
      'Read-only view over the whole tree, across all schools. “Select” rows here to feed ids into the owner/student screens.',
    ),
  );

  m.append(
    listBlock({
      title: 'Courses',
      path: '/curriculum/admin/courses',
      filters: [
        { name: 'title', label: 'title contains' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: { slot: 'courseId', label: (r) => r.title || '' },
    }),
  );

  m.append(
    listBlock({
      title: 'Units',
      path: '/curriculum/admin/units',
      filters: [
        { name: 'title', label: 'title contains' },
        { name: 'schoolId', label: 'school', type: 'uuid', ctx: 'schoolId' },
        { name: 'courseId', label: 'course', type: 'uuid', ctx: 'courseId' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: { slot: 'unitId', label: (r) => r.title || '' },
    }),
  );

  m.append(
    listBlock({
      title: 'Lessons',
      path: '/curriculum/admin/lessons',
      filters: [
        { name: 'title', label: 'title contains' },
        { name: 'unitId', label: 'unit', type: 'uuid', ctx: 'unitId' },
        { name: 'courseId', label: 'course', type: 'uuid', ctx: 'courseId' },
        { name: 'schoolId', label: 'school', type: 'uuid', ctx: 'schoolId' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: { slot: 'lessonId', label: (r) => r.title || '' },
    }),
  );

  m.append(
    listBlock({
      title: 'Questions',
      path: '/curriculum/admin/questions',
      pag: PAGF,
      filters: [
        { name: 'title', label: 'title contains' },
        { name: 'lessonId', label: 'lesson', type: 'uuid', ctx: 'lessonId' },
        { name: 'courseId', label: 'course', type: 'uuid', ctx: 'courseId' },
        { name: 'schoolId', label: 'school', type: 'uuid', ctx: 'schoolId' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: {
        slot: 'questionId',
        label: (r) => (r.title || '').slice(0, 40),
      },
    }),
  );
}

/* ─── Admin: students / subscriptions / keys ────────────────────── */

function renderAdmStudents(m) {
  m.append(
    ...screenHead(
      'Students (admin)',
      'Every student profile across all schools.',
    ),
  );

  m.append(
    listBlock({
      title: 'Search student profiles',
      path: '/student',
      pag: PAGF,
      filters: [
        { name: 'name', label: 'name contains' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
        { name: 'schoolId', label: 'school', type: 'uuid', ctx: 'schoolId' },
      ],
      select: { slot: 'studentId', label: (r) => r.user?.name || r.name || '' },
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Get profile by id',
      path: '/student/:id',
      fields: [
        {
          name: 'id',
          label: 'Profile id',
          type: 'uuid',
          ctx: 'studentId',
          req: true,
        },
      ],
      onDone: (r) => modalJson('Student profile', r.data),
    }),
  );
}

function renderAdmSubs(m) {
  m.append(
    ...screenHead(
      'Subscriptions (admin)',
      'Every grant ever made — free trials and paid keys, active or expired.',
    ),
  );

  m.append(
    listBlock({
      title: 'Search subscriptions',
      path: '/subscription',
      pag: PAGF,
      filters: [
        { name: 'userId', label: 'user', type: 'uuid', ctx: 'userId' },
        {
          name: 'type',
          label: 'type',
          type: 'select',
          options: ['freeTrial', 'paid'],
        },
        {
          name: 'status',
          label: 'status',
          type: 'select',
          options: ['active', 'expired'],
        },
      ],
    }),
  );
}

function renderAdmKeys(m) {
  m.append(
    ...screenHead(
      'Subscription keys (admin)',
      'Mint batches of keys for a school + track. “Select” captures both the key id and the redeemable <code>key</code> string for the student screen.',
    ),
  );

  m.append(
    listBlock({
      title: 'Search keys',
      path: '/subscription/keys',
      pag: PAGF,
      filters: [
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
        { name: 'schoolId', label: 'school', type: 'uuid', ctx: 'schoolId' },
      ],
      select: {
        slot: 'keyId',
        label: (r) => r.key || '',
        also: (r) => {
          if (r.key) setCtx('key', r.key, 'redeem code');
        },
      },
      bulk: {
        label: 'Delete selected',
        path: '/subscription/keys/bulk-delete',
      },
      rowActions: [
        deleteAction({
          path: (r) => `/subscription/keys/${r.id}`,
          what: 'key',
        }),
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Mint keys',
      path: '/subscription/keys',
      fields: [
        {
          name: 'trackId',
          label: 'Track id',
          type: 'uuid',
          ctx: 'trackId',
          req: true,
        },
        {
          name: 'schoolId',
          label: 'School id',
          type: 'uuid',
          ctx: 'schoolId',
          req: true,
        },
        {
          name: 'count',
          label: 'How many',
          type: 'number',
          def: 5,
          req: true,
          hint: '1–500',
        },
      ],
    }),
  );
}

/* ─── Owner: my school ──────────────────────────────────────────── */

function renderOwnSchool(m) {
  m.append(
    ...screenHead(
      'My school (owner)',
      'Requires an active <b>contentWriter</b> session that owns a school.',
    ),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My school',
      path: '/school/me',
      onDone: (r) => {
        if (r.data?.id) setCtx('schoolId', r.data.id, r.data.name);
      },
    }),
  );

  m.append(
    formBlock({
      method: 'PATCH',
      title: 'Edit my school',
      path: '/school/me',
      fields: [
        { name: 'name', label: 'School name' },
        { name: 'image', label: 'Logo', type: 'file', accept: 'image/*' },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'DELETE',
      title: 'Remove my logo',
      path: '/school/me/image',
      confirmMsg: 'Remove the school logo?',
    }),
  );
}

/* ─── Owner: books ──────────────────────────────────────────────── */

function renderOwnBooks(m) {
  m.append(
    ...screenHead(
      'Books (owner)',
      'Upload field is named <code>image</code>. Create requires a file; edit can swap name and/or file.',
    ),
  );

  m.append(
    listBlock({
      title: 'My books',
      path: '/books/school',
      autoFetch: true,
      select: { slot: 'bookId', label: (r) => r.name || '' },
      rowActions: [
        editAction({
          title: 'Edit book',
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'image', label: 'Replace file', type: 'file' },
          ],
          prefill: (r) => ({ name: r.name }),
          path: (r) => `/books/school/${r.id}`,
        }),
        deleteAction({ path: (r) => `/books/school/${r.id}`, what: 'book' }),
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Add book',
      path: '/books/school',
      fields: [
        { name: 'name', label: 'Name', req: true },
        { name: 'image', label: 'File', type: 'file', req: true },
      ],
      buildBody: (v) => {
        if (!v.name) throw new Error('Name is required');
        return v;
      },
    }),
  );
}

/* ─── Owner: content tree ───────────────────────────────────────── */

function renderTree(m) {
  m.append(
    ...screenHead(
      'Content tree (owner)',
      'Track → course → units → lessons, side by side. Click through, add, rename, reorder (↑↓ then “save order”), delete. Selections land in context for the Questions screen.',
    ),
  );

  let tracks = [],
    courses = [],
    units = [],
    lessons = [];
  let selCourse = null,
    selUnit = null;
  let unitsDirty = false,
    lessonsDirty = false;

  const trackSel = el('select', { style: 'max-width:280px' });
  const coursesCol = el('div', { class: 'col' });
  const unitsCol = el('div', { class: 'col' });
  const lessonsCol = el('div', { class: 'col' });

  async function loadTracks() {
    const r = await api({
      method: 'GET',
      path: '/curriculum/tracks',
      auth: false,
    });
    tracks = Array.isArray(r.data) ? r.data : r.data?.list || [];
    trackSel.innerHTML = '';
    trackSel.append(el('option', { value: '' }, 'pick a track…'));
    for (const t of tracks)
      trackSel.append(el('option', { value: t.id }, t.title || t.name || t.id));
    const remembered = ctxVal('trackId');
    if (remembered && tracks.some((t) => t.id === remembered)) {
      trackSel.value = remembered;
      loadCourses();
    }
  }

  async function loadCourses() {
    courses = [];
    selCourse = null;
    units = [];
    selUnit = null;
    lessons = [];
    const tid = trackSel.value;
    if (tid) {
      const t = tracks.find((x) => x.id === tid);
      setCtx('trackId', tid, t?.title || t?.name || '');
      const r = await api({
        method: 'GET',
        path: `/curriculum/school/courses/${tid}`,
      });
      if (r.ok) courses = Array.isArray(r.data) ? r.data : r.data?.list || [];
    }
    paint();
  }

  async function loadUnits() {
    units = [];
    selUnit = null;
    lessons = [];
    unitsDirty = false;
    if (selCourse) {
      const r = await api({
        method: 'GET',
        path: `/curriculum/school/units/${selCourse.id}`,
      });
      if (r.ok) units = Array.isArray(r.data) ? r.data : r.data?.list || [];
    }
    paint();
  }

  async function loadLessons() {
    lessons = [];
    lessonsDirty = false;
    if (selUnit) {
      const r = await api({
        method: 'GET',
        path: `/curriculum/school/lessons/${selUnit.id}`,
      });
      if (r.ok) lessons = Array.isArray(r.data) ? r.data : r.data?.list || [];
    }
    paint();
  }

  function move(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return false;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return true;
  }

  function column({
    col,
    name,
    items,
    sel,
    onPick,
    onAdd,
    addPh,
    onRename,
    onDelete,
    onMove,
    dirty,
    onSaveOrder,
    statusOf,
  }) {
    col.innerHTML = '';
    const head = el(
      'div',
      { class: 'ch' },
      el('span', { class: 't', text: name }),
      dirty ? el('span', { class: 'orderdirty' }, 'order changed') : null,
      dirty
        ? el('button', { class: 'ctxbtn', onclick: onSaveOrder }, 'save order')
        : null,
    );
    const list = el('div', { class: 'cl' });
    if (!items.length) {
      list.append(
        el('div', { class: 'cempty' }, `No ${name.toLowerCase()} here yet.`),
      );
    }
    items.forEach((it, i) => {
      const btns = el('span', { class: 'nodebtns' });
      if (onMove) {
        btns.append(
          el(
            'button',
            {
              class: 'nb',
              title: 'move up',
              onclick: (e) => {
                e.stopPropagation();
                onMove(i, -1);
              },
            },
            '↑',
          ),
          el(
            'button',
            {
              class: 'nb',
              title: 'move down',
              onclick: (e) => {
                e.stopPropagation();
                onMove(i, +1);
              },
            },
            '↓',
          ),
        );
      }
      if (onRename)
        btns.append(
          el(
            'button',
            {
              class: 'nb',
              title: 'edit',
              onclick: (e) => {
                e.stopPropagation();
                onRename(it);
              },
            },
            '✎',
          ),
        );
      if (onDelete)
        btns.append(
          el(
            'button',
            {
              class: 'nb',
              title: 'delete',
              onclick: (e) => {
                e.stopPropagation();
                onDelete(it);
              },
            },
            '✕',
          ),
        );
      const st = statusOf?.(it);
      const node = el(
        'div',
        {
          class: 'node' + (sel?.id === it.id ? ' on' : ''),
          role: 'button',
          tabindex: '0',
        },
        onMove ? el('span', { class: 'ord', text: i + 1 }) : null,
        el(
          'span',
          { style: 'overflow:hidden;text-overflow:ellipsis' },
          it.title || it.name || it.id,
        ),
        st ? el('span', { class: 'st ' + st, text: st }) : null,
        btns,
      );
      node.onclick = () => onPick?.(it);
      list.append(node);
    });
    col.append(head, list);
    if (onAdd) {
      const inp = el('input', { placeholder: addPh });
      const add = async () => {
        const v = inp.value.trim();
        if (!v) return;
        if (await onAdd(v)) inp.value = '';
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') add();
      });
      col.append(
        el(
          'div',
          { class: 'cf' },
          inp,
          el(
            'button',
            { class: 'btn', style: 'padding:5px 12px', onclick: add },
            '+',
          ),
        ),
      );
    }
  }

  function paint() {
    column({
      col: coursesCol,
      name: 'Courses',
      items: courses,
      sel: selCourse,
      onPick: (c) => {
        selCourse = c;
        setCtx('courseId', c.id, c.title || '');
        loadUnits();
      },
    });
    column({
      col: unitsCol,
      name: 'Units',
      items: units,
      sel: selUnit,
      dirty: unitsDirty,
      onPick: (u) => {
        selUnit = u;
        setCtx('unitId', u.id, u.title || '');
        loadLessons();
      },
      addPh: selCourse ? 'new unit title…' : 'pick a course first',
      onAdd: async (title) => {
        if (!selCourse) {
          toast('Pick a course first', true);
          return false;
        }
        const r = await api({
          method: 'POST',
          path: '/curriculum/school/units',
          body: { title, courseId: selCourse.id },
        });
        if (r.ok) {
          toast('Unit created');
          loadUnits();
        }
        return r.ok;
      },
      onRename: (u) =>
        modalForm({
          title: 'Rename unit',
          fields: [{ name: 'title', label: 'Title', req: true, def: u.title }],
          onSubmit: async ({ values }) => {
            const r = await api({
              method: 'PATCH',
              path: `/curriculum/school/units/${u.id}`,
              body: values,
            });
            if (r.ok) {
              toast('Unit renamed');
              loadUnits();
            }
            return r.ok;
          },
        }),
      onDelete: async (u) => {
        if (!confirm(`Delete unit “${u.title}” and everything inside it?`))
          return;
        const r = await api({
          method: 'DELETE',
          path: `/curriculum/school/units/${u.id}`,
        });
        if (r.ok) {
          toast('Unit deleted');
          loadUnits();
        }
      },
      onMove: (i, d) => {
        if (move(units, i, d)) {
          unitsDirty = true;
          paint();
        }
      },
      onSaveOrder: async () => {
        const r = await api({
          method: 'POST',
          path: `/curriculum/school/units/order/${selCourse.id}`,
          body: { ids: units.map((u) => u.id) },
        });
        if (r.ok) {
          toast('Unit order saved');
          unitsDirty = false;
          paint();
        }
      },
    });
    column({
      col: lessonsCol,
      name: 'Lessons',
      items: lessons,
      sel: null,
      dirty: lessonsDirty,
      statusOf: (l) => l.status,
      onPick: (l) => {
        setCtx('lessonId', l.id, l.title || '');
        toast(`lessonId ← ${l.title}`);
      },
      addPh: selUnit ? 'new lesson title…' : 'pick a unit first',
      onAdd: async (title) => {
        if (!selUnit) {
          toast('Pick a unit first', true);
          return false;
        }
        const r = await api({
          method: 'POST',
          path: '/curriculum/school/lessons',
          body: { title, unitId: selUnit.id },
        });
        if (r.ok) {
          toast('Lesson created (draft)');
          loadLessons();
        }
        return r.ok;
      },
      onRename: (l) =>
        modalForm({
          title: 'Edit lesson',
          fields: [
            { name: 'title', label: 'Title', def: l.title },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              def: l.description || '',
            },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: ['draft', 'published'],
              def: l.status,
            },
          ],
          onSubmit: async ({ values }) => {
            const r = await api({
              method: 'PATCH',
              path: `/curriculum/school/lessons/${l.id}`,
              body: values,
            });
            if (r.ok) {
              toast('Lesson saved');
              loadLessons();
            }
            return r.ok;
          },
        }),
      onDelete: async (l) => {
        if (!confirm(`Delete lesson “${l.title}”?`)) return;
        const r = await api({
          method: 'DELETE',
          path: `/curriculum/school/lessons/${l.id}`,
        });
        if (r.ok) {
          toast('Lesson deleted');
          loadLessons();
        }
      },
      onMove: (i, d) => {
        if (move(lessons, i, d)) {
          lessonsDirty = true;
          paint();
        }
      },
      onSaveOrder: async () => {
        const r = await api({
          method: 'POST',
          path: `/curriculum/school/lessons/order/${selUnit.id}`,
          body: { ids: lessons.map((l) => l.id) },
        });
        if (r.ok) {
          toast('Lesson order saved');
          lessonsDirty = false;
          paint();
        }
      },
    });
  }

  trackSel.onchange = loadCourses;

  m.append(
    el(
      'div',
      { class: 'block' },
      el(
        'div',
        { class: 'bh' },
        el('span', { class: 'mtag GET' }, 'GET'),
        el('span', { class: 't' }, 'Browse & edit the tree'),
        el(
          'span',
          { class: 'm' },
          '/curriculum/school/courses · units · lessons',
        ),
      ),
      el(
        'div',
        { class: 'bb' },
        el(
          'div',
          {
            style: 'display:flex;gap:8px;align-items:center;margin-bottom:12px',
          },
          el('span', { style: 'font-size:12px;color:var(--muted)' }, 'Track:'),
          trackSel,
          el('button', { class: 'btn ghost', onclick: loadCourses }, 'Reload'),
        ),
        el('div', { class: 'cols' }, coursesCol, unitsCol, lessonsCol),
      ),
    ),
  );

  paint();
  loadTracks();
}

/* ─── Owner: questions ──────────────────────────────────────────── */

function questionEditors() {
  // dynamic answer-key editors, one per question type
  const host = el('div', { class: 'fld wide' });
  let type = '';
  let optionRows = [],
    matchRows = [];
  let tfSelect = null;

  function optionRow(init = {}) {
    const text = el('input', {
      type: 'text',
      placeholder: 'option text…',
      value: init.text || '',
    });
    const ck = el('input', { type: 'checkbox' });
    ck.checked = !!init.isCorrect;
    const row = el(
      'div',
      { class: 'qrow' },
      text,
      el('label', { class: 'ck' }, ck, 'correct'),
      el(
        'button',
        {
          class: 'rm',
          onclick: () => {
            optionRows = optionRows.filter((r) => r !== entry);
            row.remove();
          },
        },
        '×',
      ),
    );
    const entry = {
      row,
      get: () => ({ text: text.value.trim(), isCorrect: ck.checked }),
    };
    optionRows.push(entry);
    return row;
  }

  function matchRow(init = {}) {
    const text = el('input', {
      type: 'text',
      placeholder: 'item text…',
      value: init.text || '',
    });
    const typeSel = el(
      'select',
      {},
      el('option', { value: 'base' }, 'base'),
      el('option', { value: 'match' }, 'match'),
    );
    typeSel.value = init.type || 'base';
    const idx = el('input', {
      class: 'num',
      type: 'number',
      placeholder: 'idx',
      min: '0',
      value: init.correctIndex ?? '',
    });
    const syncIdx = () => {
      idx.disabled = typeSel.value !== 'base';
    };
    typeSel.onchange = syncIdx;
    syncIdx();
    const row = el(
      'div',
      { class: 'qrow' },
      text,
      typeSel,
      idx,
      el(
        'button',
        {
          class: 'rm',
          onclick: () => {
            matchRows = matchRows.filter((r) => r !== entry);
            row.remove();
          },
        },
        '×',
      ),
    );
    const entry = {
      row,
      get: () => {
        const o = { text: text.value.trim(), type: typeSel.value };
        if (typeSel.value === 'base' && idx.value !== '')
          o.correctIndex = Number(idx.value);
        return o;
      },
    };
    matchRows.push(entry);
    return row;
  }

  function render(t, initial) {
    type = t;
    host.innerHTML = '';
    optionRows = [];
    matchRows = [];
    tfSelect = null;
    if (!t) return;
    if (t === 'options') {
      const list = el('div', { class: 'qrows' });
      (initial?.options?.length ? initial.options : [{}, {}]).forEach((o) =>
        list.append(optionRow(o)),
      );
      host.append(
        el(
          'label',
          {},
          'Options ',
          el('span', { class: 'req' }, '* min 2, mark the correct one'),
        ),
        list,
        el(
          'button',
          {
            class: 'btn ghost',
            style: 'margin-top:6px',
            onclick: () => list.append(optionRow()),
          },
          '+ option',
        ),
      );
    } else if (t === 'match') {
      const list = el('div', { class: 'qrows' });
      (initial?.matchingItems?.length
        ? initial.matchingItems
        : [{ type: 'base' }, { type: 'match' }, { type: 'match' }]
      ).forEach((o) => list.append(matchRow(o)));
      host.append(
        el(
          'label',
          {},
          'Matching items ',
          el(
            'span',
            { class: 'req' },
            '* min 3 — “base” rows point at a match row via correctIndex (0-based)',
          ),
        ),
        list,
        el(
          'button',
          {
            class: 'btn ghost',
            style: 'margin-top:6px',
            onclick: () => list.append(matchRow()),
          },
          '+ item',
        ),
      );
    } else if (t === 'trueFalse') {
      tfSelect = el(
        'select',
        {},
        el('option', { value: 'true' }, 'true'),
        el('option', { value: 'false' }, 'false'),
      );
      if (initial?.correctAnswer !== undefined)
        tfSelect.value = String(initial.correctAnswer);
      host.append(
        el('label', {}, 'Correct answer ', el('span', { class: 'req' }, '*')),
        el('div', { style: 'max-width:160px' }, tfSelect),
      );
    }
  }

  function collect() {
    if (type === 'options') {
      const options = optionRows.map((r) => r.get()).filter((o) => o.text);
      if (options.length < 2)
        throw new Error('Options questions need at least 2 options');
      return { options };
    }
    if (type === 'match') {
      const matchingItems = matchRows.map((r) => r.get()).filter((o) => o.text);
      if (matchingItems.length < 3)
        throw new Error('Match questions need at least 3 items');
      return { matchingItems };
    }
    if (type === 'trueFalse')
      return { correctAnswer: tfSelect.value === 'true' };
    return {};
  }

  return { host, render, collect };
}

function questionComposer({
  blockTitle,
  method,
  pathOf,
  submitLabel,
  initial,
  editMode,
  onDone,
}) {
  // PATCH whitelists only title/type/answer-key — purpose & parent ids are create-only
  const fields = [
    {
      name: 'title',
      label: 'Question title',
      req: true,
      wide: true,
      def: initial?.title,
    },
  ];
  if (!editMode)
    fields.push(
      {
        name: 'purpose',
        label: 'Purpose',
        type: 'select',
        req: true,
        options: ['lesson', 'dailyChallenge'],
        def: initial?.purpose || 'lesson',
        hint: 'lesson → needs lessonId · dailyChallenge → needs courseId',
      },
      {
        name: 'lessonId',
        label: 'Lesson id',
        type: 'uuid',
        ctx: 'lessonId',
        def: initial?.lessonId,
      },
      {
        name: 'courseId',
        label: 'Course id',
        type: 'uuid',
        ctx: 'courseId',
        def: initial?.courseId,
      },
    );
  fields.push(
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      req: true,
      options: ['options', 'match', 'trueFalse'],
      def: initial?.type || 'options',
      hint: editMode
        ? 'the answer key below replaces the old one wholesale'
        : undefined,
    },
    {
      name: 'image',
      label: 'Image (optional)',
      type: 'file',
      accept: 'image/*',
    },
  );
  const form = buildForm(fields);
  const editors = questionEditors();
  form.el.append(editors.host);

  const typeInput = form.ctl.type.input;
  typeInput.addEventListener('change', () =>
    editors.render(typeInput.value, initial),
  );
  editors.render(typeInput.value, initial);

  const btn = el(
    'button',
    { class: 'btn', style: 'margin-top:12px' },
    submitLabel,
  );
  btn.onclick = async () => {
    let got;
    try {
      got = form.get();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const { values, files } = got;
    let key;
    try {
      key = editors.collect();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    const body = { ...values, ...key };
    if (!editMode) {
      if (body.purpose === 'lesson') delete body.courseId;
      if (body.purpose === 'dailyChallenge') delete body.lessonId;
    }
    let r;
    if (Object.keys(files).length) {
      r = await api({
        method,
        path: pathOf(),
        form: toFormData(body, files),
        auth: true,
      });
    } else {
      r = await api({ method, path: pathOf(), body });
    }
    if (r.ok) {
      toast(`${blockTitle} — ${r.status}`);
      onDone?.(r);
    }
  };

  return el(
    'div',
    { class: 'block' },
    el(
      'div',
      { class: 'bh' },
      el('span', { class: 'mtag ' + method, text: method }),
      el('span', { class: 't', text: blockTitle }),
      el('span', { class: 'm', text: pathOf() }),
    ),
    el(
      'div',
      { class: 'bb' },
      el(
        'div',
        { class: 'note' },
        'With an image attached the request goes as multipart and the answer key is sent as a JSON string — if the API rejects that combination, create without the image first, then attach it via edit.',
      ),
      form.el,
      btn,
    ),
  );
}

function renderOwnQuestions(m) {
  m.append(
    ...screenHead(
      'Questions (owner)',
      'Filter by the lesson/course you selected in the tree. The composer below builds the right answer-key shape per type.',
    ),
  );

  const list = listBlock({
    title: 'My questions',
    path: '/curriculum/school/questions',
    pag: PAGF,
    filters: [
      { name: 'title', label: 'title contains' },
      { name: 'lessonId', label: 'lesson', type: 'uuid', ctx: 'lessonId' },
      { name: 'courseId', label: 'course', type: 'uuid', ctx: 'courseId' },
    ],
    select: { slot: 'questionId', label: (r) => (r.title || '').slice(0, 40) },
    bulk: {
      label: 'Delete selected',
      path: '/curriculum/school/questions/bulk-delete',
    },
    rowActions: [
      {
        label: 'View',
        onClick: async (row) => {
          const r = await api({
            method: 'GET',
            path: `/curriculum/school/questions/${row.id}`,
          });
          if (r.ok) modalJson('Question', r.data);
        },
      },
      {
        label: 'Edit',
        onClick: async (row, { refetch }) => {
          const r = await api({
            method: 'GET',
            path: `/curriculum/school/questions/${row.id}`,
          });
          if (!r.ok) return;
          const q = r.data || row;
          openModal(
            el(
              'div',
              {},
              el('h3', { text: 'Edit question' }),
              el(
                'div',
                { class: 'sub' },
                'Sending a type replaces the whole answer key. Title-only edits keep the old key.',
              ),
              (() => {
                const composer = questionComposer({
                  blockTitle: 'Save question',
                  method: 'PATCH',
                  pathOf: () => `/curriculum/school/questions/${q.id}`,
                  submitLabel: 'Save changes',
                  initial: q,
                  editMode: true,
                  onDone: () => {
                    closeModal();
                    refetch();
                  },
                });
                composer.querySelector('.bh')?.remove();
                composer.querySelector('.note')?.remove();
                composer.style.border = 'none';
                composer.style.background = 'transparent';
                return composer;
              })(),
            ),
          );
        },
      },
      deleteAction({
        path: (r) => `/curriculum/school/questions/${r.id}`,
        what: 'question',
      }),
    ],
  });
  m.append(list);

  m.append(
    questionComposer({
      blockTitle: 'Create question',
      method: 'POST',
      pathOf: () => '/curriculum/school/questions',
      submitLabel: 'Create question',
      onDone: () => list.refetch(),
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Bulk create (JSON, no images)',
      path: '/curriculum/school/questions/bulk',
      fields: [
        {
          name: 'questions',
          label: 'questions array',
          type: 'json',
          req: true,
          wide: true,
          def: JSON.stringify(
            {
              questions: [
                {
                  title: 'كم يساوي ٢ + ٢؟',
                  type: 'options',
                  purpose: 'lesson',
                  lessonId: ctxVal('lessonId') || '⟨lessonId⟩',
                  options: [{ text: '٣' }, { text: '٤', isCorrect: true }],
                },
              ],
            },
            null,
            2,
          ),
        },
      ],
      buildBody: (v) => {
        const payload = v.questions;
        return payload.questions
          ? payload
          : { questions: Array.isArray(payload) ? payload : [payload] };
      },
    }),
  );
}

/* ─── Owner: daily challenge ────────────────────────────────────── */

function renderOwnDaily(m) {
  m.append(
    ...screenHead(
      'Daily challenge (owner)',
      'One challenge per accessible track per day — 2 questions per course, drawn from your <code>dailyChallenge</code>-purpose pool. A used question never repeats, so keep every course stocked: one starving course blocks its whole track.',
    ),
  );

  const content = el('div');

  function qTable(ch) {
    const rows = (ch.usedQuestions || [])
      .map((u) => u.question)
      .filter(Boolean);
    const tbody = el('tbody', {});
    rows.forEach((q, i) =>
      tbody.append(
        el(
          'tr',
          {},
          el('td', {}, String(i + 1)),
          el('td', {}, renderCell(q.title, 'title')),
          el('td', {}, q.type || '—'),
          el(
            'td',
            { class: 'acts' },
            el(
              'button',
              { class: 'mini', onclick: () => modalJson(q.title, q) },
              'View',
            ),
          ),
        ),
      ),
    );
    return el(
      'div',
      { class: 'tblwrap' },
      el(
        'table',
        {},
        el(
          'thead',
          {},
          el(
            'tr',
            {},
            el('th', { style: 'width:30px' }, '#'),
            el('th', {}, 'question'),
            el('th', {}, 'type'),
            el('th', {}, ''),
          ),
        ),
        tbody,
      ),
    );
  }

  async function load() {
    const r = await api({
      method: 'GET',
      path: '/curriculum/school/daily-challenge',
    });
    if (!r.ok) return;
    content.innerHTML = '';
    const challenges = r.data?.challenges || [];
    const report = r.data?.unUsedQuestions || [];

    if (!challenges.length) {
      content.append(
        el(
          'div',
          {
            class: 'cempty',
            style: 'padding:12px 4px;color:var(--faint);font-style:italic',
          },
          'No challenge built for today yet — generate below, or check the pool report first.',
        ),
      );
    }
    for (const ch of challenges) {
      content.append(
        el(
          'div',
          { style: 'margin-top:14px' },
          el(
            'div',
            {
              style:
                'display:flex;gap:10px;align-items:baseline;margin-bottom:6px;flex-wrap:wrap',
            },
            el('b', {}, ch.track?.name || ch.track?.title || 'track?'),
            el(
              'span',
              { style: 'color:var(--muted);font-size:12px' },
              ch.date || '',
            ),
            el(
              'span',
              { style: 'color:var(--faint);font-size:12px' },
              `${(ch.usedQuestions || []).length} questions`,
            ),
            el(
              'code',
              {
                title: ch.id + ' — click to copy',
                style: 'cursor:pointer;font-size:11px',
                onclick: () => copyText(ch.id),
              },
              String(ch.id).slice(0, 8) + '…',
            ),
          ),
          qTable(ch),
        ),
      );
    }

    const tbody = el('tbody', {});
    for (const row of report) {
      const short = (row.remainingQuestions ?? 0) < 2;
      tbody.append(
        el(
          'tr',
          {},
          el('td', {}, row.trackName || ''),
          el('td', {}, row.courseName || ''),
          el(
            'td',
            {},
            el(
              'span',
              {
                style: short
                  ? 'color:var(--err);font-weight:600'
                  : 'color:var(--ok)',
              },
              String(row.remainingQuestions),
            ),
          ),
          el(
            'td',
            {},
            short
              ? el(
                  'span',
                  { style: 'color:var(--err);font-size:11.5px' },
                  'starving — blocks its whole track',
                )
              : '',
          ),
        ),
      );
    }
    content.append(
      el(
        'div',
        { style: 'margin-top:18px' },
        el(
          'div',
          { style: 'font-size:12px;color:var(--muted);margin-bottom:6px' },
          'Unused pool per course — below 2 and the next challenge for that course’s entire track is skipped.',
        ),
        report.length
          ? el(
              'div',
              { class: 'tblwrap' },
              el(
                'table',
                {},
                el(
                  'thead',
                  {},
                  el(
                    'tr',
                    {},
                    el('th', {}, 'track'),
                    el('th', {}, 'course'),
                    el('th', {}, 'unused left'),
                    el('th', {}, ''),
                  ),
                ),
                tbody,
              ),
            )
          : el(
              'div',
              {
                class: 'cempty',
                style: 'color:var(--faint);font-style:italic',
              },
              'No accessible tracks (or no courses in them) — nothing to report.',
            ),
      ),
    );
  }

  m.append(
    el(
      'div',
      { class: 'block' },
      el(
        'div',
        { class: 'bh' },
        el('span', { class: 'mtag GET' }, 'GET'),
        el('span', { class: 't' }, 'Today’s challenges & question pool'),
        el('span', { class: 'm' }, '/curriculum/school/daily-challenge'),
      ),
      el(
        'div',
        { class: 'bb' },
        el(
          'div',
          { class: 'note' },
          'Returns { challenges, unUsedQuestions } — one challenge per track that could build one today, plus how many unused pool questions each course still has.',
        ),
        el('button', { class: 'btn', onclick: load }, 'Refresh'),
        content,
      ),
    ),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Generate today’s challenges',
      path: '/curriculum/school/daily-challenge',
      note: 'Idempotent — same routine the midnight cron runs. Builds one challenge per accessible track; a track whose courses lack unused <code>dailyChallenge</code> questions is skipped silently (see the pool report above).',
      submitLabel: 'Generate now',
      onDone: load,
    }),
  );

  setTimeout(load, 40);
}

/* ─── Owner: students & keys ────────────────────────────────────── */

function renderOwnStudents(m) {
  m.append(
    ...screenHead(
      'My students (owner)',
      'Students who redeemed a key (or trial) into this school. Toggle activation per student.',
    ),
  );

  m.append(
    listBlock({
      title: 'My students',
      path: '/student/school',
      pag: PAGF,
      filters: [
        { name: 'name', label: 'name contains' },
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: { slot: 'studentId', label: (r) => r.user?.name || r.name || '' },
      rowActions: [
        {
          label: (r) => (r.active ? 'Deactivate' : 'Activate'),
          onClick: async (row, { refetch }) => {
            const r = await api({
              method: 'PATCH',
              path: `/student/school/activation/${row.id}`,
              body: { active: !row.active },
            });
            if (r.ok) {
              toast(row.active ? 'Deactivated' : 'Activated');
              refetch();
            }
          },
        },
        {
          label: 'View',
          onClick: async (row) => {
            const r = await api({
              method: 'GET',
              path: `/student/school/${row.id}`,
            });
            if (r.ok) modalJson('Student profile', r.data);
          },
        },
      ],
    }),
  );
}

function renderOwnKeys(m) {
  m.append(
    ...screenHead(
      'My keys (owner)',
      'Keys minted by the admin for this school. Redeemed ones show which subscription consumed them.',
    ),
  );

  m.append(
    listBlock({
      title: 'School keys',
      path: '/subscription/keys/school',
      pag: PAGF,
      filters: [
        { name: 'trackId', label: 'track', type: 'uuid', ctx: 'trackId' },
      ],
      select: {
        slot: 'keyId',
        label: (r) => r.key || '',
        also: (r) => {
          if (r.key) setCtx('key', r.key, 'redeem code');
        },
      },
    }),
  );
}

/* ─── Student corner ────────────────────────────────────────────── */

function renderStudent(m) {
  m.append(
    ...screenHead(
      'Student corner',
      'Everything a student session can do. Redeem the <code>key</code> captured from the admin/owner key screens.',
    ),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My profile',
      path: '/student/profile',
      note: 'Works even when the subscription expired or the school deactivated you — so the app can prompt a renewal.',
      onDone: (r) => {
        if (r.data?.id)
          setCtx('studentId', r.data.id, r.data.user?.name || 'me');
      },
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My subscription',
      path: '/subscription/me',
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Redeem a subscription key',
      path: '/subscription/subscribe',
      fields: [
        {
          name: 'key',
          label: 'Key',
          req: true,
          ctx: 'key',
          ph: 'paste or ⤓ from context',
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Start a free trial',
      path: '/subscription/freeTrial',
      note: 'Free trial runs on the default school — the track must be granted to it.',
      fields: [
        {
          name: 'trackId',
          label: 'Track id',
          type: 'uuid',
          ctx: 'trackId',
          req: true,
        },
      ],
    }),
  );
}

/* ─── Student: solving & learning ───────────────────────────────── */

function renderStuSolving(m) {
  m.append(
    ...screenHead(
      'Solving & learning (student)',
      'Curriculum, books, saved questions, and the lesson attempt flow. Needs a live subscription.',
    ),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My curriculum',
      path: '/learning/curriculum',
      note: 'Track + school come from your profile (published lessons only).',
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My books',
      path: '/books/student',
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'My saved questions',
      path: '/learning/saved-questions',
    }),
  );
  m.append(
    formBlock({
      method: 'POST',
      title: 'Save a question',
      path: '/learning/saved-questions',
      fields: [
        {
          name: 'questionId',
          label: 'Question id',
          type: 'uuid',
          ctx: 'questionId',
          req: true,
        },
      ],
    }),
  );
  m.append(
    formBlock({
      method: 'DELETE',
      title: 'Unsave a question',
      path: '/learning/saved-questions',
      fields: [
        {
          name: 'questionId',
          label: 'Question id',
          type: 'uuid',
          ctx: 'questionId',
          req: true,
        },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Start a lesson',
      path: '/learning/solving/student/start',
      note: 'Freezes the lesson; returns a snapshot id + questions with answer keys hidden. The id lands in context for /solve.',
      fields: [
        {
          name: 'lessonId',
          label: 'Lesson id',
          type: 'uuid',
          ctx: 'lessonId',
          req: true,
        },
      ],
      onDone: (r) => {
        if (r.data?.id) setCtx('snapshotId', r.data.id, 'snapshot');
      },
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Solve a lesson',
      path: '/learning/solving/student/solve',
      note: 'Grades against the snapshot; returns { verdict, xps, gems }.',
      fields: [
        {
          name: 'snapshotId',
          label: 'Snapshot id',
          type: 'uuid',
          ctx: 'snapshotId',
          req: true,
        },
        {
          name: 'answers',
          label: 'answers array',
          type: 'json',
          req: true,
          wide: true,
          def: JSON.stringify(
            [
              { id: '⟨questionId⟩', answer: { choiceId: '⟨optionId⟩' } },
              { id: '⟨questionId⟩', answer: { boolAnswer: true } },
              {
                id: '⟨questionId⟩',
                answer: {
                  matches: [{ baseId: '⟨baseId⟩', matchId: '⟨matchId⟩' }],
                },
              },
            ],
            null,
            2,
          ),
        },
      ],
      buildBody: (v) => ({ snapshotId: v.snapshotId, answers: v.answers }),
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Daily challenge (today)',
      path: '/learning/solving/student/daily-challenge',
      note: 'Today’s challenge for your profile’s track. Unattempted → { solved:false, questions } with answer keys hidden; already solved → { solved:true, score, total, verdict } (no questions).',
    }),
  );

  m.append(
    formBlock({
      method: 'POST',
      title: 'Solve daily challenge',
      path: '/learning/solving/student/daily-challenge/solve',
      note: 'One attempt only per student. No snapshot — answers reference the challenge’s question ids. Returns { verdict }.',
      fields: [
        {
          name: 'answers',
          label: 'answers array',
          type: 'json',
          req: true,
          wide: true,
          def: JSON.stringify(
            [
              { id: '⟨questionId⟩', answer: { choiceId: '⟨optionId⟩' } },
              { id: '⟨questionId⟩', answer: { boolAnswer: true } },
              {
                id: '⟨questionId⟩',
                answer: {
                  matches: [{ baseId: '⟨baseId⟩', matchId: '⟨matchId⟩' }],
                },
              },
            ],
            null,
            2,
          ),
        },
      ],
      buildBody: (v) => ({ answers: v.answers }),
    }),
  );

  m.append(
    listBlock({
      title: 'My attempts',
      path: '/learning/solving/student/attempts',
      pag: PAGF,
      filters: [{ name: 'completed', label: 'completed (true/false)' }],
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Leaderboard (my track)',
      path: '/learning/solving/student/leaderboard',
    }),
  );
}

/* ─── Owner: solving ────────────────────────────────────────────── */

function renderOwnSolving(m) {
  m.append(
    ...screenHead(
      'Solving (owner)',
      'Read-only: your school’s lesson attempts and the per-track leaderboard.',
    ),
  );

  m.append(
    listBlock({
      title: 'Attempts',
      path: '/learning/solving/school/attempts',
      pag: PAGF,
      filters: [
        { name: 'studentId', label: 'student', type: 'uuid', ctx: 'studentId' },
        { name: 'completed', label: 'completed (true/false)' },
      ],
    }),
  );

  m.append(
    formBlock({
      method: 'GET',
      title: 'Leaderboard (by track)',
      path: '/learning/solving/school/leaderboard/:trackId',
      fields: [
        {
          name: 'trackId',
          label: 'Track id',
          type: 'uuid',
          ctx: 'trackId',
          req: true,
        },
      ],
    }),
  );
}

/* ─── nav & routing ─────────────────────────────────────────────── */

const NAV = [
  {
    group: 'Start',
    items: [{ id: 'home', title: 'Overview', who: '', render: renderHome }],
  },
  {
    group: 'Session',
    items: [
      { id: 'auth', title: 'Sign in & tokens', who: 'pub', render: renderAuth },
      { id: 'account', title: 'My account', who: 'any', render: renderAccount },
    ],
  },
  {
    group: 'Public',
    items: [
      {
        id: 'tracks',
        title: 'Tracks & meta',
        who: 'pub',
        render: renderTracks,
      },
      {
        id: 'pubcontent',
        title: 'FAQs & info',
        who: 'pub',
        render: renderPublicContent,
      },
      { id: 'wisdom', title: 'Daily wisdom', who: 'pub', render: renderWisdom },
      { id: 'files', title: 'File viewer', who: 'pub', render: renderFiles },
    ],
  },
  {
    group: 'Admin',
    items: [
      { id: 'adm-users', title: 'Users', who: 'adm', render: renderAdmUsers },
      {
        id: 'adm-schools',
        title: 'Schools',
        who: 'adm',
        render: renderAdmSchools,
      },
      {
        id: 'adm-access',
        title: 'Track access',
        who: 'adm',
        render: renderAdmAccess,
      },
      {
        id: 'adm-content',
        title: 'Content overview',
        who: 'adm',
        render: renderAdmContent,
      },
      {
        id: 'adm-students',
        title: 'Students',
        who: 'adm',
        render: renderAdmStudents,
      },
      {
        id: 'adm-subs',
        title: 'Subscriptions',
        who: 'adm',
        render: renderAdmSubs,
      },
      { id: 'adm-keys', title: 'Keys', who: 'adm', render: renderAdmKeys },
    ],
  },
  {
    group: 'School owner',
    items: [
      {
        id: 'own-school',
        title: 'My school',
        who: 'own',
        render: renderOwnSchool,
      },
      { id: 'own-books', title: 'Books', who: 'own', render: renderOwnBooks },
      { id: 'own-tree', title: 'Content tree', who: 'own', render: renderTree },
      {
        id: 'own-questions',
        title: 'Questions',
        who: 'own',
        render: renderOwnQuestions,
      },
      {
        id: 'own-daily',
        title: 'Daily challenge',
        who: 'own',
        render: renderOwnDaily,
      },
      {
        id: 'own-solving',
        title: 'Solving',
        who: 'own',
        render: renderOwnSolving,
      },
      {
        id: 'own-students',
        title: 'My students',
        who: 'own',
        render: renderOwnStudents,
      },
      { id: 'own-keys', title: 'My keys', who: 'own', render: renderOwnKeys },
    ],
  },
  {
    group: 'Student',
    items: [
      {
        id: 'student',
        title: 'Student corner',
        who: 'stu',
        render: renderStudent,
      },
      {
        id: 'stu-solving',
        title: 'Solving & learning',
        who: 'stu',
        render: renderStuSolving,
      },
    ],
  },
];

const WHO_BADGE = {
  pub: 'PUB',
  any: 'AUTH',
  adm: 'ADM',
  own: 'OWN',
  stu: 'STU',
  '': '',
};

function renderNav() {
  const nav = $('nav');
  nav.innerHTML = '';
  for (const g of NAV) {
    const grp = el(
      'div',
      { class: 'group' },
      el('div', { class: 'gt', text: g.group }),
    );
    for (const item of g.items) {
      grp.append(
        el(
          'button',
          {
            class: 'item' + (store.lastScreen === item.id ? ' on' : ''),
            onclick: () => showScreen(item.id),
          },
          item.title,
          el('span', { class: 'who', text: WHO_BADGE[item.who] || '' }),
        ),
      );
    }
    nav.append(grp);
  }
}

function findScreen(id) {
  for (const g of NAV) for (const it of g.items) if (it.id === id) return it;
  return NAV[0].items[0];
}

function showScreen(id) {
  store.lastScreen = id;
  save();
  renderNav();
  const m = $('main');
  m.innerHTML = '';
  m.scrollTop = 0;
  findScreen(id).render(m);
}

/* ─── env switch & ping ─────────────────────────────────────────── */

function renderEnvSwitch() {
  const host = $('envswitch');
  host.innerHTML = '';
  for (const [k, e] of Object.entries(ENVS)) {
    host.append(
      el(
        'button',
        {
          class: envKey() === k ? 'on' : '',
          title: e.base,
          onclick: () => {
            store.env = k;
            save();
            renderEnvSwitch();
            renderSessions();
            renderCtx();
            showScreen(store.lastScreen);
            $('pingbtn').className = '';
            toast(`Environment → ${e.label} (${e.base})`);
          },
        },
        e.label,
      ),
    );
  }
}

async function ping() {
  const btn = $('pingbtn');
  btn.className = '';
  const t0 = performance.now();
  try {
    const r = await fetch(base() + '/ping');
    const txt = await r.text();
    const ms = Math.round(performance.now() - t0);
    addLog({
      method: 'GET',
      url: base() + '/ping',
      status: r.status,
      ms,
      req: null,
      res: txt,
      who: 'guest',
    });
    btn.className = r.ok ? 'ok' : 'bad';
    toast(r.ok ? `pong — ${ms}ms` : `ping failed (${r.status})`, !r.ok);
  } catch (e) {
    btn.className = 'bad';
    addLog({
      method: 'GET',
      url: base() + '/ping',
      status: 0,
      ms: Math.round(performance.now() - t0),
      req: null,
      res: String(e),
      who: 'guest',
    });
    toast(`Can't reach ${ENVS[envKey()].label}`, true);
  }
}

/* ─── boot ──────────────────────────────────────────────────────── */

$('pingbtn').onclick = ping;
$('consolehead').onclick = (e) => {
  if (e.target.id === 'consoleclear') return;
  $('console').classList.toggle('closed');
};
$('consoleclear').onclick = (e) => {
  e.stopPropagation();
  consoleLog.length = 0;
  renderConsole();
};

renderEnvSwitch();
renderSessions();
renderCtx();
renderNav();
showScreen(store.lastScreen || 'home');
renderConsole();
