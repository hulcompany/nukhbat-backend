'use strict';
/* ══════════════════════════════════════════════════════════════════
   Question rendering shared by the student (solve + review) and the
   school (author + preview) portals. Covers all six question types:
   options · trueFalse · match · classify · order · fillBlanks
   ══════════════════════════════════════════════════════════════════ */

const Q_TYPES = [
  ['options', 'اختيار من متعدد'],
  ['trueFalse', 'صح / خطأ'],
  ['match', 'توصيل'],
  ['classify', 'تصنيف'],
  ['order', 'ترتيب'],
  ['fillBlanks', 'ملء الفراغات'],
];
const qTypeLabel = (t) => (Q_TYPES.find((x) => x[0] === t) || [t, t])[1];

/* the placeholder the backend requires inside a fillBlanks title */
const TEXTFIELD_RE =
  /\{\{\s*textField\s*:\s*\{\s*width\s*:\s*(\d+)\s*,\s*contentLength\s*:\s*(null|\d+)\s*,\s*index\s*:\s*(\d+)\s*\}\s*\}\}/g;
const textFieldToken = (index, width = 120) =>
  `{{textField:{width:${width},contentLength:null,index:${index}}}}`;

/* ══ SOLVING ═══════════════════════════════════════════════════════
   renderSolveQuestions(root, questions, answers)
     answers — a map filled in place: { [questionId]: <answer payload> }
     the payload matches QuestionAnswerDto exactly:
       options    → { options: [{ answered, index }] }
       trueFalse  → { boolAnswer }
       match      → { matches: [{ baseId, matchId }] }
       classify   → { classify: [{ categoryId, items: [] }] }
       order      → { orders: [{ id, order }] }
       fillBlanks → { fillBlanks: [{ index, answer }] }
   ════════════════════════════════════════════════════════════════ */
function renderSolveQuestions(root, questions, answers) {
  root.innerHTML = '';
  questions.forEach((q, i) => {
    const box = el(`
      <div class="q">
        <div class="q-head">
          <div class="q-title"></div>
          <span class="q-type">${qTypeLabel(q.type)}</span>
        </div>
        ${q.imageId ? `<img class="q-image" src="${fileUrl(q.imageId)}"/>` : ''}
        <div class="q-body"></div>
        ${
          q.tips && q.tips.length
            ? `<div class="tips">💡 ${q.tips.map(esc).join(' • ')}</div>`
            : ''
        }
      </div>`);
    const body = $('.q-body', box);
    const titleNode = $('.q-title', box);

    if (q.type === 'fillBlanks') {
      titleNode.appendChild(
        el(`<span>${i + 1}. </span>`),
      );
      titleNode.appendChild(fillBlanksTitle(q, answers));
    } else {
      titleNode.textContent = `${i + 1}. ${q.title}`;
    }

    if (q.type === 'options') solveOptions(body, q, answers);
    else if (q.type === 'trueFalse') solveTrueFalse(body, q, answers);
    else if (q.type === 'match') solveMatch(body, q, answers);
    else if (q.type === 'classify') solveClassify(body, q, answers);
    else if (q.type === 'order') solveOrder(body, q, answers);
    else if (q.type === 'fillBlanks')
      body.appendChild(
        el('<div class="muted">اكتب إجابتك داخل الفراغات في نص السؤال.</div>'),
      );

    root.appendChild(box);
  });
}

function solveOptions(body, q, answers) {
  const groups = [...(q.optionsGroups || [])].sort((a, b) => a.index - b.index);
  groups.forEach((g) => {
    if (groups.length > 1 || g.text)
      body.appendChild(
        el(`<div class="group-title">${esc(g.text || `المجموعة ${g.index + 1}`)}</div>`),
      );
    const holder = el('<div></div>');
    (g.options || []).forEach((o) => {
      const row = el(`
        <label class="opt">
          <input type="radio" name="q-${q.id}-g-${g.index}"/>
          <span>${esc(o.text)}</span>
        </label>`);
      $('input', row).onchange = () => {
        const cur = answers[q.id]?.options || [];
        answers[q.id] = {
          options: [
            ...cur.filter((x) => x.index !== g.index),
            { answered: o.id, index: g.index },
          ],
        };
        $$('.opt', holder).forEach((x) => x.classList.remove('selected'));
        row.classList.add('selected');
      };
      holder.appendChild(row);
    });
    body.appendChild(holder);
  });
}

