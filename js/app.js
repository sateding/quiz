/* =========================================================
   Dina Titanova · Анкета
   Движок квізу. Контент — у questions.js, вигляд — у style.css,
   налаштування — у config.js.
   React + htm, без збірки.
   ========================================================= */

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const STORE_KEY = 'dt-quiz-v2';
const OUT_MS = 170;   /* має збігатися з --dur-out у CSS */

/* =========================================================
   Дрібні помічники
   ========================================================= */

const Tick = () => html`
  <svg viewBox="0 0 12 11" aria-hidden="true"><path d="M1 5.6 L4.3 9 L11 1.6"/></svg>`;

const Arrow = ({ dir = 'right' }) => html`
  <svg class="btn__arrow" width="15" height="12" viewBox="0 0 15 12" fill="none" aria-hidden="true"
       style=${dir === 'left' ? { transform: 'scaleX(-1)' } : null}>
    <path d="M1 6h12M9 1.5 13.5 6 9 10.5" stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}

const optLabel = (q, id) => {
  const o = (q.options || []).find(x => x && x.id === id);
  return o ? o.label : id;
};

function scaleWord(q, n) {
  if (n <= 12) return ['Однозначно', q.left.title];
  if (n <= 37) return ['Радше', q.left.title];
  if (n <= 62) return ['Порівну —', 'і те, й інше'];
  if (n <= 87) return ['Радше', q.right.title];
  return ['Однозначно', q.right.title];
}

/* Чи є відповідь на це питання? */
function isAnswered(q, answers) {
  const v = answers[q.id];
  if (q.type === 'cover' || q.type === 'review') return true;
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) {
    if (q.type === 'repeater') return v.some(r => Object.values(r || {}).some(x => String(x || '').trim() !== ''));
    return v.length > 0;
  }
  if (typeof v === 'object') return Object.values(v).some(x => String(x || '').trim() !== '');
  return String(v).trim() !== '';
}

/* Людський текст відповіді — для екрана перевірки й для брифу */
function formatAnswer(q, v) {
  if (v === undefined || v === null || v === '') return '';
  switch (q.type) {
    case 'single': case 'photoSingle':
      return optLabel(q, v);
    case 'multi': case 'photoMulti': case 'colors':
      return v.map(id => optLabel(q, id)).join(', ');
    case 'chips':
      return v.join(', ');
    case 'scale': {
      const [a, b] = scaleWord(q, v);
      return a + ' ' + b.toLowerCase();
    }
    case 'fields':
      return q.fields.filter(f => String(v[f.id] || '').trim())
                     .map(f => f.label + ': ' + v[f.id]).join(' · ');
    case 'repeater':
      return v.map(row => q.fields.map(f => row[f.id]).filter(Boolean).join(' · '))
              .filter(Boolean).join('\n');
    case 'upload':
      return v.length ? v.length + ' файл(ів): ' + v.map(f => f.name).join(', ') : '';
    default:
      return String(v);
  }
}

/* =========================================================
   Поля відповідей
   ========================================================= */

function OptionList({ q, value, onChange }) {
  const multi = q.type === 'multi';
  const sel = multi ? (value || []) : value;
  const full = multi && q.max && sel.length >= q.max;

  const toggle = (id) => {
    if (!multi) return onChange(id);
    const has = sel.includes(id);
    if (!has && full) return;
    onChange(has ? sel.filter(x => x !== id) : [...sel, id]);
  };

  return html`
    <div>
      <div class=${'opts' + (q.options.some(o => o.note) ? ' opts--wide' : '')}
           role=${multi ? 'group' : 'radiogroup'}>
        ${q.options.map((o, i) => {
          const on = multi ? sel.includes(o.id) : sel === o.id;
          const off = !on && full;
          return html`
            <button type="button" key=${o.id}
                    class=${`opt ${multi ? 'opt--multi' : ''} ${on ? 'is-on' : ''} ${off ? 'is-off' : ''}`}
                    style=${{ '--i': i }}
                    aria-pressed=${on} disabled=${off}
                    onClick=${() => toggle(o.id)}>
              <span class="tick"><${Tick}/></span>
              <span>
                <span class="opt__label">${o.label}</span>
                ${o.note && html`<span class="opt__note">${o.note}</span>`}
              </span>
            </button>`;
        })}
      </div>
      ${multi && q.max && html`<p class="counter">Обрано <b>${sel.length}</b> з ${q.max}</p>`}
    </div>`;
}

function PhotoGrid({ q, value, onChange }) {
  const multi = q.type === 'photoMulti';
  const sel = multi ? (value || []) : value;
  const full = multi && q.max && sel.length >= q.max;

  const toggle = (id) => {
    if (!multi) return onChange(id);
    const has = sel.includes(id);
    if (!has && full) return;
    onChange(has ? sel.filter(x => x !== id) : [...sel, id]);
  };

  return html`
    <div>
      <div class="photos">
        ${q.options.map((o, i) => {
          const on = multi ? sel.includes(o.id) : sel === o.id;
          const off = !on && full;
          return html`
            <button type="button" key=${o.id}
                    class=${`photo ${on ? 'is-on' : ''} ${off ? 'is-off' : ''}`}
                    style=${{ '--i': i }}
                    aria-pressed=${on} disabled=${off}
                    onClick=${() => toggle(o.id)}>
              <span class="photo__frame">
                <img src=${o.img} alt=${o.label} loading="lazy"/>
                <span class="photo__tick"><${Tick}/></span>
              </span>
              <span class="photo__cap">${o.label}</span>
            </button>`;
        })}
      </div>
      ${multi && q.max && html`<p class="counter">Обрано <b>${sel.length}</b> з ${q.max}</p>`}
    </div>`;
}

function ColorGrid({ q, value, onChange }) {
  const sel = value || [];
  const toggle = (id) => onChange(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  return html`
    <div>
      <div class="swatches">
        ${q.options.map((o, i) => html`
          <button type="button" key=${o.id}
                  class=${'swatch' + (sel.includes(o.id) ? ' is-on' : '')}
                  style=${{ '--i': i }}
                  aria-pressed=${sel.includes(o.id)}
                  onClick=${() => toggle(o.id)}>
            <span class="swatch__chip" style=${{ background: o.hex }}>
              <span class="swatch__tick"><${Tick}/></span>
            </span>
            <span class="swatch__label">${o.label}</span>
          </button>`)}
      </div>
      ${sel.length > 0 && html`<p class="counter">Обрано <b>${sel.length}</b></p>`}
    </div>`;
}

function ChipList({ q, value, onChange }) {
  const sel = value || [];
  const toggle = (label) =>
    onChange(sel.includes(label) ? sel.filter(x => x !== label) : [...sel, label]);
  return html`
    <div>
      <div class="chips">
        ${q.options.map((label, i) => html`
          <button type="button" key=${label}
                  class=${`chip ${sel.includes(label) ? 'is-on' : ''}`}
                  style=${{ '--i': i }}
                  aria-pressed=${sel.includes(label)}
                  onClick=${() => toggle(label)}>${label}</button>`)}
      </div>
      ${sel.length > 0 && html`<p class="counter">Обрано <b>${sel.length}</b></p>`}
    </div>`;
}

function TextField({ q, value, onChange }) {
  return html`
    <input class="field" type=${q.inputType || 'text'} value=${value || ''}
           placeholder=${q.placeholder || ''} autoFocus
           onInput=${e => onChange(e.target.value)}/>`;
}

function LongTextField({ q, value, onChange }) {
  return html`
    <textarea class="field" value=${value || ''} placeholder=${q.placeholder || ''} autoFocus
              onInput=${e => onChange(e.target.value)}></textarea>`;
}

function FieldsGroup({ q, value, onChange }) {
  const v = value || {};
  return html`
    <div class="field-row field-row--2">
      ${q.fields.map((f, i) => html`
        <div key=${f.id} style=${f.wide ? { gridColumn: '1 / -1' } : null}>
          <label class="field-label" for=${'f_' + f.id}>${f.label}</label>
          ${f.long
            ? html`<textarea class="field field--short" id=${'f_' + f.id}
                             value=${v[f.id] || ''} placeholder=${f.placeholder || ''}
                             onInput=${e => onChange({ ...v, [f.id]: e.target.value })}></textarea>`
            : html`<input class="field" id=${'f_' + f.id} type=${f.inputType || 'text'}
                          value=${v[f.id] || ''} placeholder=${f.placeholder || ''}
                          autoFocus=${i === 0}
                          onInput=${e => onChange({ ...v, [f.id]: e.target.value })}/>`}
        </div>`)}
    </div>`;
}

function Repeater({ q, value, onChange }) {
  const rows = (value && value.length ? value : [{}]);
  const set = (i, fid, val) => {
    const next = rows.map((r, j) => j === i ? { ...r, [fid]: val } : r);
    onChange(next);
  };
  const add = () => onChange([...rows, {}]);
  const del = (i) => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{}]);

  return html`
    <div class="repeater">
      ${rows.map((row, i) => html`
        <div class="rrow" key=${i} style=${{ '--i': i }}>
          <div class="rrow__num">${i + 1}</div>
          <div class="rrow__fields">
            ${q.fields.map(f => html`
              <div key=${f.id} class=${f.wide ? 'is-wide' : ''}>
                <label class="field-label">${f.label}</label>
                <input class="field" type=${f.inputType || 'text'}
                       value=${row[f.id] || ''} placeholder=${f.placeholder || ''}
                       onInput=${e => set(i, f.id, e.target.value)}/>
              </div>`)}
          </div>
          <button type="button" class="rrow__del" title="Прибрати рядок"
                  onClick=${() => del(i)} aria-label="Прибрати рядок">×</button>
        </div>`)}
      <button type="button" class="btn btn--add" onClick=${add}>
        <span aria-hidden="true">+</span> ${q.addLabel || 'Додати ще'}
      </button>
    </div>`;
}

function ScaleField({ q, value, onChange }) {
  const v = value === undefined || value === null ? 50 : value;
  const [pre, word] = scaleWord(q, v);
  return html`
    <div class="scale">
      <div class="scale__poles">
        <span><b>${q.left.title}</b>${q.left.note}</span>
        <span><b>${q.right.title}</b>${q.right.note}</span>
      </div>
      <input class="range" type="range" min="0" max="100" step="1" value=${v}
             aria-label=${q.title} aria-valuetext=${pre + ' ' + word}
             onInput=${e => onChange(Number(e.target.value))}/>
      ${q.ticks && html`
        <div class="scale__ticks">${q.ticks.map(t => html`<span key=${t}>${t}</span>`)}</div>`}
      <p class="scale__value">${pre} <em>${word.toLowerCase()}</em></p>
    </div>`;
}

function UploadField({ q, files, onFiles }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const max = (window.CONFIG && window.CONFIG.maxFiles) || 12;

  const accept = async (fileList) => {
    setBusy(true);
    const room = max - files.length;
    const picked = Array.from(fileList).slice(0, Math.max(0, room));
    const out = [];
    for (const f of picked) {
      const c = await window.STORE.compressImage(f, (window.CONFIG && window.CONFIG.imageMaxSide) || 1600);
      if (c) out.push(c);
    }
    onFiles([...files, ...out]);
    setBusy(false);
  };

  const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.round(n / 1024) + ' КБ';

  return html`
    <div>
      <div class=${'drop' + (over ? ' is-over' : '') + (busy ? ' is-busy' : '')}
           onDragOver=${e => { e.preventDefault(); setOver(true); }}
           onDragLeave=${() => setOver(false)}
           onDrop=${e => { e.preventDefault(); setOver(false); accept(e.dataTransfer.files); }}
           onClick=${() => inputRef.current && inputRef.current.click()}
           role="button" tabIndex="0"
           onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current.click(); }}>
        <svg class="drop__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
                stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="drop__title">${busy ? 'Обробляємо…' : 'Перетягніть фото сюди або натисніть, щоб обрати'}</p>
        <p class="drop__note">Зображення та PDF. До ${max} файлів — стискаються автоматично.</p>
        <input ref=${inputRef} type="file" multiple accept="image/*,.pdf" hidden
               onChange=${e => { accept(e.target.files); e.target.value = ''; }}/>
      </div>

      ${files.length > 0 && html`
        <div class="thumbs">
          ${files.map((f, i) => html`
            <div class="thumb" key=${f.name + i} style=${{ '--i': i }}>
              ${/^image\//.test(f.type)
                ? html`<img src=${f.dataUrl} alt=${f.name}/>`
                : html`<span class="thumb__doc">PDF</span>`}
              <button type="button" class="thumb__del" title="Прибрати"
                      onClick=${() => onFiles(files.filter((_, j) => j !== i))}>×</button>
              <span class="thumb__name">${f.name}<i>${kb(f.size)}</i></span>
            </div>`)}
        </div>
        <p class="counter">Додано <b>${files.length}</b> з ${max}</p>`}
    </div>`;
}

const FIELDS = {
  single: OptionList, multi: OptionList,
  photoSingle: PhotoGrid, photoMulti: PhotoGrid,
  colors: ColorGrid,
  chips: ChipList,
  text: TextField, number: TextField,
  longtext: LongTextField,
  fields: FieldsGroup,
  repeater: Repeater,
  scale: ScaleField,
  upload: UploadField
};

/* =========================================================
   Екрани
   ========================================================= */

function Cover({ q, phase }) {
  return html`
    <div class=${'cover' + (q.variant === 'solo' ? ' cover--solo' : '')} data-phase=${phase}>
      <div>
        ${q.kicker && html`<div class="cover__kicker">${q.kicker}</div>`}
        <h1 class="cover__title">${q.title}</h1>
        ${q.lead && html`<p class="cover__lead">${q.lead}</p>`}
        ${q.facts && html`
          <div class="cover__facts">
            ${q.facts.map(f => html`
              <div class="cover__fact" key=${f.label}><b>${f.value}</b><span>${f.label}</span></div>`)}
          </div>`}
      </div>
      ${q.media && html`<div class="cover__media"><img src=${q.media} alt=""/></div>`}
    </div>`;
}

function Question({ q, num, total, phase, value, onChange, files, onFiles, nudge }) {
  const Field = FIELDS[q.type];
  const gallery = (/^photo/.test(q.type) || q.type === 'colors') && q.options.length > 6;
  return html`
    <div class=${'q' + (gallery ? ' q--gallery' : '')} data-phase=${phase}>
      <div class="q__aside">
        <div class="q__num">${String(num).padStart(2, '0')}<span>/ ${total}</span></div>
        ${q.section && html`<div class="q__section">${q.section}</div>`}
        <h1 class="q__title">${q.title}</h1>
        ${q.hint && html`<p class="q__hint">${q.hint}</p>`}
        ${q.required && html`<p class=${'q__req' + (nudge ? ' is-nudge' : '')}>Обов’язкове питання</p>`}
      </div>
      <div class=${'q__field' + (nudge ? ' is-nudge' : '')}>
        <${Field} q=${q} value=${value} onChange=${onChange} files=${files} onFiles=${onFiles}/>
      </div>
    </div>`;
}

/* Екран перевірки перед надсиланням */
function Review({ q, phase, list, answers, onJump, sending, missing }) {
  /* групуємо за полем section — так кожне приміщення отримує свій заголовок */
  const groups = [];
  const byTitle = {};
  list.forEach((item, i) => {
    if (item.type === 'cover' || item.type === 'review') return;
    const title = item.section || 'Загальне';
    if (!byTitle[title]) { byTitle[title] = { title, items: [] }; groups.push(byTitle[title]); }
    byTitle[title].items.push({ q: item, index: i, text: formatAnswer(item, answers[item.id]) });
  });

  const answered = list.filter(x => x.type !== 'cover' && x.type !== 'review' && isAnswered(x, answers)).length;
  const totalQ = list.filter(x => x.type !== 'cover' && x.type !== 'review').length;

  return html`
    <div class="review" data-phase=${phase}>
      <div class="review__head">
        <div class="q__section">${q.section || 'Перевірка'}</div>
        <h1 class="cover__title">${q.title}</h1>
        ${q.hint && html`<p class="cover__lead">${q.hint}</p>`}
        <p class="review__stat">Заповнено <b>${answered}</b> із ${totalQ} питань.
          ${answered < totalQ ? ' Порожні можна лишити як є — вони просто не потраплять у бриф.' : ''}</p>

        ${missing.length > 0 && html`
          <div class="missing">
            <p class="missing__title">
              Спершу заповніть ${missing.length === 1 ? 'одне обов’язкове питання' : `обов’язкові питання (${missing.length})`}
            </p>
            <ul class="missing__list">
              ${missing.map(m => html`
                <li key=${m.q.id}>
                  <button type="button" onClick=${() => onJump(m.index)} disabled=${!!sending}>
                    ${m.q.title}
                  </button>
                </li>`)}
            </ul>
          </div>`}
      </div>

      <div class="review__body">
        ${groups.filter(g => g.items.length).map(g => html`
          <section class="rgroup" key=${g.title}>
            <h2 class="rgroup__title">${g.title}</h2>
            <dl class="rlist">
              ${g.items.map(it => html`
                <div class=${'rline' + (it.text ? '' : ' is-empty')} key=${it.q.id}>
                  <dt>${it.q.title}</dt>
                  <dd>${it.text || '—'}</dd>
                  <button type="button" class="rline__edit" onClick=${() => onJump(it.index)}
                          disabled=${!!sending}>змінити</button>
                </div>`)}
            </dl>
          </section>`)}
      </div>
    </div>`;
}

/* Друкований бриф — на екрані схований, з’являється тільки при друку */
function Brief({ list, answers, files }) {
  const groups = [];
  const byTitle = {};
  list.forEach(item => {
    if (item.type === 'cover' || item.type === 'review') return;
    const text = formatAnswer(item, answers[item.id]);
    if (!text) return;
    const title = item.section || 'Загальне';
    if (!byTitle[title]) { byTitle[title] = { title, items: [] }; groups.push(byTitle[title]); }
    byTitle[title].items.push({ q: item, text });
  });

  const c = answers.contacts || {};
  const today = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  const meta = window.QUIZ.meta;

  return html`
    <div class="brief">
      <header class="brief__head">
        <img src=${meta.logo} alt=${meta.studio} class="brief__logo"/>
        <div>
          <h1>Бриф на дизайн-проєкт</h1>
          <p>${[c.name, c.phone, c.email].filter(Boolean).join(' · ')}</p>
          <p class="brief__date">${today}</p>
        </div>
      </header>
      ${groups.filter(g => g.items.length).map(g => html`
        <section class="brief__section" key=${g.title}>
          <h2>${g.title}</h2>
          <dl>
            ${g.items.map(it => html`
              <div key=${it.q.id}><dt>${it.q.title}</dt><dd>${it.text}</dd></div>`)}
          </dl>
        </section>`)}
      ${files.length > 0 && html`
        <section class="brief__section">
          <h2>Референси</h2>
          <div class="brief__thumbs">
            ${files.filter(f => /^image\//.test(f.type)).map((f, i) => html`
              <img key=${i} src=${f.dataUrl} alt=${f.name}/>`)}
          </div>
        </section>`}
      <footer class="brief__foot">${meta.studio}</footer>
    </div>`;
}

/* Підказка на заблокованій кнопці «Далі» */
function lockHint(q, missing) {
  if (q.type === 'review') {
    return missing && missing.length === 1
      ? 'Лишилося одне обов’язкове питання'
      : `Лишилося обов’язкових питань: ${missing ? missing.length : 0}`;
  }
  if (q.requiredHint) return q.requiredHint;
  switch (q.type) {
    case 'single': case 'photoSingle':
      return 'Оберіть один варіант, щоб продовжити';
    case 'multi': case 'photoMulti': case 'chips': case 'colors':
      return 'Оберіть хоча б один варіант, щоб продовжити';
    case 'fields':
      return 'Заповніть поля, щоб продовжити';
    case 'repeater':
      return 'Додайте хоча б один запис, щоб продовжити';
    case 'upload':
      return 'Додайте хоча б один файл, щоб продовжити';
    default:
      return 'Напишіть відповідь, щоб продовжити';
  }
}

/* =========================================================
   Зміст — перехід до будь-якого питання
   ========================================================= */

function Toc({ list, answers, index, onJump, onClose, onRestart }) {
  const groups = [];
  const byTitle = {};
  list.forEach((item, i) => {
    if (item.type === 'cover') return;
    const title = item.section || 'Загальне';
    if (!byTitle[title]) { byTitle[title] = { title, items: [] }; groups.push(byTitle[title]); }
    byTitle[title].items.push({ q: item, index: i });
  });

  const real = list.filter(x => x.type !== 'cover' && x.type !== 'review');
  const done = real.filter(x => isAnswered(x, answers)).length;

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return html`
    <div class="toc" role="dialog" aria-modal="true" aria-label="Зміст анкети">
      <div class="toc__backdrop" onClick=${onClose}></div>
      <aside class="toc__panel">
        <header class="toc__head">
          <div>
            <div class="q__section">Зміст</div>
            <h2 class="toc__title">Усі питання</h2>
            <p class="toc__stat">Заповнено <b>${done}</b> із ${real.length}</p>
          </div>
          <button class="toc__close" onClick=${onClose} aria-label="Закрити зміст">×</button>
        </header>

        <div class="toc__body">
          ${groups.map(g => html`
            <section class="tgroup" key=${g.title}>
              <h3 class="tgroup__title">${g.title}</h3>
              ${g.items.map(it => {
                const isReview = it.q.type === 'review';
                const ok = !isReview && isAnswered(it.q, answers);
                const need = !isReview && it.q.required && !ok;
                return html`
                  <button type="button" key=${it.q.id}
                          class=${'titem' + (it.index === index ? ' is-current' : '') +
                                  (ok ? ' is-done' : '') + (need ? ' is-need' : '')}
                          onClick=${() => onJump(it.index)}>
                    <span class="titem__dot"></span>
                    <span class="titem__text">${it.q.title}</span>
                    ${need && html`<span class="titem__req">обов’язкове</span>`}
                  </button>`;
              })}
            </section>`)}
        </div>

        <footer class="toc__foot">
          <button class="btn--link" onClick=${onRestart}>Почати анкету заново</button>
        </footer>
      </aside>
    </div>`;
}

/* =========================================================
   Панель тестування — тільки за адресою ?test
   ========================================================= */

function TestBar({ onFill, onSend, onReset, busy }) {
  return html`
    <div class="testbar">
      <span class="testbar__tag">Тестовий режим</span>
      <button class="testbar__btn" onClick=${onFill} disabled=${busy}>
        Заповнити всю анкету
      </button>
      <button class="testbar__btn testbar__btn--go" onClick=${onSend} disabled=${busy}>
        ${busy ? 'Надсилаємо…' : 'Заповнити й надіслати'}
      </button>
      <button class="testbar__btn testbar__btn--ghost" onClick=${onReset} disabled=${busy}>
        Очистити
      </button>
    </div>`;
}

/* =========================================================
   Застосунок
   ========================================================= */

function App() {
  const all = window.QUIZ.questions;
  const meta = window.QUIZ.meta;

  const saved = useMemo(loadSaved, []);
  const [answers, setAnswers] = useState(saved.answers || {});
  const [index, setIndex] = useState(saved.index || 0);
  const [files, setFiles] = useState({});
  const [phase, setPhase] = useState('in');
  const [flash, setFlash] = useState(false);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(saved.sent || null);
  const [tocOpen, setTocOpen] = useState(false);
  const testMode = useMemo(
    () => /(^|[?&#])test(=|&|$)/.test(location.search + location.hash), []);
  const [nudge, setNudge] = useState(false);
  const busy = useRef(false);

  /* «поштовх» — коротка анімація, коли натиснули заблоковану кнопку */
  const bump = useCallback(() => {
    setNudge(false);
    requestAnimationFrame(() => setNudge(true));
    setTimeout(() => setNudge(false), 800);
  }, []);

  /* фото підвантажуємо з IndexedDB один раз на старті */
  useEffect(() => {
    window.STORE.idbGet('files').then(f => { if (f) setFiles(f); });
  }, []);

  const list = useMemo(() => all.filter(q => !q.showIf || q.showIf(answers)), [all, answers]);
  const q = list[Math.min(index, list.length - 1)];

  const realQs = list.filter(x => x.type !== 'cover' && x.type !== 'review');
  const total = realQs.length;
  const num = (q.type === 'cover' || q.type === 'review') ? 0 : realQs.indexOf(q) + 1;
  const answeredCount = realQs.filter(x => isAnswered(x, answers)).length;
  const pct = Math.round((index / Math.max(list.length - 1, 1)) * 100);

  const allFiles = useMemo(() => Object.values(files).flat(), [files]);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ answers, index, sent }));
  }, [answers, index, sent]);

  /* попереднє завантаження картинок наступного екрана */
  useEffect(() => {
    const nxt = list[index + 1];
    if (!nxt) return;
    [nxt.media, ...(nxt.options || []).map(o => o && o.img)].filter(Boolean)
      .forEach(u => { const i = new Image(); i.src = u; });
  }, [index, list]);

  const setAnswer = useCallback((val) => {
    setAnswers(a => ({ ...a, [q.id]: val }));
    setFlash(true);
    clearTimeout(setAnswer._t);
    setAnswer._t = setTimeout(() => setFlash(false), 1400);
  }, [q.id]);

  const setQFiles = useCallback((arr) => {
    setFiles(prev => {
      const next = { ...prev, [q.id]: arr };
      window.STORE.idbSet('files', next);
      return next;
    });
    setAnswers(a => ({ ...a, [q.id]: arr.map(f => ({ name: f.name, size: f.size, type: f.type })) }));
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
  }, [q.id]);

  const go = useCallback((dir, to) => {
    if (busy.current) return;
    const next = to !== undefined ? to : index + dir;
    if (next < 0 || next >= list.length || next === index) return;
    busy.current = true;
    const back = next < index;
    setPhase(back ? 'out-back' : 'out');
    setTimeout(() => {
      setIndex(next);
      setPhase(back ? 'in-back' : 'in');
      window.scrollTo({ top: 0 });
      busy.current = false;
    }, OUT_MS);
  }, [index, list.length]);

  /* обовʼязкові питання, які лишилися порожніми — через зміст їх можна перестрибнути */
  const missing = useMemo(
    () => list.map((x, i) => ({ q: x, index: i }))
              .filter(m => m.q.required && m.q.type !== 'review' && !isAnswered(m.q, answers)),
    [list, answers]
  );

  const canGo = q.type === 'review'
    ? missing.length === 0
    : (!q.required || isAnswered(q, answers));
  const isLast = index === list.length - 1;

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key !== 'Enter') return;
      if (tag === 'textarea' || q.type === 'review' || sending) return;
      if (tocOpen) return;
      e.preventDefault();
      if (canGo && !isLast) go(1); else if (!canGo) bump();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [go, canGo, isLast, q.type, sending, tocOpen, bump]);

  const restart = () => {
    if (!confirm('Почати анкету заново? Усі відповіді буде стерто.')) return;
    localStorage.removeItem(STORE_KEY);
    window.STORE.idbClear();
    setAnswers({}); setFiles({}); setIndex(0); setPhase('in'); setSent(null);
  };

  const submit = async (ansOverride, filesOverride) => {
    const ans = ansOverride || answers;
    const fls = filesOverride || allFiles;
    const vis = all.filter(x => !x.showIf || x.showIf(ans));

    setSending({ stage: 'answers', done: 0, total: 1 + fls.length });
    const payload = {
      submissionId: 'q' + Date.now().toString(36),
      submittedAt: new Date().toISOString(),
      answers: ans,
      readable: vis
        .filter(x => x.type !== 'cover' && x.type !== 'review')
        .map(x => ({ id: x.id, section: x.section || '', question: x.title, answer: formatAnswer(x, ans[x.id]) }))
    };
    try {
      const res = await window.STORE.submit(payload, fls, setSending);
      setSent(res.demo ? { demo: true } : { ok: true, at: payload.submittedAt, folderUrl: res.folderUrl });
    } catch (e) {
      console.error(e);
      setSent({ error: true, message: String(e.message || e) });
    } finally {
      setSending(null);
      go(0, list.length - 1);
    }
  };

  /* ---------- нижня панель ---------- */
  const nextLabel = q.cta
    || (q.type === 'review' ? 'Надіслати анкету'
    : q.required || q.type === 'scale' || isAnswered(q, answers) ? 'Далі' : 'Пропустити');

  const onNext = () => {
    if (!canGo) return bump();               /* не пускаємо далі — але пояснюємо, чому */
    return q.type === 'review' ? submit() : go(1);
  };

  const jump = (i) => { setTocOpen(false); go(0, i); };

  /* ---------- тестовий режим ---------- */

  const buildTestData = () => {
    const ans = window.TESTDATA.generate(all);
    const file = window.TESTDATA.sampleFile();
    const upload = all.find(x => x.type === 'upload');
    if (upload) {
      ans[upload.id] = [{ name: file.name, size: file.size, type: file.type }];
    }
    return { ans, files: upload ? { [upload.id]: [file] } : {} };
  };

  const testFill = () => {
    const { ans, files: f } = buildTestData();
    setAnswers(ans);
    setFiles(f);
    window.STORE.idbSet('files', f);
    const vis = all.filter(x => !x.showIf || x.showIf(ans));
    const idx = vis.findIndex(x => x.type === 'review');
    setIndex(idx > -1 ? idx : vis.length - 1);
    setPhase('in');
    window.scrollTo({ top: 0 });
  };

  const testSend = async () => {
    const { ans, files: f } = buildTestData();
    setAnswers(ans);
    setFiles(f);
    await submit(ans, Object.values(f).flat());
  };

  return html`
    <${React.Fragment}>
    <div class="app">
      <div class="progress"><span class="progress__bar" style=${{ width: pct + '%' }}></span></div>

      <header class="topbar">
        <div class="topbar__logo"><img src=${meta.logo} alt=${meta.studio}/></div>
        <div class="topbar__meta">
          <span class=${'saved' + (flash ? ' is-on' : '')} aria-live="polite">${flash ? 'Збережено' : ''}</span>
          <button class="btn--toc" onClick=${() => setTocOpen(true)} aria-haspopup="dialog">
            <svg width="15" height="12" viewBox="0 0 15 12" aria-hidden="true">
              <path d="M0 1h15M0 6h15M0 11h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Зміст
          </button>
        </div>
      </header>

      <main class="stage">
        ${q.type === 'cover'
          ? html`<${Cover} key=${q.id} q=${q} phase=${phase}/>`
          : q.type === 'review'
          ? html`<${Review} key=${q.id} q=${q} phase=${phase} list=${list} answers=${answers}
                            onJump=${(i) => go(0, i)} sending=${sending} missing=${missing}/>`
          : html`<${Question} key=${q.id} q=${q} num=${num} total=${total} phase=${phase}
                              value=${answers[q.id]} onChange=${setAnswer} nudge=${nudge}
                              files=${files[q.id] || []} onFiles=${setQFiles}/>`}
      </main>

      <footer class="nav">
        <div class="nav__inner">
          <button class="btn btn--ghost" onClick=${() => go(-1)} disabled=${index === 0 || !!sending}>
            <${Arrow} dir="left"/> Назад
          </button>

          <div class="nav__mid">
            ${sending
              ? (sending.stage === 'files'
                  ? `Надсилаємо файли ${sending.done} з ${sending.total}…`
                  : 'Надсилаємо відповіді…')
              : (q.type === 'cover' ? meta.title : `Відповіли на ${answeredCount} з ${total}`)}
          </div>

          ${isLast
            ? html`
              <div class="nav__final">
                <button class="btn btn--primary" onClick=${() => window.print()}>
                  Зберегти бриф у PDF
                </button>
              </div>`
            : html`
              <div class="nav__next">
                ${!canGo && html`
                  <div class=${'nav__hint' + (nudge ? ' is-nudge' : '')} role="status">
                    ${lockHint(q, missing)}
                  </div>`}
                <button class=${'btn btn--primary' + (canGo ? '' : ' is-locked') + (nudge ? ' is-nudge' : '')}
                        onClick=${onNext} aria-disabled=${!canGo} disabled=${!!sending}>
                  ${sending ? 'Надсилаємо…' : nextLabel}
                  ${!sending && html`<${Arrow}/>`}
                </button>
              </div>`}
        </div>
      </footer>

      ${tocOpen && html`
        <${Toc} list=${list} answers=${answers} index=${index}
                onJump=${jump} onClose=${() => setTocOpen(false)} onRestart=${restart}/>`}

      ${testMode && html`
        <${TestBar} onFill=${testFill} onSend=${testSend} onReset=${restart} busy=${!!sending}/>`}

      ${isLast && sent && html`
        <div class="sent-note">
          ${sent.error
            ? html`
              <p class="is-err">
                Не вдалося надіслати автоматично. Збережіть бриф у PDF і надішліть його нам — нічого не втрачено.
                ${sent.message && html`<br/><code>${sent.message}</code>`}
              </p>`
            : sent.demo
            ? html`<p>Демо-режим: адресу для надсилання ще не вписано в <code>js/config.js</code>. Бриф у PDF формується як зазвичай.</p>`
            : html`<p>Відповіді надіслано.</p>`}
        </div>`}
    </div>

    <${Brief} list=${list} answers=${answers} files=${allFiles}/>
    <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
