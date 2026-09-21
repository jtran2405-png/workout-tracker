import { describe, it, expect } from 'vitest';
import {
  weekNumber, phaseFor, setsFor, repRange, suggestNextWeight,
  canLift, plungeWarning, sparringMode, WEEK_TEMPLATE, LIFTS, isLiftingDay,
  mondayOfWeek, addDays, runPace, slotsFor,
  sleepHoursOf, DAILY_BASE, sleepFromClock,
} from '../src/program.js';

describe('week numbering (week 1 = Mon 2026-08-17)', () => {
  it('day one Fri 2026-08-14 is week 0 (baseline)', () => {
    expect(weekNumber('2026-08-14')).toBe(0);
    expect(weekNumber('2026-08-16')).toBe(0);
  });
  it('Mon 2026-08-17 through Sun 2026-08-23 are week 1', () => {
    expect(weekNumber('2026-08-17')).toBe(1);
    expect(weekNumber('2026-08-18')).toBe(1);
    expect(weekNumber('2026-08-23')).toBe(1);
  });
  it('week 4 ends Sun 2026-09-13; week 5 starts Mon 2026-09-14', () => {
    expect(weekNumber('2026-09-13')).toBe(4);
    expect(weekNumber('2026-09-14')).toBe(5);
    expect(weekNumber('2026-09-15')).toBe(5);
  });
  it('mondayOfWeek inverts weekNumber', () => {
    expect(mondayOfWeek(1)).toBe('2026-08-17');
    expect(mondayOfWeek(5)).toBe('2026-09-14');
  });
});

describe('phase logic', () => {
  it('maps weeks to phases', () => {
    expect(phaseFor(0)).toBe('baseline');
    expect(phaseFor(1)).toBe('ramp');
    expect(phaseFor(4)).toBe('ramp');
    expect(phaseFor(5)).toBe('build');
    expect(phaseFor(12)).toBe('build');
  });
  it('respects override', () => {
    expect(phaseFor(2, 'build')).toBe('build');
    expect(phaseFor(9, 'ramp')).toBe('ramp');
  });
});

describe('sets and reps by phase', () => {
  const bench = LIFTS.UPPER_A.exercises.find((e) => e.name === 'Bench press');
  const pulldown = LIFTS.UPPER_A.exercises.find((e) => e.name === 'Lat pulldown');
  const calf = LIFTS.LOWER.exercises.find((e) => e.name === 'Standing calf raise');

  it('ramp = 3 sets, build = 4 sets', () => {
    expect(setsFor(bench, 'ramp')).toBe(3);
    expect(setsFor(bench, 'build')).toBe(4);
  });
  it('explicit set counts always win (calf 4×12)', () => {
    expect(setsFor(calf, 'ramp')).toBe(4);
    expect(setsFor(calf, 'build')).toBe(4);
  });
  it('main lifts move to 4–6 reps in build; accessories keep their range', () => {
    expect(repRange(bench, 'ramp')).toEqual({ low: 6, high: 8 });
    expect(repRange(bench, 'build')).toEqual({ low: 4, high: 6 });
    expect(repRange(pulldown, 'build')).toEqual({ low: 8, high: 10 });
  });
});

describe('progression (+2.5 kg at top of rep range)', () => {
  const sets = (w, reps) => reps.map((r) => ({ weight: w, reps: r, done: true }));

  it('all planned sets at top of range → +2.5', () => {
    expect(suggestNextWeight(sets(40, [8, 8, 8]), 3, 8)).toBe(42.5);
  });
  it('any set short of top → repeat weight', () => {
    expect(suggestNextWeight(sets(40, [8, 8, 7]), 3, 8)).toBe(40);
  });
  it('fewer completed sets than planned → repeat weight', () => {
    expect(suggestNextWeight(sets(40, [8, 8]), 3, 8)).toBe(40);
  });
  it('no history → null', () => {
    expect(suggestNextWeight(null, 3, 8)).toBeNull();
    expect(suggestNextWeight([], 3, 8)).toBeNull();
    expect(suggestNextWeight([{ weight: 40, reps: 8, done: false }], 3, 8)).toBeNull();
  });
});

