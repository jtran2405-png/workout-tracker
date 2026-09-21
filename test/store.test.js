import { describe, it, expect } from 'vitest';
import { emptyDoc, getDay } from '../src/store.js';

describe('day record shape', () => {
  it('new days start with every done-flag false', () => {
    const d = getDay(emptyDoc(), '2026-09-20');
    expect(d.amDone).toBe(false);
    expect(d.pmDone).toBe(false);
    expect(d.runDone).toBe(false);
  });

  it('backfills runDone on day records saved before the daily run existed', () => {
    // Justin's live localStorage has weeks of days written before e7c196c —
    // they must not read as `undefined` in adherence or the done-toggle.
    const doc = emptyDoc();
    doc.days['2026-08-17'] = {
      wake: '06:20', bedtime: '22:30', sleepHours: 7.5, bodyWeight: 79.2,
      weed: [], extras: [], food: { protein: true, junk: false, late: false, note: '' },
      recovery: { sauna: true, plunge: false },
      amDone: true, pmDone: true, sparringNotes: null,
    };
    const d = getDay(doc, '2026-08-17');
    expect(d.runDone).toBe(false);
    expect(d.amDone).toBe(true); // backfill must not clobber existing data
  });
});