function solveTrueFalse(body, q, answers) {
  [
    ['صحيح ✓', true],
    ['خطأ ✗', false],
  ].forEach(([label, val]) => {
    const row = el(`
      <label class="opt">
        <input type="radio" name="q-${q.id}"/><span>${label}</span>
      </label>`);
    $('input', row).onchange = () => {
      answers[q.id] = { boolAnswer: val };
      $$('.opt', body).forEach((x) => x.classList.remove('selected'));
      row.classList.add('selected');
    };
    body.appendChild(row);
  });
}

function solveMatch(body, q, answers) {
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
      const arr = (answers[q.id].matches || []).filter((x) => x.baseId !== base.id);
      if (e.target.value) arr.push({ baseId: base.id, matchId: e.target.value });
      answers[q.id].matches = arr;
    };
    body.appendChild(row);
  });
}

function solveClassify(body, q, answers) {
  const all = q.classifyItems || [];
  const categories = all.filter((c) => c.type === 'category');
  const items = all.filter((c) => c.type === 'item');
  answers[q.id] = { classify: categories.map((c) => ({ categoryId: c.id, items: [] })) };

  const grid = el('<div class="grid"></div>');
  const optionsHtml =
    '<option value="">— بدون تصنيف —</option>' +
    categories.map((c) => `<option value="${c.id}">${esc(c.text)}</option>`).join('');

  items.forEach((item) => {
    const row = el(`
      <div class="classify-item">
        <span>${esc(item.text)}</span>
        <select style="padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit">${optionsHtml}</select>
      </div>`);
    $('select', row).onchange = (e) => {
      const buckets = answers[q.id].classify;
      buckets.forEach((b) => (b.items = b.items.filter((x) => x !== item.id)));
      if (e.target.value) {
        const bucket = buckets.find((b) => b.categoryId === e.target.value);
        bucket.items.push(item.id);
      }
    };
    grid.appendChild(row);
  });
  body.appendChild(
    el(
      `<div class="muted" style="margin-bottom:6px">التصنيفات: ${categories
        .map((c) => esc(c.text))
        .join(' • ')}</div>`,
    ),
  );
  body.appendChild(grid);
}

function solveOrder(body, q, answers) {
  const items = q.orderItems || [];
  answers[q.id] = { orders: [] };
  const sync = () => {
    answers[q.id].orders = $$('.order-item', body).map((node, idx) => ({
      id: node.dataset.id,
      order: idx,
    }));
    $$('.order-item', body).forEach((n, i) => ($('.pos', n).textContent = i + 1));
  };
  items.forEach((it) => {
    const row = el(`
      <div class="order-item" data-id="${it.id}">
        <span><b class="pos"></b>. ${esc(it.text)}</span>
        <span class="row">
          <button class="btn ghost sm up">▲</button>
          <button class="btn ghost sm down">▼</button>
        </span>
      </div>`);
    $('.up', row).onclick = () => {
      const prev = row.previousElementSibling;
      if (prev) row.parentNode.insertBefore(row, prev);
      sync();
    };
    $('.down', row).onclick = () => {
      const next = row.nextElementSibling;
      if (next) row.parentNode.insertBefore(next, row);
      sync();
    };
    body.appendChild(row);
  });
  body.appendChild(
    el('<div class="muted">رتّب العناصر بالأسهم — الترتيب الحالي هو إجابتك.</div>'),
  );
  sync();
}

/* the fillBlanks title carries {{textField:{…,index:N}}} placeholders */
function fillBlanksTitle(q, answers) {
  const wrap = el('<span></span>');
  const text = q.title || '';
  answers[q.id] = { fillBlanks: [] };
  let last = 0;
  let m;
  TEXTFIELD_RE.lastIndex = 0;
  while ((m = TEXTFIELD_RE.exec(text)) !== null) {
    wrap.appendChild(document.createTextNode(text.slice(last, m.index)));
    const index = Number(m[3]);
    const input = el(
      `<input class="blank-input" style="width:${Math.min(Number(m[1]) || 120, 240)}px" placeholder="…"/>`,
    );
    input.oninput = () => {
      const arr = (answers[q.id].fillBlanks || []).filter((x) => x.index !== index);
      if (input.value.trim()) arr.push({ index, answer: input.value.trim() });
      answers[q.id].fillBlanks = arr;
    };
    wrap.appendChild(input);
    last = m.index + m[0].length;
  }
  wrap.appendChild(document.createTextNode(text.slice(last)));
  return wrap;
}

