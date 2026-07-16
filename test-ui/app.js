/* Nukhba console — a manual API bench driven entirely by the Postman
   collection (test-ui/collection.js, generated from postman/…json).

   Nothing about the API is described twice: add a request to the collection,
   run `npm run test-ui:sync`, and it shows up here with its params, body and
   docs. Requests go out exactly as typed — no client-side validation — so the
   backend's own validation is what gets exercised.

   Sessions are per environment, so an admin, an owner and a student can stay
   signed in at once and you switch with the header chips. */

const C = window.__COLLECTION__;

const ENVS = {
  local: { label: 'local', origin: 'http://localhost:3000' },
  prod: { label: 'prod', origin: 'https://alnokhba-app.com' },
};

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const MAX_IDS = 12;

/* ── tiny helpers ─────────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/* Only id-shaped fields get a paste-from-tray button — putting one next to
   `title` or `type` is just noise. Matches id, ids, lessonId, trackId… */
const looksLikeId = (k) => /(^|\[)ids?$|ids?$/i.test(k);

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('nk.' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('nk.' + k, JSON.stringify(v));
    } catch {}
  },
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.setAttribute('data-on', '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.removeAttribute('data-on'), 1800);
}

/* ── state ────────────────────────────────────────────────────────────── */
let ENV = ENVS[store.get('env')] ? store.get('env') : 'local';
let current = null; // active request
let tab = 'body';
const files = {}; // requestKey -> fieldKey -> File (can't be persisted)

const sessions = () => store.get(`sessions.${ENV}`, []);
const setSessions = (v) => store.set(`sessions.${ENV}`, v);
const activeIdx = () => store.get(`active.${ENV}`, -1);
const setActiveIdx = (i) => store.set(`active.${ENV}`, i);
const active = () => sessions()[activeIdx()] || null;

const ids = () => store.get(`ids.${ENV}`, []);
const setIds = (v) => store.set(`ids.${ENV}`, v.slice(0, MAX_IDS));

/* ── collection → flat list ───────────────────────────────────────────── */
function flatten(items, trail = []) {
  const out = [];
  for (const it of items) {
    if (it.item) out.push(...flatten(it.item, [...trail, it.name]));
    else if (it.request)
      out.push({
        key: [...trail, it.name].join(' / '),
        folder: trail.join(' / '),
        name: it.name,
        r: it.request,
      });
  }
  return out;
}
const REQS = flatten(C.item);

/* ── variables & substitution ─────────────────────────────────────────── */
function vars() {
  const s = active();
  const v = { baseUrl: ENVS[ENV].origin, accessToken: '', refreshToken: '' };
  for (const cv of C.variable || []) if (!(cv.key in v)) v[cv.key] = cv.value;
  if (s) {
    v.accessToken = s.accessToken || '';
    v.refreshToken = s.refreshToken || '';
  }
  return v;
}
function subst(str) {
  if (typeof str !== 'string') return str;
  const v = vars();
  return str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m));
}

/* ── per-request draft ────────────────────────────────────────────────── */
/* Seeded from the collection, then whatever you type is remembered per
   request per environment — ids you paste in survive a reload. */
function seed(req) {
  const u = req.r.url || {};
  return {
    path: Object.fromEntries((u.variable || []).map((v) => [v.key, v.value || ''])),
    query: (u.query || []).map((q) => ({
      key: q.key,
      value: q.value || '',
      on: !q.disabled,
    })),
    raw: req.r.body?.mode === 'raw' ? req.r.body.raw || '' : '',
    form:
      req.r.body?.mode === 'formdata'
        ? req.r.body.formdata.map((f) => ({
            key: f.key,
            value: f.value || '',
            type: f.type || 'text',
            on: !f.disabled,
            desc: f.description || '',
          }))
        : [],
  };
}
function draft(req) {
  const saved = store.get(`draft.${ENV}.${req.key}`, null);
  const base = seed(req);
  if (!saved) return base;
  // merge, so collection edits (new fields) still appear on old drafts
  return {
    path: { ...base.path, ...saved.path },
    query: base.query.map((q) => {
      const s = (saved.query || []).find((x) => x.key === q.key);
      return s ? { ...q, value: s.value, on: s.on } : q;
    }),
    raw: saved.raw ?? base.raw,
    form: base.form.map((f) => {
      const s = (saved.form || []).find((x) => x.key === f.key);
      return s ? { ...f, value: s.value, on: s.on } : f;
    }),
  };
}
function saveDraft(req, d) {
  store.set(`draft.${ENV}.${req.key}`, {
    path: d.path,
    query: d.query.map(({ key, value, on }) => ({ key, value, on })),
    raw: d.raw,
    form: d.form.map(({ key, value, on }) => ({ key, value, on })),
  });
}