describe('day rules', () => {
  // 2026-08-17 Mon, 18 Tue, 19 Wed, 20 Thu, 21 Fri, 22 Sat, 23 Sun
  it('lifting allowed Mon/Tue/Thu/Fri only', () => {
    expect(canLift('2026-08-17')).toBe(true);
    expect(canLift('2026-08-18')).toBe(true);
    expect(canLift('2026-08-19')).toBe(false); // Wednesday: hard no-lift
    expect(canLift('2026-08-20')).toBe(true);
    expect(canLift('2026-08-21')).toBe(true);
    expect(canLift('2026-08-22')).toBe(false);
    expect(canLift('2026-08-23')).toBe(false);
  });
  it('plunge warns on lifting days, silent Wed/Sat/Sun', () => {
    expect(plungeWarning('2026-08-17')).toBeTruthy();
    expect(plungeWarning('2026-08-19')).toBeNull();
    expect(plungeWarning('2026-08-22')).toBeNull();
    expect(plungeWarning('2026-08-23')).toBeNull();
  });
  it('plunge warns after an ad-hoc lift on an otherwise non-lifting day', () => {
    const doc = { sessions: { '2026-08-22:XT': { template: 'CHEST' } } };
    expect(plungeWarning('2026-08-22', null, doc)).toBeTruthy();
    const day = { extras: [{ type: 'Lift', note: 'Chest day' }] };
    expect(plungeWarning('2026-08-22', day, null)).toBeTruthy();
    expect(plungeWarning('2026-08-22', { extras: [{ type: 'Cardio' }] }, { sessions: {} })).toBeNull();
  });
  it('Saturday is a freestyle slot', () => {
    expect(WEEK_TEMPLATE[6].am.type).toBe('freestyle');
  });
  it('run pace formats mm:ss per km', () => {
    expect(runPace(3.14, 21)).toBe('6:41/km');
    expect(runPace(5, 25)).toBe('5:00/km');
    expect(runPace(null, 21)).toBeNull();
    expect(runPace(3.14, null)).toBeNull();
  });
  it('Wednesday template has no lift slot', () => {
    expect(WEEK_TEMPLATE[3].pm.type).toBe('recovery');
    expect(WEEK_TEMPLATE[3].am.type).toBe('cardio');
  });
  it('Sunday sparring is technical weeks 1–4, live from week 5', () => {
    expect(sparringMode(4)).toBe('technical');
    expect(sparringMode(5)).toBe('live');
  });
});

describe('low-sleep readiness warning', () => {
  // the Train view shows the "keep weights at last session's numbers" banner when
  // sleep < 6h on a lifting day. Every lift is an AM slot, so a PM-only check is dead.
  it('fires on every lifting day, all of which are AM', () => {
    for (const date of ['2026-08-17', '2026-08-18', '2026-08-20', '2026-08-21']) {
      expect(isLiftingDay(date), date).toBe(true);
      expect(slotsFor(date).am.type).toBe('lift');
      expect(slotsFor(date).pm?.type === 'lift').toBe(false); // never a PM lift
    }
  });
  it('stays silent on the no-lift days', () => {
    for (const date of ['2026-08-19', '2026-08-22', '2026-08-23']) {
      expect(isLiftingDay(date), date).toBe(false);
    }
  });
});

describe('sleep from the clock pickers', () => {
  it('computes hours across midnight', () => {
    expect(sleepFromClock('22:30', '06:00')).toBe(7.5);
    expect(sleepFromClock('23:10', '06:45')).toBe(7.6);
  });
  it('handles a same-day nap window without wrapping', () => {
    expect(sleepFromClock('01:00', '08:30')).toBe(7.5);
  });
  it('is null unless both clock values parse', () => {
    expect(sleepFromClock(null, '06:00')).toBeNull();
    expect(sleepFromClock('22:30', null)).toBeNull();
    expect(sleepFromClock('not-a-time', '06:00')).toBeNull();
  });
  it('an explicit sleepHours still wins over the pickers', () => {
    expect(sleepHoursOf({ bedtime: '22:30', wake: '06:00', sleepHours: 5 })).toBe(5);
  });
  it('falls back to the pickers when sleepHours was never written', () => {
    expect(sleepHoursOf({ bedtime: '22:30', wake: '06:00', sleepHours: null })).toBe(7.5);
  });
});