/* drop unanswered questions — the backend treats a missing entry as skipped */
function collectAnswers(questions, answers) {
  return questions
    .map((q) => ({ id: q.id, answer: answers[q.id] }))
    .filter(({ answer }) => {
      if (!answer) return false;
      if (answer.boolAnswer !== undefined) return true;
      if (answer.options?.length) return true;
      if (answer.matches?.length) return true;
      if (answer.orders?.length) return true;
      if (answer.fillBlanks?.length) return true;
      if (answer.classify?.some((c) => c.items.length)) return true;
      return false;
    })
    .map(({ id, answer }) => {
      // classify: strip empty buckets so an untouched category isn't submitted
      if (answer.classify)
        return { id, answer: { classify: answer.classify.filter((c) => c.items.length) } };
      return { id, answer };
    });
}

/* ══ RESULT + REVIEW ═══════════════════════════════════════════════ */
function renderResult(view, result, opts = {}) {
  const total = result.total ?? 0;
  const correct = result.correct ?? result.score ?? 0;
  const skipped = result.skipped ?? 0;
  const xps = result.xps ?? 0;
  const gems = result.gems ?? 0;
  const perfect = result.passed ?? (total > 0 && correct === total);
  const pct = total ? Math.round((100 * correct) / total) : 0;

  view.innerHTML = '';
  view.appendChild(
    el(`
    <div class="result-hero">
      <div class="verdict-emoji">${perfect ? '🏆' : correct > 0 ? '👍' : '💪'}</div>
      <h2>${perfect ? 'ممتاز! إجابات كاملة' : correct > 0 ? 'أحسنت — استمر!' : 'حاول مجدداً'}</h2>
      <div>${esc(opts.title || '')} • ${correct} من ${total} (${pct}%)</div>
      <div class="rewards">
        <div class="reward"><div class="num">${correct}/${total}</div><div class="lbl">صحيحة</div></div>
        <div class="reward"><div class="num">${skipped}</div><div class="lbl">متروكة</div></div>
        <div class="reward"><div class="num">${xps > 0 ? '+' : ''}${xps}</div><div class="lbl">XP</div></div>
        <div class="reward"><div class="num">${gems > 0 ? '+' : ''}${gems}</div><div class="lbl">جواهر 💎</div></div>
      </div>
    </div>`),
  );
  const review = el('<div></div>');
  renderReview(review, result.verdicts || [], opts);
  view.appendChild(review);

  if (opts.onDone) {
    const foot = card('<div class="row" style="justify-content:center"></div>');
    const b = el('<button class="btn">تم</button>');
    b.onclick = opts.onDone;
    $('.row', foot).appendChild(b);
    view.appendChild(foot);
  }
}

/* verdicts: QuestionVerdict[] — { id, title, type, verdict, isSkipped, result } */
function renderReview(root, verdicts, opts = {}) {
  root.appendChild(el('<h3 style="margin:6px 2px">مراجعة الأسئلة</h3>'));
  verdicts.forEach((vd, i) => {
    const state = vd.isSkipped
      ? { cls: 'skipped', label: 'متروك' }
      : vd.verdict
        ? { cls: 'correct', label: '✓ صحيح' }
        : { cls: 'wrong', label: '✗ خطأ' };
    const box = el(`
      <div class="rev-q ${state.cls}">
        <div class="rev-title">
          <span>${i + 1}. ${esc(vd.title)} <span class="q-type">${qTypeLabel(vd.type)}</span></span>
          <span class="row">
            ${opts.canSave ? '<button class="btn ghost sm save-q">☆ حفظ</button>' : ''}
            <span class="tag ${state.cls}">${state.label}</span>
          </span>
        </div>
        <div class="rev-body"></div>
      </div>`);
    const save = $('.save-q', box);
    if (save)
      save.onclick = async () => {
        try {
          await api.post('/learning/saved-questions', { questionId: vd.id });
          save.textContent = '★ محفوظ';
          save.disabled = true;
          toast('تم حفظ السؤال', 'good');
        } catch (e) {
          toast(e.message, 'bad');
        }
      };
    renderVerdictBody($('.rev-body', box), vd);
    root.appendChild(box);
  });
}

