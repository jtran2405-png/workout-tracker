import {
  todayStr, addDays, weekNumber, mondayOfWeek, phaseFor, PHASE_INFO,
  slotsFor, LIFTS, repTargetLabel, sparringMode, parseDate, DAY_ABBR, weekdayOf,
} from '../program.js';
import { h } from '../ui.js';

export function renderWeek(root, ctx) {
  const { doc } = ctx;
  const today = todayStr();
  const currentWeek = Math.max(1, weekNumber(today, doc.settings.week1Monday));
  const week = ctx.state.weekN ?? currentWeek;
  const monday = mondayOfWeek(week, doc.settings.week1Monday);
  const phase = phaseFor(week, doc.settings.phaseOverride);

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, 'Week'),
      h('div', { class: 'datenav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Previous week', onclick: () => { ctx.state.weekN = Math.max(1, week - 1); ctx.refresh(); } }, '‹'),
        h('button', {
          class: 'iconbtn', style: 'font-size:12px;font-weight:700;padding:0 10px;min-width:72px',
          onclick: () => { ctx.state.weekN = null; ctx.refresh(); },
        }, `Week ${week}`),
        h('button', { class: 'iconbtn', 'aria-label': 'Next week', onclick: () => { ctx.state.weekN = week + 1; ctx.refresh(); } }, '›'),
      ),
    ),
    h('div', { class: 'phase-banner' },
      h('span', { class: 'pb-week' }, `Week ${week} · ${PHASE_INFO[phase].label} phase`),
      h('span', { class: 'pb-cue' }, PHASE_INFO[phase].cue),
    ),
  );

  // ---- 7-day status grid ----
  const grid = h('div', { class: 'card' }, h('h2', {}, 'This week'));
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const d = parseDate(date);
    const tpl = slotsFor(date);
    const day = doc.days[date];

    const slotLine = (tag, spec, done) => {
      if (!spec) return null;
      let cls = 'dot';
      if (done) cls += ' done';
      else if (date < today) cls += ' missed';
      let label = spec.type === 'lift' ? `${LIFTS[spec.lift].title} lift` : spec.label;
      if (spec.type === 'sparring' && weekdayOf(date) === 0) {
        label += sparringMode(week) === 'live' ? ' · LIVE' : ' · technical';
      }
      return h('div', { class: 'wd-slot' }, h('span', { class: 'tag' }, tag), h('span', { class: cls }), label);
    };

    grid.append(h('div', {
      class: 'week-day', role: 'button', tabindex: '0', style: 'cursor:pointer',
      onclick: () => { ctx.state.todayDate = date === today ? null : date; location.hash = '#/today'; },
    },
      h('div', { class: `wd-date${date === today ? ' today' : ''}` },
        h('div', { class: 'wd-name' }, DAY_ABBR[d.getDay()]),
        h('div', { class: 'wd-num' }, String(d.getDate())),
      ),
      h('div', { class: 'wd-slots' },
        slotLine('AM', tpl.am, day?.amDone),
        slotLine('PM', tpl.pm, day?.pmDone),
      ),
    ));
  }
  root.append(grid);

  // ---- the split reference (suggested training, phase-adjusted) ----
  const split = h('div', { class: 'card' }, h('h2', {}, 'The split — suggested training'));
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  for (const wd of dayOrder) {
    const tpl = { ...slotsFor(addDays(monday, dayOrder.indexOf(wd))) };
    const name = DAY_ABBR[wd];
    if (tpl.pm?.type === 'lift') {
      const lift = LIFTS[tpl.pm.lift];
      const det = h('details', { class: 'split' },
        h('summary', {}, `${name} — AM ${tpl.am.label} · PM ${lift.title}`),
      );
      for (const ex of lift.exercises) {
        det.append(h('div', { class: 'ex-line' },
          h('span', {}, ex.name + (ex.note ? ` (${ex.note})` : '')),
          h('span', { class: 't' }, repTargetLabel(ex, phase)),
        ));
      }
      split.append(det);
    } else {
      const am = tpl.am ? `AM ${tpl.am.label}` : null;
      const pm = tpl.pm ? `PM ${tpl.pm.label}` : null;
      split.append(h('div', { class: 'ex-line', style: 'border-top:1px solid var(--line);padding:12px 2px' },
        h('span', { style: 'font-weight:700;color:var(--ink-2)' }, name),
        h('span', { class: 't' }, [am, pm].filter(Boolean).join(' · ')),
      ));
    }
  }
  split.append(h('p', { class: 'sub', style: 'margin-top:10px' },
    'Rules: Wed = hard no-lift. No two-a-day lifting. Cold plunge only Wed + after Sat sparring. Sauna after lifting is always fine.'));
  root.append(split);
}
