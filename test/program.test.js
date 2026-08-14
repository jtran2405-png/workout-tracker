import { describe, it, expect } from 'vitest';
import {
  weekNumber, phaseFor, setsFor, repRange, suggestNextWeight,
  canLift, plungeWarning, sparringMode, WEEK_TEMPLATE, LIFTS,
  mondayOfWeek, addDays,
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
  it('Wednesday template has no lift slot', () => {
    expect(WEEK_TEMPLATE[3].pm.type).toBe('recovery');
    expect(WEEK_TEMPLATE[3].am.type).toBe('cardio');
  });
  it('Sunday sparring is technical weeks 1–4, live from week 5', () => {
    expect(sparringMode(4)).toBe('technical');
    expect(sparringMode(5)).toBe('live');
  });
});

describe('template shape', () => {
  it('four lifting days with the right templates', () => {
    expect(WEEK_TEMPLATE[1].pm.lift).toBe('LOWER');
    expect(WEEK_TEMPLATE[2].pm.lift).toBe('UPPER_A');
    expect(WEEK_TEMPLATE[4].pm.lift).toBe('POSTERIOR');
    expect(WEEK_TEMPLATE[5].pm.lift).toBe('UPPER_B');
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