function renderVerdictBody(body, vd) {
  const r = vd.result || {};
  const line = (label, value, ok) =>
    `<div class="rev-line"><b>${label}:</b> <span class="${ok ? 'answer-good' : 'answer-bad'}">${value}</span></div>`;

  if (vd.type === 'options') {
    (r.verdicts || []).forEach((g, i) => {
      const yours = g.answered ? esc(g.answered.text) : '— (لم تجب)';
      const correct = (g.correctOption || []).map((o) => esc(o.text)).join(' / ');
      body.innerHTML +=
        `<div class="rev-line"><b>المجموعة ${i + 1}</b></div>` +
        line('إجابتك', yours, g.verdict) +
        (g.verdict ? '' : line('الصحيحة', correct || '—', true));
    });
  } else if (vd.type === 'trueFalse') {
    const b2s = (b) => (b === true ? 'صحيح' : b === false ? 'خطأ' : '— (لم تجب)');
    body.innerHTML =
      line('إجابتك', b2s(r.answered), r.verdict) +
      (r.verdict ? '' : line('الصحيحة', b2s(r.correctAnswer), true));
  } else if (vd.type === 'match') {
    body.innerHTML = (r.verdicts || [])
      .map((m) => {
        const yours = m.answeredMatch ? esc(m.answeredMatch.text) : '— (لم تجب)';
        const correct = m.baseCorrectMatch ? esc(m.baseCorrectMatch.text) : '—';
        return `<div class="rev-line"><b>${esc(m.answeredBase?.text || '')}:</b>
          <span class="${m.verdict ? 'answer-good' : 'answer-bad'}">${yours}</span>${
            m.verdict ? '' : ` <span class="muted">← الصحيح:</span> <span class="answer-good">${correct}</span>`
          }</div>`;
      })
      .join('');
  } else if (vd.type === 'classify') {
    body.innerHTML = (r.verdicts || [])
      .map((c) => {
        const yours = (c.answered?.items || []).map((x) => esc(x.text)).join('، ') || '— (فارغ)';
        const correct = (c.correctAnswer?.items || []).map((x) => esc(x.text)).join('، ') || '—';
        return `<div class="rev-line"><b>${esc(c.answered?.category?.text || '')}:</b>
          <span class="${c.verdict ? 'answer-good' : 'answer-bad'}">${yours}</span>${
            c.verdict ? '' : ` <span class="muted">← الصحيح:</span> <span class="answer-good">${correct}</span>`
          }</div>`;
      })
      .join('');
  } else if (vd.type === 'order') {
    body.innerHTML = (r.verdicts || [])
      .map((o, i) => {
        const yours = o.answered ? esc(o.answered.text) : '— (لم تجب)';
        return `<div class="rev-line"><b>${i + 1}.</b>
          <span class="${o.verdict ? 'answer-good' : 'answer-bad'}">${yours}</span>${
            o.verdict ? '' : ` <span class="muted">← الصحيح:</span> <span class="answer-good">${esc(o.correctAnswer?.text || '—')}</span>`
          }</div>`;
      })
      .join('');
  } else if (vd.type === 'fillBlanks') {
    body.innerHTML = (r.verdicts || [])
      .map((b) => {
        const yours = b.answer ? esc(b.answer) : '— (لم تجب)';
        return `<div class="rev-line"><b>الفراغ ${b.index + 1}:</b>
          <span class="${b.verdict ? 'answer-good' : 'answer-bad'}">${yours}</span>${
            b.verdict ? '' : ` <span class="muted">← المقبول:</span> <span class="answer-good">${(b.correctAnswer || []).map(esc).join(' / ')}</span>`
          }</div>`;
      })
      .join('');
  } else {
    body.innerHTML = `<pre class="json">${esc(JSON.stringify(r, null, 2))}</pre>`;
  }
}

/* ══ AUTHORING (school portal) ═════════════════════════════════════
   questionBuilder(onSubmit) → a node with a full create form for the
   six types. Emits exactly the QuestionCreateDto shape.
   ════════════════════════════════════════════════════════════════ */