/* ── url building ─────────────────────────────────────────────────────── */
function pathVarsOf(req) {
  const u = req.r.url || {};
  const declared = (u.variable || []).map((v) => v.key);
  // trust the path itself over the variable[] block — they can disagree
  const inPath = (u.path || []).filter((p) => p.startsWith(':')).map((p) => p.slice(1));
  return [...new Set([...inPath, ...declared])];
}
function buildUrl(req, d) {
  const u = req.r.url || {};
  const origin = subst((u.host || []).join('.')).replace(/\/+$/, '');
  const path = (u.path || [])
    .map((seg) =>
      seg.startsWith(':')
        ? encodeURIComponent(subst(d.path[seg.slice(1)] || '')) || `:${seg.slice(1)}`
        : seg,
    )
    .join('/');
  const qs = d.query
    .filter((q) => q.on && q.key)
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(subst(q.value))}`)
    .join('&');
  return origin + '/' + path + (qs ? '?' + qs : '');
}

/* ── render: sidebar ──────────────────────────────────────────────────── */
function renderTree(filter = '') {
  const tree = $('#tree');
  tree.textContent = '';
  const q = filter.trim().toLowerCase();
  const groups = new Map();
  for (const r of REQS) {
    if (q && !(r.key + ' ' + r.r.method + ' ' + (r.r.url?.raw || '')).toLowerCase().includes(q))
      continue;
    if (!groups.has(r.folder)) groups.set(r.folder, []);
    groups.get(r.folder).push(r);
  }
  if (!groups.size) {
    tree.append(el('div', 'empty', 'No requests match.'));
    return;
  }
  for (const [folder, list] of groups) {
    const d = el('details', 'folder');
    d.open = !!q || (current && current.folder === folder);
    const s = el('summary');
    s.append(el('span', null, folder.split(' / ').pop()), el('span', 'n', String(list.length)));
    d.append(s);
    for (const r of list) {
      const b = el('button', 'req');
      b.style.setProperty('--m', `var(--${r.r.method.toLowerCase()})`);
      b.title = `${r.r.method} ${r.key}`; // names outrun the sidebar
      b.append(el('span', 'verb', r.r.method), el('span', 'label', r.name));
      if (current && current.key === r.key) b.setAttribute('aria-current', 'true');
      b.onclick = () => open(r);
      d.append(b);
    }
    tree.append(d);
  }
}

/* ── render: request ──────────────────────────────────────────────────── */
function open(req) {
  current = req;
  const d = draft(req);
  const has = { path: pathVarsOf(req).length, query: d.query.length, body: !!req.r.body };
  tab = has.body ? 'body' : has.path ? 'path' : has.query ? 'query' : 'docs';
  renderTree($('#search').value);
  renderReq();
}

function renderReq() {
  if (!current) return;
  const req = current;
  const d = draft(req);

  $('#verb').textContent = req.r.method;
  $('#verb').style.setProperty('--m', `var(--${req.r.method.toLowerCase()})`);
  $('#send').disabled = false;

  const url = buildUrl(req, d);
  $('#url').innerHTML = url
    .replace(/^(https?:\/\/[^/]+)/, '<b>$1</b>')
    .replace(/(:[a-zA-Z]\w*)/g, '<i>$1</i>');

  // tabs
  const tabsEl = $('#tabs');
  tabsEl.textContent = '';
  const defs = [
    ['path', 'Path', pathVarsOf(req).length],
    ['query', 'Query', d.query.filter((q) => q.on).length],
    ['body', 'Body', req.r.body ? (req.r.body.mode === 'raw' ? 1 : d.form.length) : 0],
    ['headers', 'Headers', 0],
    ['docs', 'Docs', 0],
  ];
  for (const [id, label, n] of defs) {
    if (id === 'path' && !pathVarsOf(req).length) continue;
    if (id === 'query' && !d.query.length) continue;
    if (id === 'body' && !req.r.body) continue;
    if (id === 'docs' && !req.r.description) continue;
    const b = el('button', null, label);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(tab === id));
    if (n) b.append(el('span', 'badge', String(n)));
    b.onclick = () => {
      tab = id;
      renderReq();
    };
    tabsEl.append(b);
  }

  for (const p of document.querySelectorAll('.pane')) {
    p.textContent = '';
    p.toggleAttribute('data-on', p.dataset.pane === tab);
  }
  ({ path: paneP, query: paneQ, body: paneB, headers: paneH, docs: paneD })[tab]?.(req, d);
}

/* Paste-the-newest-caught-id button. Returns a spacer for non-id fields so
   the grid columns still line up. */
function pickBtn(key, input, apply) {
  if (!looksLikeId(key)) return el('span');
  const b = el('button', 'pick', '↑ last id');
  const list = ids();
  b.disabled = !list.length;
  b.title = list.length ? 'Paste ' + list[0].v : 'No ids caught yet — click one in a response';
  b.onclick = () => {
    const v = ids()[0]?.v;
    if (!v) return;
    input.value = v;
    apply(v);
  };
  return b;
}

/* pane: path variables — every one of these is an id, so all get the button */
function paneP(req, d) {
  const p = $('.pane[data-pane="path"]');
  const keys = pathVarsOf(req);
  p.append(el('div', 'hint', 'Path variables. Use the tray button to paste a caught id.'));
  for (const k of keys) {
    const row = el('div', 'row');
    row.append(el('span', 'req-mark', '•'));
    row.append(el('span', 'k', ':' + k));
    const i = el('input');
    i.type = 'text';
    i.value = d.path[k] || '';
    i.placeholder = 'required';
    i.oninput = () => {
      d.path[k] = i.value;
      saveDraft(req, d);
      renderUrlOnly(req, d);
    };
    row.append(i);
    row.append(
      pickBtn(k, i, (v) => {
        d.path[k] = v;
        saveDraft(req, d);
        renderUrlOnly(req, d);
      }),
    );
    p.append(row);
  }
}

/* pane: query params — checkbox mirrors Postman's enabled/disabled */
function paneQ(req, d) {
  const p = $('.pane[data-pane="query"]');
  p.append(el('div', 'hint', 'Unchecked params are left off the URL entirely.'));
  for (const q of d.query) {
    const row = el('div', 'row');
    const c = el('input');
    c.type = 'checkbox';
    c.checked = q.on;
    c.onchange = () => {
      q.on = c.checked;
      saveDraft(req, d);
      renderReq();
    };
    row.append(c, el('span', 'k', q.key));
    const i = el('input');
    i.type = 'text';
    i.value = q.value;
    i.oninput = () => {
      q.value = i.value;
      saveDraft(req, d);
      renderUrlOnly(req, d);
    };
    row.append(i);
    row.append(
      pickBtn(q.key, i, (v) => {
        q.value = v;
        q.on = true;
        saveDraft(req, d);
        renderReq();
      }),
    );
    p.append(row);
  }
}

/* pane: body — raw JSON, or form-data with real file pickers */
function paneB(req, d) {
  const p = $('.pane[data-pane="body"]');

  if (req.r.body.mode === 'raw') {
    const tools = el('div', 'tools');
    const fmt = el('button', 'ghost', 'Format');
    fmt.onclick = () => {
      try {
        d.raw = JSON.stringify(JSON.parse(t.value), null, 2);
        t.value = d.raw;
        saveDraft(req, d);
      } catch (e) {
        toast('Not valid JSON: ' + e.message);
      }
    };
    const reset = el('button', 'ghost', 'Reset to collection');
    reset.onclick = () => {
      d.raw = seed(req).raw;
      t.value = d.raw;
      saveDraft(req, d);
    };
    tools.append(fmt, reset);
    p.append(tools);
    const t = el('textarea');
    t.value = d.raw;
    t.spellcheck = false;
    t.oninput = () => {
      d.raw = t.value;
      saveDraft(req, d);
    };
    p.append(t);
    return;
  }

  p.append(
    el(
      'div',
      'hint',
      'Multipart. Nested arrays use bracket keys (options[0][text]) — multer parses them into real arrays.',
    ),
  );
  for (const f of d.form) {
    const row = el('div', 'row');
    const c = el('input');
    c.type = 'checkbox';
    c.checked = f.on;
    c.onchange = () => {
      f.on = c.checked;
      saveDraft(req, d);
      renderReq();
    };
    row.append(c);
    const k = el('span', 'k');
    k.append(document.createTextNode(f.key));
    if (f.type === 'file') k.append(el('em', null, ' file'));
    k.title = f.desc || f.key;
    row.append(k);

    if (f.type === 'file') {
      const held = files[req.key]?.[f.key];
      const b = el('button', 'file', held ? held.name : 'Choose a file…');
      if (held) b.setAttribute('data-has', '');
      b.onclick = () => {
        const inp = el('input');
        inp.type = 'file';
        inp.onchange = () => {
          if (!inp.files[0]) return;
          files[req.key] = files[req.key] || {};
          files[req.key][f.key] = inp.files[0];
          f.on = true;
          saveDraft(req, d);
          renderReq();
        };
        inp.click();
      };
      row.append(b);
      const clr = el('button', 'pick', 'Clear');
      clr.disabled = !held;
      clr.onclick = () => {
        delete files[req.key]?.[f.key];
        renderReq();
      };
      row.append(clr);
    } else {
      const i = el('input');
      i.type = 'text';
      i.value = f.value;
      i.oninput = () => {
        f.value = i.value;
        saveDraft(req, d);
      };
      row.append(i);
      row.append(
        pickBtn(f.key, i, (v) => {
          f.value = v;
          saveDraft(req, d);
        }),
      );
    }
    p.append(row);
  }
}

function paneH(req) {
  const p = $('.pane[data-pane="headers"]');
  const s = active();
  const noauth = req.r.auth?.type === 'noauth';
  const rows = [];
  for (const h of req.r.header || []) rows.push([h.key, h.value]);
  if (req.r.body?.mode === 'formdata')
    rows.push(['Content-Type', 'multipart/form-data; boundary=… (set by the browser)']);
  if (noauth) rows.push(['Authorization', '— this request is marked noauth']);
  else if (s) rows.push(['Authorization', 'Bearer ' + (s.accessToken || '').slice(0, 24) + '…']);
  else rows.push(['Authorization', '— no session; sign in first']);

  p.append(el('div', 'hint', 'Sent headers. Auth comes from the active session chip.'));
  for (const [k, v] of rows) {
    const row = el('div', 'row');
    row.append(el('span'), el('span', 'k', k));
    const val = el('span', 'k');
    val.style.color = 'var(--ink)';
    val.textContent = v;
    row.append(val, el('span'));
    p.append(row);
  }
}

function paneD(req) {
  const p = $('.pane[data-pane="docs"]');
  const d = el('div', 'docs');
  d.innerHTML = esc(req.r.description || '')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  p.append(d);
}

function renderUrlOnly(req, d) {
  $('#url').innerHTML = buildUrl(req, d)
    .replace(/^(https?:\/\/[^/]+)/, '<b>$1</b>')
    .replace(/(:[a-zA-Z]\w*)/g, '<i>$1</i>');
}

/* ── send ─────────────────────────────────────────────────────────────── */
async function send() {
  if (!current) return;
  const req = current;
  const d = draft(req);
  const url = buildUrl(req, d);

  const headers = {};
  for (const h of req.r.header || []) if (!h.disabled) headers[h.key] = subst(h.value);
  const s = active();
  if (req.r.auth?.type !== 'noauth' && s?.accessToken)
    headers.Authorization = 'Bearer ' + s.accessToken;

  let body;
  if (req.r.body?.mode === 'raw' && d.raw.trim()) {
    body = subst(d.raw);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  } else if (req.r.body?.mode === 'formdata') {
    const fd = new FormData();
    for (const f of d.form) {
      if (!f.on || !f.key) continue;
      if (f.type === 'file') {
        const file = files[req.key]?.[f.key];
        if (file) fd.append(f.key, file);
      } else fd.append(f.key, subst(f.value));
    }
    body = fd;
    // never set Content-Type by hand here — the boundary has to come from
    // the browser or multer can't parse the body
    delete headers['Content-Type'];
  }

  $('#send').disabled = true;
  $('#status').textContent = '…';
  $('#status').removeAttribute('data-tone');
  $('#meta').textContent = '';
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: req.r.method, headers, body });
    const ms = Math.round(performance.now() - t0);
    const ct = res.headers.get('content-type') || '';
    const buf = await res.arrayBuffer();
    showRes(res, ct, buf, ms, req);
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    $('#status').textContent = 'Failed';
    $('#status').dataset.tone = 'bad';
    $('#meta').textContent = ms + ' ms';
    $('#body').textContent = '';
    const box = el('div', 'empty');
    box.textContent =
      `${e.message}. The request never reached ${new URL(url).origin} — ` +
      `check the server is up, and that the URL scheme matches.`;
    $('#body').append(box);
  } finally {
    $('#send').disabled = false;
  }
}

let lastText = '';
function showRes(res, ct, buf, ms, req) {
  const size = buf.byteLength;
  $('#status').textContent = res.status + ' ' + res.statusText;
  $('#status').dataset.tone = res.ok ? 'ok' : 'bad';
  $('#meta').textContent = `${ms} ms · ${size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' kB'}`;

  const b = $('#body');
  b.textContent = '';

  if (ct.startsWith('image/')) {
    const img = el('img');
    img.src = URL.createObjectURL(new Blob([buf], { type: ct }));
    img.alt = 'Response image';
    b.append(img);
    lastText = '';
    return;
  }

  const text = new TextDecoder().decode(buf);
  lastText = text;
  if (!text) {
    b.append(el('div', 'empty', 'Empty body.'));
    return;
  }

  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {}
  const pre = el('pre');
  pre.innerHTML = highlight(pretty);
  pre.addEventListener('click', (e) => {
    if (!e.target.classList.contains('uuid')) return;
    catchId(e.target.textContent, req.name);
  });
  b.append(pre);

  // auth responses carry tokens — offer to keep them as a session
  try {
    const j = JSON.parse(text);
    const data = j?.data ?? j;
    if (res.ok && data?.accessToken) rememberSession(data);
  } catch {}
}

/* json highlight; uuids become clickable so they can be caught */
function highlight(s) {
  return esc(s)
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)?/g, (m, inner, colon) =>
      colon
        ? `<span class="t-key">"${inner}"</span>${colon}`
        : `<span class="t-str">"${inner}"</span>`,
    )
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="t-num">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="t-lit">$1</span>')
    .replace(UUID_RE, '<button class="uuid">$&</button>');
}

/* ── the id tray ──────────────────────────────────────────────────────── */
function catchId(v, src) {
  navigator.clipboard?.writeText(v).catch(() => {});
  const list = ids().filter((x) => x.v !== v);
  list.unshift({ v, src: src || '' });
  setIds(list);
  renderTray();
  if (current) renderReq(); // re-enable the "↑ last id" buttons
  toast('Copied and kept · ' + v.slice(0, 8));
}
function renderTray() {
  const t = $('#tray');
  t.textContent = '';
  t.append(el('span', 'cap', 'Caught ids'));
  const list = ids();
  if (!list.length) {
    t.append(el('div', 'none', 'Click any id in a response to keep it here.'));
    return;
  }
  for (const item of list) {
    const chip = el('div', 'id');
    const use = el('button', null);
    use.style.cssText = 'display:flex;gap:6px;align-items:center';
    use.append(el('span', 'src', item.src.slice(0, 18)), el('span', 'val', item.v.slice(0, 8)));
    use.title = item.v + '\nClick to copy';
    use.onclick = () => {
      navigator.clipboard?.writeText(item.v);
      toast('Copied ' + item.v.slice(0, 8));
    };
    const x = el('button', 'x', '×');
    x.title = 'Forget this id';
    x.onclick = () => {
      setIds(ids().filter((i) => i.v !== item.v));
      renderTray();
      if (current) renderReq();
    };
    chip.append(use, x);
    t.append(chip);
  }
  const clr = el('button', 'ghost', 'Clear');
  clr.onclick = () => {
    setIds([]);
    renderTray();
    if (current) renderReq();
  };
  t.append(clr);
}

/* ── sessions ─────────────────────────────────────────────────────────── */
function roleOf(user) {
  const r = user?.role;
  return (typeof r === 'string' ? r : r?.name || r?.type) || 'unknown';
}
function rememberSession(data) {
  const list = sessions();
  const label = data.user?.name || data.user?.email || 'signed in';
  const role = roleOf(data.user);
  const i = list.findIndex((s) => s.label === label && s.role === role);
  const s = {
    label,
    role,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || '',
  };
  if (i >= 0) list[i] = s;
  else list.push(s);
  setSessions(list);
  setActiveIdx(i >= 0 ? i : list.length - 1);
  renderSessions();
  toast(`Signed in as ${label} · ${role}`);
}
function renderSessions() {
  const box = $('#sessions');
  box.textContent = '';
  const list = sessions();
  const act = activeIdx();
  list.forEach((s, i) => {
    const c = el('button', 'chip');
    c.style.setProperty('--role', `var(--${s.role}, var(--mut))`);
    c.setAttribute('aria-pressed', String(i === act));
    c.title = `${s.label} · ${s.role}`;
    c.append(el('span', 'dot'), el('span', 'who', s.label));
    c.onclick = () => {
      setActiveIdx(i === act ? -1 : i);
      renderSessions();
      if (current) renderReq();
    };
    const x = el('span', 'x', '×');
    x.title = 'Sign out';
    x.onclick = (e) => {
      e.stopPropagation();
      const l = sessions();
      l.splice(i, 1);
      setSessions(l);
      if (act === i) setActiveIdx(-1);
      else if (act > i) setActiveIdx(act - 1);
      renderSessions();
      if (current) renderReq();
    };
    c.append(x);
    box.append(c);
  });
  document.body.dataset.role = list[act]?.role || '';
}

async function doLogin() {
  const email = $('#li-email').value.trim();
  const pass = $('#li-pass').value;
  if (!email || !pass) {
    $('#login-err').textContent = 'Email and password are both needed.';
    return;
  }
  $('#li-go').disabled = true;
  $('#login-err').textContent = '';
  try {
    const res = await fetch(ENVS[ENV].origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      $('#login-err').textContent = j?.message || `Sign in failed (${res.status}).`;
      return;
    }
    const data = j?.data ?? j;
    if (!data?.accessToken) {
      $('#login-err').textContent = 'No token came back — check the login response shape.';
      return;
    }
    rememberSession(data);
    $('#login').close();
    $('#li-pass').value = '';
  } catch (e) {
    $('#login-err').textContent = `Can't reach ${ENVS[ENV].origin} — ${e.message}`;
  } finally {
    $('#li-go').disabled = false;
  }
}