describe('template shape', () => {
  it('four AM lift slots: three strength days plus Friday conditioning', () => {
    expect(WEEK_TEMPLATE[1].am.lift).toBe('LOWER');
    expect(WEEK_TEMPLATE[2].am.lift).toBe('UPPER_A');
    expect(WEEK_TEMPLATE[4].am.lift).toBe('POSTERIOR');
    expect(WEEK_TEMPLATE[5].am.lift).toBe('CONDITIONING');
  });
  it('Friday is conditioning every week, AM only; ATHLETIC is ad-hoc for Saturdays', () => {
    expect(slotsFor('2026-08-28').am.lift).toBe('CONDITIONING');
    expect(WEEK_TEMPLATE[5].pm).toBeNull(); // hard conditioning day carries no PM slot
    expect(LIFTS.ATHLETIC.adhoc).toBe(true);
  });
  it('UPPER_B is retired from the weekly split but still reachable ad-hoc', () => {
    // 04c41aa moved Friday to CONDITIONING; the session itself was kept as an option
    const inSplit = Object.values(WEEK_TEMPLATE)
      .flatMap((d) => [d.am, d.pm])
      .some((slot) => slot?.lift === 'UPPER_B');
    expect(inSplit).toBe(false);
    expect(LIFTS.UPPER_B.adhoc).toBe(true);
    // the Train view builds its off-plan picker from exactly this filter
    expect(Object.keys(LIFTS).filter((k) => LIFTS[k].adhoc)).toContain('UPPER_B');
  });
  it('every lift is either in the weekly split, ad-hoc, or the baseline session', () => {
    const inSplit = new Set(Object.values(WEEK_TEMPLATE)
      .flatMap((d) => [d.am, d.pm])
      .map((slot) => slot?.lift)
      .filter(Boolean));
    for (const [key, lift] of Object.entries(LIFTS)) {
      const reachable = inSplit.has(key) || lift.adhoc === true || key === 'BASELINE';
      expect(reachable, `${key} is unreachable from every screen`).toBe(true);
    }
  });
  it('DAILY_BASE is a slot spec the Train view can render every day', () => {
    expect(DAILY_BASE.type).toBe('cardio');
    expect(DAILY_BASE.label).toMatch(/3–5k/); // 3–5k daily, not a fixed 5k
    expect(DAILY_BASE.lift).toBeUndefined(); // cardio, never routed through liftBody
  });
  it('every template exercise has a valid rep range', () => {
    for (const lift of Object.values(LIFTS)) {
      for (const ex of lift.exercises) {
        expect(ex.low).toBeGreaterThan(0);
        expect(ex.high).toBeGreaterThanOrEqual(ex.low);
      }
    }
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });
});

// Regression: the coach report, progress charts and the <6h lift guard all read
// `sleepHours` only, so nights logged with the Wake/Bedtime pickers were invisible
// and reported as "no entries" even though the dailies tick counted them.
describe('sleepHoursOf', () => {
  it('derives hours from bedtime + wake across midnight', () => {
    expect(sleepHoursOf({ bedtime: '23:00', wake: '07:00' })).toBe(8);
    expect(sleepHoursOf({ bedtime: '23:30', wake: '06:00' })).toBe(6.5);
    expect(sleepHoursOf({ bedtime: '22:15', wake: '05:45' })).toBe(7.5);
  });

  it('handles a post-midnight bedtime', () => {
    expect(sleepHoursOf({ bedtime: '01:00', wake: '09:00' })).toBe(8);
  });

  it('prefers an explicitly entered sleepHours', () => {
    expect(sleepHoursOf({ sleepHours: 5, bedtime: '23:00', wake: '07:00' })).toBe(5);
  });

  it('returns null when the night is genuinely unlogged', () => {
    expect(sleepHoursOf({})).toBe(null);
    expect(sleepHoursOf(null)).toBe(null);
    expect(sleepHoursOf({ bedtime: '23:00' })).toBe(null);
    expect(sleepHoursOf({ wake: '07:00' })).toBe(null);
  });
});