function questionBuilder(ctx) {
  // ctx: { lessons:[{id,title}], courses:[{id,title}], onCreate(dto) }
  const wrap = el('<div></div>');
  const state = { type: 'options', purpose: 'lesson' };

  const top = el(`
    <div class="form-grid">
      <label class="field"><span>نوع السؤال *</span>
        <select id="qb-type">${Q_TYPES.map(
          ([v, l]) => `<option value="${v}">${l}</option>`,
        ).join('')}</select></label>
      <label class="field"><span>الغرض *</span>
        <select id="qb-purpose">
          <option value="lesson">سؤال درس</option>
          <option value="dailyChallenge">تحدي يومي (مخزون الدورة)</option>
        </select></label>
      <label class="field" id="qb-target-wrap"><span>الدرس *</span>
        <select id="qb-target"></select></label>
      <label class="field" style="grid-column:1/-1"><span>نص السؤال *</span>
        <textarea id="qb-title" placeholder="اكتب نص السؤال"></textarea>
        <div class="hint" id="qb-title-hint"></div></label>
      <label class="field" style="grid-column:1/-1"><span>تلميحات (مفصولة بفواصل)</span>
        <input id="qb-tips" placeholder="تلميح ١, تلميح ٢"/></label>
    </div>`);
  wrap.appendChild(top);

  const bodyBox = el('<div id="qb-body"></div>');
  wrap.appendChild(bodyBox);

  const foot = el(`
    <div class="row" style="margin-top:10px">
      <button class="btn" id="qb-save">إنشاء السؤال</button>
      <button class="btn ghost" id="qb-json">معاينة الـ JSON</button>
    </div>`);
  wrap.appendChild(foot);

  const targetSel = $('#qb-target', wrap);
  const targetWrap = $('#qb-target-wrap', wrap);
  const fillTargets = () => {
    const list = state.purpose === 'lesson' ? ctx.lessons : ctx.courses;
    $('span', targetWrap).textContent =
      state.purpose === 'lesson' ? 'الدرس *' : 'الدورة *';
    targetSel.innerHTML = (list || [])
      .map((x) => `<option value="${x.id}">${esc(x.title)}</option>`)
      .join('');
    if (!list || !list.length)
      targetSel.innerHTML = '<option value="">— لا يوجد —</option>';
  };

  const bodies = {
    options: optionsBuilder,
    trueFalse: trueFalseBuilder,
    match: matchBuilder,
    classify: classifyBuilder,
    order: orderBuilder,
    fillBlanks: fillBlanksBuilder,
  };
  let current;
  const renderBody = () => {
    bodyBox.innerHTML = '';
    current = bodies[state.type]($('#qb-title', wrap));
    bodyBox.appendChild(current.node);
    $('#qb-title-hint', wrap).textContent =
      state.type === 'fillBlanks'
        ? 'كل فراغ يظهر في النص كـ {{textField:{width:120,contentLength:null,index:N}}} — استخدم زر «أضف فراغاً».'
        : '';
  };

  $('#qb-type', wrap).onchange = (e) => {
    state.type = e.target.value;
    renderBody();
  };
  $('#qb-purpose', wrap).onchange = (e) => {
    state.purpose = e.target.value;
    fillTargets();
  };

  const buildDto = () => {
    const title = $('#qb-title', wrap).value.trim();
    if (!title) throw new Error('نص السؤال مطلوب');
    const target = targetSel.value;
    if (!target) throw new Error('اختر الدرس/الدورة');
    const tips = $('#qb-tips', wrap)
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const dto = { title, type: state.type, purpose: state.purpose };
    if (state.purpose === 'lesson') dto.lessonId = target;
    else dto.courseId = target;
    if (tips.length) dto.tips = tips;
    Object.assign(dto, current.value());
    return dto;
  };

  $('#qb-json', wrap).onclick = () => {
    try {
      jsonModal('QuestionCreateDto', buildDto());
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  $('#qb-save', wrap).onclick = async () => {
    let dto;
    try {
      dto = buildDto();
    } catch (e) {
      return toast(e.message, 'bad');
    }
    const btn = $('#qb-save', wrap);
    btn.disabled = true;
    try {
      await ctx.onCreate(dto);
    } catch (e) {
      toast(e.message, 'bad');
    }
    btn.disabled = false;
  };

  fillTargets();
  renderBody();
  return wrap;
}

/* — options: N groups × N options, isCorrect flags — */
function optionsBuilder() {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <div class="between"><h3>مجموعات الاختيارات</h3>
        <button class="btn ghost sm" id="add-group">+ مجموعة</button></div>
      <div id="groups"></div>
    </div>`);
  const groups = $('#groups', node);
  const addGroup = () => {
    const g = el(`
      <div class="classify-box" style="margin-bottom:8px">
        <div class="between">
          <input class="g-title" placeholder="عنوان المجموعة (اختياري)"
                 style="padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
          <span class="row">
            <button class="btn ghost sm add-opt">+ خيار</button>
            <button class="btn ghost sm del-group">حذف المجموعة</button>
          </span>
        </div>
        <div class="opts" style="margin-top:8px"></div>
      </div>`);
    const opts = $('.opts', g);
    const addOpt = () => {
      const row = el(`
        <div class="row" style="margin-bottom:6px">
          <input class="o-text" placeholder="نص الخيار" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
          <label class="row" style="gap:4px"><input type="checkbox" class="o-ok"/><span class="muted">صحيح</span></label>
          <button class="btn ghost sm del-opt">×</button>
        </div>`);
      $('.del-opt', row).onclick = () => row.remove();
      opts.appendChild(row);
    };
    $('.add-opt', g).onclick = addOpt;
    $('.del-group', g).onclick = () => g.remove();
    addOpt();
    addOpt();
    groups.appendChild(g);
  };
  $('#add-group', node).onclick = addGroup;
  addGroup();

  return {
    node,
    value() {
      const optionGroups = $$('.classify-box', groups).map((g, index) => ({
        index,
        title: $('.g-title', g).value.trim() || undefined,
        options: $$('.row', $('.opts', g)).map((r) => ({
          text: $('.o-text', r).value.trim(),
          isCorrect: $('.o-ok', r).checked,
        })),
      }));
      optionGroups.forEach((g) => {
        if (g.options.length < 2) throw new Error('كل مجموعة تحتاج خيارين على الأقل');
        if (g.options.some((o) => !o.text)) throw new Error('نص الخيار مطلوب');
        if (!g.options.some((o) => o.isCorrect))
          throw new Error('كل مجموعة تحتاج خياراً صحيحاً واحداً على الأقل');
        if (g.title === undefined) delete g.title;
      });
      return { optionGroups };
    },
  };
}

/* — trueFalse — */
function trueFalseBuilder() {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <label class="field"><span>الإجابة الصحيحة *</span>
        <select id="tf"><option value="true">صحيح</option><option value="false">خطأ</option></select></label>
    </div>`);
  return { node, value: () => ({ correctAnswer: $('#tf', node).value === 'true' }) };
}

/* — match: base rows point at a match row by array index — */
function matchBuilder() {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <div class="between"><h3>عناصر التوصيل</h3>
        <span class="row">
          <button class="btn ghost sm" id="add-base">+ طرف أساسي</button>
          <button class="btn ghost sm" id="add-match">+ طرف مقابل</button>
        </span></div>
      <div class="muted">الترتيب مهم: «الطرف المقابل الصحيح» يشير إلى ترتيب العنصر في القائمة (يبدأ من ٠).</div>
      <div id="items" style="margin-top:8px"></div>
    </div>`);
  const items = $('#items', node);
  const redraw = () => {
    $$('.mi', items).forEach((row, i) => {
      $('.idx', row).textContent = i;
      const sel = $('.correct', row);
      if (!sel) return;
      const opts = $$('.mi', items)
        .map((r, j) => ({ j, type: r.dataset.type, text: $('.mi-text', r).value }))
        .filter((x) => x.type === 'match')
        .map((x) => `<option value="${x.j}">${x.j} — ${esc(x.text || '(فارغ)')}</option>`)
        .join('');
      const keep = sel.value;
      sel.innerHTML = '<option value="">— بدون —</option>' + opts;
      sel.value = keep;
    });
  };
  const add = (type) => {
    const row = el(`
      <div class="mi row" data-type="${type}" style="margin-bottom:6px">
        <b class="idx"></b>
        <span class="badge">${type === 'base' ? 'أساسي' : 'مقابل'}</span>
        <input class="mi-text" placeholder="النص" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
        ${type === 'base' ? '<select class="correct" style="padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"></select>' : ''}
        <button class="btn ghost sm del">×</button>
      </div>`);
    $('.del', row).onclick = () => {
      row.remove();
      redraw();
    };
    $('.mi-text', row).oninput = redraw;
    items.appendChild(row);
    redraw();
  };
  $('#add-base', node).onclick = () => add('base');
  $('#add-match', node).onclick = () => add('match');
  add('base');
  add('match');
  add('match');

  return {
    node,
    value() {
      const matchingItems = $$('.mi', items).map((row) => {
        const item = {
          text: $('.mi-text', row).value.trim(),
          type: row.dataset.type,
        };
        if (item.type === 'base') {
          const v = $('.correct', row).value;
          if (v === '') throw new Error('كل طرف أساسي يحتاج طرفاً مقابلاً صحيحاً');
          item.correctIndex = Number(v);
        }
        if (!item.text) throw new Error('نص العنصر مطلوب');
        return item;
      });
      if (matchingItems.length < 3) throw new Error('التوصيل يحتاج ٣ عناصر على الأقل');
      return { matchingItems };
    },
  };
}

/* — classify: category rows + item rows pointing at a category index — */
function classifyBuilder() {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <div class="between"><h3>عناصر التصنيف</h3>
        <span class="row">
          <button class="btn ghost sm" id="add-cat">+ تصنيف</button>
          <button class="btn ghost sm" id="add-item">+ عنصر</button>
        </span></div>
      <div class="muted">«التصنيف الصحيح» يشير إلى ترتيب صف التصنيف في القائمة (يبدأ من ٠).</div>
      <div id="citems" style="margin-top:8px"></div>
    </div>`);
  const items = $('#citems', node);
  const redraw = () => {
    $$('.ci', items).forEach((row, i) => {
      $('.idx', row).textContent = i;
      const sel = $('.correct', row);
      if (!sel) return;
      const opts = $$('.ci', items)
        .map((r, j) => ({ j, type: r.dataset.type, text: $('.ci-text', r).value }))
        .filter((x) => x.type === 'category')
        .map((x) => `<option value="${x.j}">${x.j} — ${esc(x.text || '(فارغ)')}</option>`)
        .join('');
      const keep = sel.value;
      sel.innerHTML = '<option value="">— بدون —</option>' + opts;
      sel.value = keep;
    });
  };
  const add = (type) => {
    const row = el(`
      <div class="ci row" data-type="${type}" style="margin-bottom:6px">
        <b class="idx"></b>
        <span class="badge">${type === 'category' ? 'تصنيف' : 'عنصر'}</span>
        <input class="ci-text" placeholder="النص" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
        ${type === 'item' ? '<select class="correct" style="padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"></select>' : ''}
        <button class="btn ghost sm del">×</button>
      </div>`);
    $('.del', row).onclick = () => {
      row.remove();
      redraw();
    };
    $('.ci-text', row).oninput = redraw;
    items.appendChild(row);
    redraw();
  };
  $('#add-cat', node).onclick = () => add('category');
  $('#add-item', node).onclick = () => add('item');
  add('category');
  add('category');
  add('item');

  return {
    node,
    value() {
      const classify = $$('.ci', items).map((row) => {
        const item = { text: $('.ci-text', row).value.trim(), type: row.dataset.type };
        if (!item.text) throw new Error('نص العنصر مطلوب');
        if (item.type === 'item') {
          const v = $('.correct', row).value;
          if (v === '') throw new Error('كل عنصر يحتاج تصنيفاً صحيحاً');
          item.correctCategoryIndex = Number(v);
        }
        return item;
      });
      if (classify.length < 2) throw new Error('التصنيف يحتاج عنصرين على الأقل');
      return { classify };
    },
  };
}

