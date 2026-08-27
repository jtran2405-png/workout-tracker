// Accountability mechanics — pure functions, unit tested.
// No-zero-day: any completed slot or extra session keeps the chain alive.

import { addDays, todayStr, slotsFor, mondayOfWeek } from './program.js';

export function isNonZeroDay(day, date = null, doc = null) {
  if (!!day && (day.amDone || day.pmDone || (day.extras || []).length > 0)) return true;
  // an ad-hoc lift with at least one completed set counts, even if the
  // session was never fully finished
  if (date && doc) {
    const xt = doc.sessions?.[`${date}:XT`];
    if (xt && Object.values(xt.exercises || {}).some((sets) => (sets || []).some((s) => s.done))) return true;
  }
  return false;
}

// Consecutive non-zero days ending today (today doesn't break the streak
// while it's still in progress — it counts once logged).
export function currentStreak(doc, today = todayStr()) {
  let d = today;
  if (!isNonZeroDay(doc.days[d], d, doc)) d = addDays(d, -1);
  let streak = 0;
  while (isNonZeroDay(doc.days[d], d, doc)) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

// Strict-mode dailies: the four non-negotiables, every day.
// weigh/sleep/protein derive from the day's data; 'attest' is Justin's
// explicit "everything logged today is true" signature.
export function dailies(day) {
  return [
    { key: 'weigh', label: 'Weigh-in', done: day?.bodyWeight != null },
    { key: 'sleep', label: 'Sleep logged', done: day?.sleepHours != null },
    { key: 'protein', label: 'Protein hit', done: !!day?.food?.protein },
    { key: 'attest', label: 'Honest log', done: !!day?.attest },
  ];
}

export function disciplineWeek(doc, today = todayStr()) {
  let full = 0;
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, -i);
    if (date > today) continue;
    if (doc.settings.startDate && date < doc.settings.startDate) continue;
    days++;
    if (dailies(doc.days[date]).every((x) => x.done)) full++;
  }
  return { full, days };
}

// Adherence for a program week: completed planned slots / elapsed planned slots.
// Days before today count in full; today's slots count only once done
// (an unfinished today is pending, not missed).
export function weekAdherence(doc, week, today = todayStr()) {
  const monday = mondayOfWeek(week, doc.settings.week1Monday);
  let planned = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (doc.settings.startDate && date < doc.settings.startDate) continue; // before day one
    const tpl = slotsFor(date);
    const day = doc.days[date];
    for (const slot of ['am', 'pm']) {
      if (!tpl[slot]) continue;
      const isDone = slot === 'am' ? !!day?.amDone : !!day?.pmDone;
      if (date < today) {
        planned++;
        if (isDone) done++;
      } else if (date === today && isDone) {
        planned++;
        done++;
      }
    }
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null };
}
