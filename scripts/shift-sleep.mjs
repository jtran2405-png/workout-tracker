// One-time repair: move sleep entries forward one day.
//
// Until 2026-09-22 the Health tab labelled its two clock fields only "Wake" and
// "Bedtime", with nothing to say which night they belonged to. Justin logged
// each night on the page for the day it STARTED — waking on the 15th, he opened
// the 14th and entered when he fell asleep. The app means the opposite: a day
// record holds the night that ENDED that morning, which is the only reading
// under which the Train tab's readiness check gates a morning lift on the sleep
// that preceded it.
//
// So every affected night sits one day early and has to move forward by one.
//
// Only the sleep triple moves — bedtime, wake, sleepHours. Body weight, food,
// weed, recovery and the done flags were always logged against the right day
// and are left exactly where they are.
//
// Usage:
//   node scripts/shift-sleep.mjs backup.json                      # dry run
//   node scripts/shift-sleep.mjs backup.json --through 2026-09-21 # limit range
//   node scripts/shift-sleep.mjs backup.json --write out.json     # apply
//
// Never writes over its input.

import { readFileSync, writeFileSync } from 'node:fs';

const SLEEP_FIELDS = ['bedtime', 'wake', 'sleepHours'];

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

const hasSleep = (day) => !!day && SLEEP_FIELDS.some((f) => day[f] != null);

// A fresh record in the same shape store.getDay() would create, so a shifted
// night landing on a day that was never opened does not produce a half-record.
const blankDay = () => ({
  wake: null, bedtime: null, sleepHours: null, bodyWeight: null,
  weed: [], extras: [], food: { protein: false, junk: false, late: false, note: '' },
  recovery: { sauna: false, plunge: false }, recoveryChecks: {}, attest: false,
  amDone: false, pmDone: false, runDone: false, sparringNotes: null,
});

export function shiftSleep(doc, { through = null } = {}) {
  const out = structuredClone(doc);
  const dates = Object.keys(out.days || {}).sort();
  const moves = [];
  const collisions = [];

  // Walk newest → oldest. Moving the latest night first means each target is
  // already vacated by the time an earlier night needs it, so a continuous run
  // of days shifts cleanly instead of every step colliding with the next.
  for (const date of [...dates].reverse()) {
    if (through && date > through) continue;
    const day = out.days[date];
    if (!hasSleep(day)) continue;

    const target = addDays(date, 1);
    const dest = out.days[target];

    // Something is already there — two different nights claiming one morning.
    // Never guess: report it and leave both untouched.
    if (hasSleep(dest)) {
      collisions.push({ from: date, to: target, existing: pick(dest), moving: pick(day) });
      continue;
    }

    if (!dest) out.days[target] = blankDay();
    const moved = pick(day);
    for (const f of SLEEP_FIELDS) {
      out.days[target][f] = day[f] ?? null;
      day[f] = null;
    }
    moves.push({ from: date, to: target, ...moved });
  }

  return { doc: out, moves: moves.reverse(), collisions: collisions.reverse() };
}

function pick(day) {
  return { bedtime: day?.bedtime ?? null, wake: day?.wake ?? null, sleepHours: day?.sleepHours ?? null };
}

// ---------- CLI ----------

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [input] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? null : process.argv[i + 1];
  };

  if (!input) {
    console.error('usage: node scripts/shift-sleep.mjs <backup.json> [--through YYYY-MM-DD] [--write out.json]');
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(input, 'utf8'));
  const { doc: fixed, moves, collisions } = shiftSleep(doc, { through: flag('through') });

  console.log(`\n${moves.length} night(s) move forward one day:\n`);
  for (const m of moves) {
    console.log(`  ${m.from} → ${m.to}   bed ${m.bedtime ?? '—'}  wake ${m.wake ?? '—'}  ${m.sleepHours ?? '—'}h`);
  }

  if (collisions.length) {
    console.log(`\n${collisions.length} NOT moved — the target day already has sleep logged:\n`);
    for (const c of collisions) {
      console.log(`  ${c.from} → ${c.to}`);
      console.log(`      staying put: bed ${c.moving.bedtime ?? '—'} wake ${c.moving.wake ?? '—'}`);
      console.log(`      already at ${c.to}: bed ${c.existing.bedtime ?? '—'} wake ${c.existing.wake ?? '—'}`);
    }
    console.log('\n  Decide these by hand — two nights cannot share one morning.');
  }

  const out = flag('write');
  if (out) {
    writeFileSync(out, JSON.stringify(fixed, null, 2));
    console.log(`\nWrote ${out}. Input left untouched. Restore it from Data → Restore backup.\n`);
  } else {
    console.log('\nDry run — nothing written. Re-run with --write out.json to apply.\n');
  }
}