/* — order: items in their CORRECT order — */
function orderBuilder() {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <div class="between"><h3>العناصر بالترتيب الصحيح</h3>
        <button class="btn ghost sm" id="add-ord">+ عنصر</button></div>
      <div id="ords" style="margin-top:8px"></div>
    </div>`);
  const items = $('#ords', node);
  const add = () => {
    const row = el(`
      <div class="ord row" style="margin-bottom:6px">
        <b class="idx"></b>
        <input class="ord-text" placeholder="النص" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
        <button class="btn ghost sm del">×</button>
      </div>`);
    $('.del', row).onclick = () => {
      row.remove();
      renumber();
    };
    items.appendChild(row);
    renumber();
  };
  const renumber = () =>
    $$('.ord', items).forEach((r, i) => ($('.idx', r).textContent = i + 1));
  $('#add-ord', node).onclick = add;
  add();
  add();

  return {
    node,
    value() {
      const orders = $$('.ord', items).map((r) => ({
        text: $('.ord-text', r).value.trim(),
      }));
      if (orders.length < 2) throw new Error('الترتيب يحتاج عنصرين على الأقل');
      if (orders.some((o) => !o.text)) throw new Error('نص العنصر مطلوب');
      return { orders };
    },
  };
}

/* — fillBlanks: blanks + the {{textField:…}} tokens inside the title — */
function fillBlanksBuilder(titleInput) {
  const node = el(`
    <div class="card" style="background:var(--panel-2)">
      <div class="between"><h3>الفراغات</h3>
        <button class="btn ghost sm" id="add-blank">+ أضف فراغاً للنص</button></div>
      <div class="muted">كل فراغ يُضيف رمزاً داخل نص السؤال؛ اكتب الإجابات المقبولة مفصولة بفواصل.</div>
      <div id="blanks" style="margin-top:8px"></div>
    </div>`);
  const blanks = $('#blanks', node);
  const add = () => {
    const index = $$('.bl', blanks).length;
    const row = el(`
      <div class="bl row" style="margin-bottom:6px">
        <b>الفراغ ${index}</b>
        <input class="bl-ans" placeholder="إجابة, إجابة بديلة" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
      </div>`);
    blanks.appendChild(row);
    titleInput.value = (titleInput.value || '') + ' ' + textFieldToken(index);
    titleInput.dispatchEvent(new Event('input'));
  };
  $('#add-blank', node).onclick = add;

  return {
    node,
    value() {
      const fillBlanks = $$('.bl', blanks).map((r, index) => ({
        index,
        answers: $('.bl-ans', r)
          .value.split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      }));
      if (!fillBlanks.length) throw new Error('أضف فراغاً واحداً على الأقل');
      if (fillBlanks.some((b) => !b.answers.length))
        throw new Error('كل فراغ يحتاج إجابة واحدة على الأقل');
      return { fillBlanks };
    },
  };
}

/* ══ PREVIEW WITH THE ANSWER KEY (school portal) ═══════════════════ */
function questionPreview(q) {
  const box = el(`
    <div class="q">
      <div class="q-head">
        <div class="q-title">${esc(q.title)}</div>
        <span class="q-type">${qTypeLabel(q.type)}</span>
      </div>
      ${q.imageId ? `<img class="q-image" src="${fileUrl(q.imageId)}"/>` : ''}
      <div class="q-body"></div>
      ${q.tips?.length ? `<div class="tips">💡 ${q.tips.map(esc).join(' • ')}</div>` : ''}
    </div>`);
  const body = $('.q-body', box);

  if (q.type === 'options') {
    [...(q.optionsGroups || [])]
      .sort((a, b) => a.index - b.index)
      .forEach((g) => {
        body.appendChild(
          el(`<div class="group-title">${esc(g.text || `المجموعة ${g.index + 1}`)}</div>`),
        );
        (g.options || []).forEach((o) =>
          body.appendChild(
            el(
              `<div class="opt static ${o.isCorrect ? 'correct' : ''}">${o.isCorrect ? '✓' : '•'} ${esc(o.text)}</div>`,
            ),
          ),
        );
      });
  } else if (q.type === 'trueFalse') {
    const v = q.trueOrFalse?.value ?? q.trueOrFalseAnswer;
    body.appendChild(
      el(
        `<div class="opt static correct">الإجابة: ${v === true ? 'صحيح' : v === false ? 'خطأ' : '—'}</div>`,
      ),
    );
  } else if (q.type === 'match') {
    const items = [...(q.matchingItems || [])].sort((a, b) => a.index - b.index);
    const matches = items.filter((m) => m.type === 'match');
    items
      .filter((m) => m.type === 'base')
      .forEach((b) => {
        const c = matches.find((m) => m.index === b.correctIndex);
        body.appendChild(
          el(
            `<div class="opt static">${esc(b.text)} <span class="muted">←</span> <b>${esc(c?.text || '—')}</b></div>`,
          ),
        );
      });
    body.appendChild(
      el(
        `<div class="muted">كل الأطراف المقابلة: ${matches.map((m) => esc(m.text)).join(' • ')}</div>`,
      ),
    );
  } else if (q.type === 'classify') {
    const all = [...(q.classifyItems || [])].sort((a, b) => a.index - b.index);
    all
      .filter((c) => c.type === 'category')
      .forEach((cat) => {
        const its = all.filter(
          (i) => i.type === 'item' && i.correctCategoryIndex === cat.index,
        );
        body.appendChild(
          el(
            `<div class="opt static"><b>${esc(cat.text)}:</b> ${its.map((i) => esc(i.text)).join('، ') || '—'}</div>`,
          ),
        );
      });
  } else if (q.type === 'order') {
    [...(q.orderItems || [])]
      .sort((a, b) => a.sort - b.sort)
      .forEach((o, i) =>
        body.appendChild(el(`<div class="opt static">${i + 1}. ${esc(o.text)}</div>`)),
      );
  } else if (q.type === 'fillBlanks') {
    (q.fillBlanks || []).forEach((b) =>
      body.appendChild(
        el(
          `<div class="opt static">الفراغ ${b.index}: <b>${(b.answers || []).map(esc).join(' / ')}</b></div>`,
        ),
      ),
    );
  }
  return box;
}
