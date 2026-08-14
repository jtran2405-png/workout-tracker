import { describe, it, expect } from 'vitest';
import { isNonZeroDay, currentStreak, weekAdherence } from '../src/grit.js';
import { emptyDoc } from '../src/store.js';

const day = (patch = {}) => ({
  wake: null, bedtime: null, sleepHours: null, bodyWeight: null,
  weed: [], extras: [], food: { protein: false, junk: false, late: false, note: '' },
  recovery: { sauna: false, plunge: false },
  amDone: false, pmDone: false, sparringNotes: null, ...patch,
});

describe('no-zero-day', () => {
  it('counts any completed slot or extra', () => {
    expect(isNonZeroDay(day())).toBe(false);
    expect(isNonZeroDay(day({ amDone: true }))).toBe(true);
    expect(isNonZeroDay(day({ pmDone: true }))).toBe(true);
    expect(isNonZeroDay(day({ extras: [{ type: 'Cardio', time: '07:00' }] }))).toBe(true);
    expect(isNonZeroDay(undefined)).toBe(false);
  });
});

describe('streak', () => {
  it('counts consecutive non-zero days ending today', () => {
    const doc = emptyDoc();
    doc.days['2026-08-16'] = day({ amDone: true });
    doc.days['2026-08-17'] = day({ pmDone: true });
    doc.days['2026-08-18'] = day({ amDone: true });
    expect(currentStreak(doc, '2026-08-18')).toBe(3);
  });
  it('an unfinished today does not break the streak', () => {
    const doc = emptyDoc();
    doc.days['2026-08-17'] = day({ pmDone: true });
    doc.days['2026-08-18'] = day(); // today, nothing yet
    expect(currentStreak(doc, '2026-08-18')).toBe(1);
  });
  it('a zero day resets the chain', () => {
    const doc = emptyDoc();
    doc.days['2026-08-15'] = day({ amDone: true });
    doc.days['2026-08-16'] = day(); // zero
    doc.days['2026-08-17'] = day({ amDone: true });
    doc.days['2026-08-18'] = day({ amDone: true });
    expect(currentStreak(doc, '2026-08-18')).toBe(2);
  });
});

describe('week adherence', () => {
  // week 1: Mon 2026-08-17 .. Sun 2026-08-23; Mon/Tue have 2 slots each
  it('counts elapsed planned slots only; today counts once done', () => {
    const doc = emptyDoc();
    doc.days['2026-08-17'] = day({ amDone: true, pmDone: true }); // Mon: 2/2
    doc.days['2026-08-18'] = day({ amDone: true });               // Tue (today): AM done, PM pending
    const adh = weekAdherence(doc, 1, '2026-08-18');
    expect(adh).toEqual({ planned: 3, done: 3, pct: 100 });
  });
  it('missed past slots hurt the percentage', () => {
    const doc = emptyDoc();
    doc.days['2026-08-17'] = day({ amDone: true }); // Mon PM lift missed
    const adh = weekAdherence(doc, 1, '2026-08-18');
    expect(adh).toEqual({ planned: 2, done: 1, pct: 50 });
  });
  it('future week has nothing elapsed', () => {
    const adh = weekAdherence(emptyDoc(), 2, '2026-08-18');
    expect(adh.planned).toBe(0);
    expect(adh.pct).toBeNull();
  });
});
