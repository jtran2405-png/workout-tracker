import {
  todayStr, addDays, weekNumber, mondayOfWeek, phaseFor, LIFTS,
  setsFor, repRange, suggestNextWeight, parseDate,
} from '../program.js';
import { historyFor, lastSetsFor } from '../store.js';
import { h, toast } from '../ui.js';
import { lineChart } from '../chart.js';
import { currentStreak, weekAdherence } from '../grit.js';
import { buildCoachReport } from '../coach.js';

function shortDate(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const ALL_EXERCISES = [...new Set(
  Object.values(LIFTS).flatMap((l) => l.exercises.map((e) => e.name)),
)];

function exerciseSpec(name) {
  for (const l of Object.values(LIFTS)) {
    const ex = l.exercises.find((e) => e.name === name);
    if (ex) return ex;
  }
  return null;
}

export function renderProgress(root, ctx) {
  const { doc } = ctx;
  const today = todayStr();

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Progress')));

  // ---- stat tiles ----
  const weighDays = Object.keys(doc.days).filter((d) => doc.days[d].bodyWeight != null).sort();
  const latestW = weighDays.length ? doc.days[weighDays[weighDays.length - 1]].bodyWeight : null;
  const weekAgoDays = weighDays.filter((d) => d <= addDays(today, -7));
  const prevW = weekAgoDays.length ? doc.days[weekAgoDays[weekAgoDays.length - 1]].bodyWeight : null;
  const delta = latestW != null && prevW != null ? latestW - prevW : null;

  const sleepDays = Object.keys(doc.days).filter((d) => doc.days[d].sleepHours != null && d > addDays(today, -7));
  const avgSleep = sleepDays.length ? sleepDays.reduce((a, d) => a + doc.days[d].sleepHours, 0) / sleepDays.length : null;

  // current calendar week, including week 0 (baseline) — never a future week
  const week = Math.max(0, weekNumber(today, doc.settings.week1Monday));
  const monday = mondayOfWeek(week, doc.settings.week1Monday);
  let weedCount = 0, liftsDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = doc.days[addDays(monday, i)];
    if (!d) continue;
    weedCount += (d.weed || []).length;
  }
  for (const s of Object.values(doc.sessions)) {
    if (s.date >= monday && s.date <= addDays(monday, 6) && s.status === 'done' && s.template !== 'BASELINE') liftsDone++;
  }

  const tile = (label, value, delta) => h('div', { class: 'stat-tile' },
    h('div', { class: 'st-label' }, label),
    h('div', { class: 'st-value' }, value),
    delta || null,
  );

  const streak = currentStreak(doc);
  const adh = weekAdherence(doc, week);

  root.append(h('div', { class: 'stat-tiles' },
    tile('Streak', `${streak} ${streak === 1 ? 'day' : 'days'}`,
      h('div', { class: 'st-delta' }, 'no-zero-days keep the chain')),
    tile('Adherence · wk', adh.pct != null ? `${adh.pct}%` : '—',
      h('div', { class: `st-delta ${adh.pct != null && adh.pct >= 80 ? 'down' : 'up'}` }, `${adh.done}/${adh.planned} planned slots`)),
    tile('Body weight', latestW != null ? `${latestW} kg` : '—',
      delta != null ? h('div', { class: `st-delta ${delta <= 0 ? 'down' : 'up'}` }, `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg vs last week`) : null),
    tile('Sleep · 7d avg', avgSleep != null ? `${avgSleep.toFixed(1)} h` : '—',
      avgSleep != null ? h('div', { class: `st-delta ${avgSleep >= 7 ? 'down' : 'up'}` }, avgSleep >= 7 ? 'on target (7h+)' : 'below 7h target') : null),
    tile('Lifts this week', `${liftsDone} / 4`),
    tile('Weed this week', String(weedCount)),
  ));

  // ---- weekly coach ritual ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Coach check-in'),
    h('p', { class: 'sub', style: 'margin-bottom:10px' },
      'Sunday night: copy the report, paste it to Claude (/coach). Numbers don’t negotiate.'),
    h('button', {
      class: 'btn btn-primary', style: 'width:100%',
      onclick: async () => {
        const report = buildCoachReport(doc, week);
        try {
          await navigator.clipboard.writeText(report);
          toast('Coach report copied — paste it to Claude', 'good');
        } catch {
          // clipboard can be blocked (older iOS): fall back to share sheet
          if (navigator.share) navigator.share({ text: report });
          else toast('Could not copy — try again', 'warn');
        }
      },
    }, '📋 Copy coach report — week ' + week),
  ));

  // ---- per-exercise progression ----
  const withHistory = ALL_EXERCISES.filter((n) => historyFor(doc, n).length > 0);
  const options = withHistory.length ? withHistory : ALL_EXERCISES;
  const selected = ctx.state.progressExercise && options.includes(ctx.state.progressExercise)
    ? ctx.state.progressExercise : options[0];

  const exCard = h('div', { class: 'card' }, h('h2', {}, 'Exercise progression'));
  const sel = h('select', { class: 'picker', onchange: (e) => { ctx.state.progressExercise = e.target.value; ctx.refresh(); } });
  for (const n of options) sel.append(h('option', { value: n, selected: n === selected }, n));
  exCard.append(sel);

  const hist = historyFor(doc, selected);
  exCard.append(lineChart(hist.map((p) => ({ label: shortDate(p.date), value: p.weight })), { unit: 'kg', decimals: 1 }));

  const spec = exerciseSpec(selected);
  if (spec && hist.length) {
    const phase = phaseFor(week, doc.settings.phaseOverride);
    const prev = lastSetsFor(doc, selected, addDays(today, 1));
    const next = suggestNextWeight(prev, setsFor(spec, phase), repRange(spec, phase).high);
    if (next != null) {
      const bump = next > hist[hist.length - 1].weight;
      exCard.append(h('p', { class: 'sub', style: 'margin-top:8px' },
        `Next session: `,
        h('strong', { style: bump ? 'color:var(--accent)' : '' }, `${next} kg`),
        bump ? ' — all sets hit the top of the range, add 2.5 kg.' : ' — repeat, then beat the rep targets to earn +2.5 kg.'));
    }
  }
  root.append(exCard);

  // ---- body weight trend ----
  const wPoints = weighDays.slice(-60).map((d) => ({ label: shortDate(d), value: doc.days[d].bodyWeight }));
  root.append(h('div', { class: 'card' }, h('h2', {}, 'Body weight'),
    lineChart(wPoints, { unit: 'kg', decimals: 1 })));

  // ---- sleep trend ----
  const sPoints = Object.keys(doc.days)
    .filter((d) => doc.days[d].sleepHours != null).sort().slice(-30)
    .map((d) => ({ label: shortDate(d), value: doc.days[d].sleepHours }));
  root.append(h('div', { class: 'card' }, h('h2', {}, 'Sleep'),
    lineChart(sPoints, { unit: 'h', decimals: 1, height: 180, reference: { value: 7, label: '7h target' } })));
}
