// HEALTH face — the habit ledger. No programming logic, just honest data:
// sleep, weight, weed, food flags, recovery, showed-up status.

import { todayStr, addDays, parseDate, DAY_NAMES, weekNumber, plungeWarning } from '../program.js';
import { getDay } from '../store.js';
import { h, confirmDialog, nowTime } from '../ui.js';
import { isNonZeroDay, currentStreak, weekAdherence } from '../grit.js';

function prettyDate(dateStr) {
  const d = parseDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} · ${d.getDate()}/${d.getMonth() + 1}`;
}

export function renderHealth(root, ctx) {
  const { doc } = ctx;
  const date = ctx.state.date ?? todayStr();
  const isToday = date === todayStr();
  const day = getDay(doc, date);
  const streak = currentStreak(doc);
  const week = Math.max(1, weekNumber(todayStr(), doc.settings.week1Monday));
  const adh = weekAdherence(doc, week);

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, 'Health'),
      h('div', { class: 'datenav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Previous day', onclick: () => { ctx.state.date = addDays(date, -1); ctx.refresh(); } }, '‹'),
        h('button', {
          class: 'iconbtn', style: 'font-size:12px;font-weight:700;padding:0 10px;min-width:64px',
          onclick: () => { ctx.state.date = null; ctx.refresh(); },
        }, isToday ? 'Today' : prettyDate(date).split(' · ')[1]),
        h('button', { class: 'iconbtn', 'aria-label': 'Next day', onclick: () => { ctx.state.date = addDays(date, 1); ctx.refresh(); } }, '›'),
      ),
    ),
    h('div', { class: 'grit-banner' },
      h('div', { class: 'grit-item' }, h('span', { class: 'grit-num' }, String(streak)), h('span', { class: 'grit-label' }, streak === 1 ? 'day streak' : 'day streak')),
      h('div', { class: 'grit-item' }, h('span', { class: 'grit-num' }, adh.pct != null ? `${adh.pct}%` : '—'), h('span', { class: 'grit-label' }, `adherence (${adh.done}/${adh.planned})`)),
      h('div', { class: 'grit-item' },
        h('span', { class: `grit-num ${isNonZeroDay(getDay(doc, todayStr())) ? 'grit-good' : 'grit-bad'}` }, isNonZeroDay(getDay(doc, todayStr())) ? '✓' : '·'),
        h('span', { class: 'grit-label' }, 'showed up today')),
    ),
    h('p', { class: 'sub', style: 'margin: -4px 2px 12px; font-size: 12.5px; color: var(--muted)' },
      isToday ? prettyDate(date) : `Editing ${prettyDate(date)}`),
  );

  const num = (v) => (v === '' ? null : Number(v));
  const habit = (label, input) => h('div', { class: 'habit' }, h('label', {}, label), input);

  // ---- sleep & weight ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Body & sleep'),
    h('div', { class: 'habits' },
      habit('Wake', h('input', { type: 'time', value: day.wake || '', onchange: (e) => { day.wake = e.target.value || null; ctx.save(); } })),
      habit('Bedtime', h('input', { type: 'time', value: day.bedtime || '', onchange: (e) => { day.bedtime = e.target.value || null; ctx.save(); } })),
      habit('Sleep h', h('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '14', placeholder: '7.5', value: day.sleepHours ?? '', onchange: (e) => { day.sleepHours = num(e.target.value); ctx.save(); } })),
      habit('Weight kg', h('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '200', placeholder: '—', value: day.bodyWeight ?? '', onchange: (e) => { day.bodyWeight = num(e.target.value); ctx.save(); } })),
    ),
  ));

  // ---- food flags (5-second honesty check) ----
  const foodChip = (key, label, goodWhenOn) => h('button', {
    class: `rec-chip food-chip${day.food[key] ? (goodWhenOn ? ' on' : ' on-bad') : ''}`,
    onclick: () => { day.food[key] = !day.food[key]; ctx.save(); ctx.refresh(); },
  }, label);

  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Food'),
    h('div', { class: 'recovery-chips' },
      foodChip('protein', '🍗 Protein hit', true),
      foodChip('junk', '🍟 Junk', false),
      foodChip('late', '🌙 Ate late', false),
    ),
    h('input', {
      type: 'text', class: 'food-note', placeholder: 'one-line food note (optional)',
      value: day.food.note || '', onchange: (e) => { day.food.note = e.target.value; ctx.save(); },
    }),
  ));

  // ---- weed ----
  const weedList = h('div', {});
  const renderWeed = () => {
    weedList.innerHTML = '';
    (day.weed || []).forEach((w, i) => {
      weedList.append(h('div', { class: 'weed-row' },
        h('input', { type: 'time', value: w.time, onchange: (e) => { w.time = e.target.value; ctx.save(); } }),
        h('input', { type: 'text', placeholder: 'note (optional)', value: w.note || '', onchange: (e) => { w.note = e.target.value; ctx.save(); } }),
        h('button', { class: 'iconbtn', 'aria-label': 'Remove', onclick: () => { day.weed.splice(i, 1); ctx.save(); renderWeed(); } }, '×'),
      ));
    });
  };
  renderWeed();
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Weed'),
    weedList,
    h('button', {
      class: 'btn btn-ghost', style: 'width:100%',
      onclick: () => { day.weed.push({ time: nowTime(), note: '' }); ctx.save(); ctx.refresh(); },
    }, `+ log session${day.weed.length ? ` (${day.weed.length} today)` : ''}`),
  ));

  // ---- recovery ----
  const chip = (key, label) => h('button', {
    class: `rec-chip${day.recovery[key] ? ' on' : ''}`,
    onclick: async () => {
      if (key === 'plunge' && !day.recovery.plunge) {
        const warn = plungeWarning(date, day, doc);
        if (warn) {
          const ok = await confirmDialog({ title: 'Cold plunge on a lifting day?', body: warn });
          if (!ok) return;
        }
      }
      day.recovery[key] = !day.recovery[key];
      ctx.save();
      ctx.refresh();
    },
  }, label);

  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Recovery'),
    h('div', { class: 'recovery-chips' }, chip('sauna', '🔥 Sauna'), chip('plunge', '🧊 Cold plunge')),
    plungeWarning(date, day, doc) && !day.recovery.plunge
      ? h('div', { class: 'warn-note' }, '⚠︎', 'You lifted today — skip the plunge (sauna is fine).')
      : null,
  ));
}
