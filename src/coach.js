// Weekly coach report — a compact markdown digest to paste into Claude.
// Pure function over the store document, unit tested.

import {
  addDays, weekNumber, mondayOfWeek, phaseFor, PHASE_INFO,
  slotsFor, LIFTS, DAY_ABBR, weekdayOf, todayStr, runPace, kgLb, RECOVERY_PROGRAM,
} from './program.js';
import { currentStreak, weekAdherence, dailies } from './grit.js';

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
  {
    let full = 0;
    let elapsed = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      if (date > today) break;
      if (doc.settings.startDate && date < doc.settings.startDate) continue;
      elapsed++;
      if (dailies(doc.days[date]).every((x) => x.done)) full++;
    }
    L.push(`Dailies (weigh·sleep·protein·honest-log): ${full}/${elapsed} days 4-for-4`);
  }

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
  if (weights.length && doc.settings.walkAround) {
    const cur = weights[weights.length - 1];
    L.push(`- Cut: ${Math.max(0, cur - doc.settings.walkAround).toFixed(1)} kg to walk-around (${kgLb(doc.settings.walkAround)}) · fight ${kgLb(doc.settings.goalWeight)} · cap 0.5 kg/wk`);
  }
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
    if (doc.settings.startDate && date < doc.settings.startDate) continue; // before day one
    const tpl = slotsFor(date);
    const d = doc.days[date];
    const parts = [];
    for (const slot of ['am', 'pm']) {
      const spec = tpl[slot];
      if (!spec) continue;
      const isDone = slot === 'am' ? d?.amDone : d?.pmDone;
      let label = spec.type === 'lift' ? `${LIFTS[spec.lift].title} lift` : spec.label;
      if (spec.type === 'recovery' && weekdayOf(date) === 3) {
        const on = RECOVERY_PROGRAM.filter((item) => (item.store === 'recovery' ? d?.recovery?.[item.key] : d?.recoveryChecks?.[item.key])).length;
        label += ` (program ${on}/${RECOVERY_PROGRAM.length})`;
      }
      if (spec.type === 'lift') {
        const sess = doc.sessions[`${date}:${slot.toUpperCase()}`];
        const mains = LIFTS[spec.lift].exercises.filter((e) => e.main).map((e) => {
          const t = topSet(sess?.exercises?.[e.name]);
          return t ? `${e.name} ${t}` : null;
        }).filter(Boolean);
        if (mains.length) label += ` (${mains.join(', ')})`;
      }
      parts.push(`${slot.toUpperCase()} ${isDone ? '✓' : '✗'} ${label}`);
    }
    const xt = doc.sessions[`${date}:XT`];
    const xtTitle = xt ? LIFTS[xt.template].title : null;
    if (xt) {
      const mains = LIFTS[xt.template].exercises.filter((e) => e.main).map((e) => {
        const t = topSet(xt.exercises?.[e.name]);
        return t ? `${e.name} ${t}` : null;
      }).filter(Boolean);
      parts.push(`+ ${xtTitle} (ad-hoc${mains.length ? `: ${mains.join(', ')}` : ''})`);
    }
    for (const x of d?.extras || []) {
      if (xtTitle && x.note === xtTitle) continue; // already covered by the ad-hoc line
      const pace = x.type === 'Run' ? runPace(x.km, x.minutes) : null;
      parts.push(`+ ${x.type}${x.km ? ` ${x.km}km` : ''}${x.minutes ? ` ${x.minutes}min` : ''}${pace ? ` @ ${pace}` : ''}${x.note ? ` (${x.note})` : ''}`);
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
