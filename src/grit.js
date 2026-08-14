// Accountability mechanics — pure functions, unit tested.
// No-zero-day: any completed slot or extra session keeps the chain alive.

import { addDays, todayStr, slotsFor, mondayOfWeek } from './program.js';

export function isNonZeroDay(day) {
  return !!day && (day.amDone || day.pmDone || (day.extras || []).length > 0);
}

// Consecutive non-zero days ending today (today doesn't break the streak
// while it's still in progress — it counts once logged).
export function currentStreak(doc, today = todayStr()) {
  let d = today;
  if (!isNonZeroDay(doc.days[d])) d = addDays(d, -1);
  let streak = 0;
  while (isNonZeroDay(doc.days[d])) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
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
