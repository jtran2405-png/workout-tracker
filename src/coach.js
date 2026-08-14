// Weekly coach report — a compact markdown digest to paste into Claude.
// Pure function over the store document, unit tested.

import {
  addDays, weekNumber, mondayOfWeek, phaseFor, PHASE_INFO,
  slotsFor, LIFTS, DAY_ABBR, weekdayOf, todayStr,
} from './program.js';
import { currentStreak, weekAdherence } from './grit.js';

function topSet(sets) {
  const done = (sets || []).filter((s) => s.done && s.weight != null);
  if (!done.length) return null;
  const w = Math.max(...done.map((s) => Number(s.weight)));
  const reps = done.filter((s) => Number(s.weight) === w).map((s) => s.reps).join(',');
  return `${w}kg×${reps}`;
}

export function buildCoachReport(doc, week, today = todayStr()) {
  const monday = mondayOfWeek(week, doc.settings.week1Monday);
  const sunday = addDays(monday, 6);
  const phase = phaseFor(week, doc.settings.phaseOverride);
  const adh = weekAdherence(doc, week, today);
  const streak = currentStreak(doc, today);
  const L = [];

  L.push(`# Coach report — Week ${week} (${monday} → ${sunday})`);
  L.push(`Phase: ${PHASE_INFO[phase].label} · Streak: ${streak} days · Adherence: ${adh.done}/${adh.planned} slots${adh.pct != null ? ` (${adh.pct}%)` : ''}`);

  // ---- body ----
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (doc.days[date]) days.push({ date, d: doc.days[date] });
  }
  const weights = days.filter((x) => x.d.bodyWeight != null).map((x) => x.d.bodyWeight);
  const sleeps = days.filter((x) => x.d.sleepHours != null).map((x) => x.d.sleepHours);
  const weedTotal = days.reduce((a, x) => a + (x.d.weed || []).length, 0);
  L.push('', '## Body');
  L.push(weights.length
    ? `- Weight: ${weights[0]} → ${weights[weights.length - 1]} kg (Δ ${(weights[weights.length - 1] - weights[0]).toFixed(1)})`
    : '- Weight: no entries');
  L.push(sleeps.length
    ? `- Sleep: avg ${(sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1)}h · ${sleeps.filter((s) => s < 7).length} night(s) under 7h`
    : '- Sleep: no entries');
  L.push(`- Weed: ${weedTotal} session(s)`);

  // ---- food flags ----
  const logged = days.filter((x) => x.d.food);
  if (logged.length) {
    const c = (k) => logged.filter((x) => x.d.food[k]).length;
    L.push('', '## Food flags');
    L.push(`- Protein target hit: ${c('protein')}/${logged.length} days · Junk: ${c('junk')} · Ate late: ${c('late')}`);
    const notes = logged.filter((x) => x.d.food.note).map((x) => `${x.date.slice(5)}: ${x.d.food.note}`);
    if (notes.length) L.push(`- Notes: ${notes.join(' | ')}`);
  }

  // ---- training day by day ----
  L.push('', '## Training');
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (date > today) break;
    const tpl = slotsFor(date);
    const d = doc.days[date];
    const parts = [];
    if (tpl.am) parts.push(`AM ${d?.amDone ? '✓' : '✗'} ${tpl.am.label}`);
    if (tpl.pm) {
      let label = tpl.pm.type === 'lift' ? `${LIFTS[tpl.pm.lift].title} lift` : tpl.pm.label;
      if (tpl.pm.type === 'lift') {
        const sess = doc.sessions[`${date}:PM`];
        const mains = LIFTS[tpl.pm.lift].exercises.filter((e) => e.main).map((e) => {
          const t = topSet(sess?.exercises?.[e.name]);
          return t ? `${e.name} ${t}` : null;
        }).filter(Boolean);
        if (mains.length) label += ` (${mains.join(', ')})`;
      }
      parts.push(`PM ${d?.pmDone ? '✓' : '✗'} ${label}`);
    }
    for (const x of d?.extras || []) {
      parts.push(`+ ${x.type}${x.minutes ? ` ${x.minutes}min` : ''}${x.note ? ` (${x.note})` : ''}`);
    }
    L.push(`- ${DAY_ABBR[weekdayOf(date)]} ${date.slice(5)}: ${parts.join(' · ') || 'nothing logged'}`);
  }
  const sauna = days.filter((x) => x.d.recovery?.sauna).length;
  const plunge = days.filter((x) => x.d.recovery?.plunge).length;
  L.push(`- Recovery: sauna ×${sauna}, plunge ×${plunge}`);

  // ---- sparring notes ----
  const spar = days.filter((x) => x.d.sparringNotes);
  if (spar.length) {
    L.push('', '## Sparring notes');
    for (const x of spar) L.push(`- ${x.date.slice(5)}: ${x.d.sparringNotes}`);
  }

  return L.join('\n') + '\n';
}
