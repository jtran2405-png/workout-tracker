import { describe, it, expect } from 'vitest';
import { buildCoachReport } from '../src/coach.js';
import { emptyDoc } from '../src/store.js';

function week1Doc() {
  const doc = emptyDoc();
  doc.days['2026-08-17'] = {
    wake: '06:20', bedtime: '22:30', sleepHours: 7.5, bodyWeight: 79.2,
    weed: [{ time: '21:30', note: '' }], extras: [],
    food: { protein: true, junk: false, late: false, note: 'clean day' },
    recovery: { sauna: true, plunge: false },
    amDone: true, pmDone: true, sparringNotes: null,
  };
  doc.days['2026-08-18'] = {
    wake: '06:45', bedtime: '23:10', sleepHours: 6.5, bodyWeight: 79.0,
    weed: [], extras: [{ time: '17:00', type: 'Muay Thai', minutes: 45, note: 'light drills' }],
    food: { protein: true, junk: true, late: false, note: '' },
    recovery: { sauna: false, plunge: false },
    amDone: true, pmDone: false, sparringNotes: null,
  };
  doc.sessions['2026-08-17:AM'] = {
    date: '2026-08-17', slot: 'AM', template: 'LOWER', status: 'done',
    exercises: { 'Back squat': [{ weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }] },
  };
  return doc;
}

describe('coach report', () => {
  const report = buildCoachReport(week1Doc(), 1, '2026-08-18');

  it('has the header with phase, streak and adherence', () => {
    expect(report).toContain('# Coach report — Week 1 (2026-08-17 → 2026-08-23)');
    expect(report).toContain('Phase: Ramp');
    expect(report).toContain('Streak: 2 days');
    expect(report).toContain('Adherence: 3/3 slots (100%)');
  });
  it('grades the dailies', () => {
    expect(report).toContain('Dailies (weigh·sleep·protein·honest-log): 0/2 days 4-for-4');
  });
  it('summarizes body, weed and food flags', () => {
    expect(report).toContain('Weight: 79.2 → 79 kg (Δ -0.2)');
    expect(report).toContain('Sleep: avg 7.0h · 1 night(s) under 7h');
    expect(report).toContain('Weed: 1 session(s)');
    expect(report).toContain('Protein target hit: 2/2 days · Junk: 1 · Ate late: 0');
  });
  it('lists training days with main-lift top sets and extras', () => {
    expect(report).toContain('Mon 08-17: AM ✓ Lower · power lift (Back squat 60kg×8,8,8) · PM ✓ 25 min easy Z2 + mobility (evening ok)');
    expect(report).toContain('+ Muay Thai 45min (light drills)');
    expect(report).toContain('Recovery: sauna ×1, plunge ×0');
  });
  it('does not include future days', () => {
    expect(report).not.toContain('Wed 08-19');
  });
});

describe('coach report — wednesday recovery program', () => {
  it('shows checklist progress', () => {
    const doc = week1Doc();
    doc.days['2026-08-19'] = {
      wake: null, bedtime: null, sleepHours: null, bodyWeight: null,
      weed: [], extras: [], food: { protein: false, junk: false, late: false, note: '' },
      recovery: { sauna: true, plunge: true },
      recoveryChecks: { bands: true, hips: true },
      amDone: true, pmDone: false, sparringNotes: null,
    };
    const r = buildCoachReport(doc, 1, '2026-08-19');
    expect(r).toContain('Recovery program (program 4/7)');
  });
});

describe('coach report — baseline week 0', () => {
  it('covers the current calendar week and skips pre-start days', () => {
    const doc = emptyDoc();
    doc.days['2026-08-14'] = {
      wake: '06:30', bedtime: null, sleepHours: null, bodyWeight: 79.5,
      weed: [], extras: [], food: { protein: true, junk: false, late: false, note: '' },
      recovery: { sauna: true, plunge: false }, amDone: true, pmDone: false, sparringNotes: null,
    };
    const r = buildCoachReport(doc, 0, '2026-08-16');
    expect(r).toContain('Week 0 (2026-08-10 → 2026-08-16)');
    expect(r).toContain('Fri 08-14');
    expect(r).not.toContain('Mon 08-10');
    expect(r).toContain('Weight: 79.5 → 79.5 kg');
  });
});