/* ── env ──────────────────────────────────────────────────────────────── */
function renderEnv() {
  const box = $('#env');
  box.textContent = '';
  for (const [k, v] of Object.entries(ENVS)) {
    const b = el('button', null, v.label);
    b.setAttribute('aria-pressed', String(k === ENV));
    b.title = v.origin;
    b.onclick = () => {
      ENV = k;
      store.set('env', k);
      document.body.dataset.env = k;
      renderEnv();
      renderSessions();
      renderTray();
      if (current) renderReq();
    };
    box.append(b);
  }
  document.body.dataset.env = ENV;
}

/* ── wiring ───────────────────────────────────────────────────────────── */
$('#send').onclick = send;
$('#search').oninput = (e) => renderTree(e.target.value);
$('#add-session').onclick = () => {
  $('#login-hint').textContent = `Signs in against ${ENVS[ENV].origin}`;
  $('#login-err').textContent = '';
  $('#login').showModal();
  $('#li-email').focus();
};
$('#li-cancel').onclick = () => $('#login').close();
$('#li-go').onclick = doLogin;
$('#login').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doLogin();
  }
});
$('#copy-res').onclick = () => {
  if (!lastText) return toast('Nothing to copy yet.');
  navigator.clipboard?.writeText(lastText);
  toast('Response copied');
};
$('#theme').onclick = () => {
  const next =
    document.documentElement.dataset.theme === 'dark'
      ? 'light'
      : document.documentElement.dataset.theme === 'light'
        ? ''
        : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  toast(next ? next + ' theme' : 'following your system theme');
};

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    send();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('#search').focus();
    $('#search').select();
  }
});

/* response pane resize */
(() => {
  const grip = $('#grip');
  let start = 0,
    h0 = 0;
  const move = (e) => {
    const h = Math.max(90, Math.min(window.innerHeight - 220, h0 + (start - e.clientY)));
    $('#res').style.height = h + 'px';
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    store.set('resH', $('#res').offsetHeight);
  };
  grip.addEventListener('mousedown', (e) => {
    start = e.clientY;
    h0 = $('#res').offsetHeight;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
})();

/* ── boot ─────────────────────────────────────────────────────────────── */
const savedTheme = store.get('theme', '');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
const savedH = store.get('resH', 0);
if (savedH) $('#res').style.height = savedH + 'px';

renderEnv();
renderSessions();
renderTray();
renderTree();
open(REQS.find((r) => r.name === 'Login') || REQS[0]);
