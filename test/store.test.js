import { describe, it, expect } from 'vitest';
import { emptyDoc, getDay, migrate } from '../src/store.js';
import { totalKg } from '../src/program.js';

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

describe('settings migration', () => {
  it('backfills bar weights into a document saved before they existed', () => {
    // Justin's phone holds a doc whose settings predate the `bars` key; the
    // shallow settings merge has to supply it or barKg falls back silently
    const old = { version: 1, settings: { startDate: '2026-08-14', week1Monday: '2026-08-17', walkAround: 58 }, days: {}, sessions: {}, flags: {} };
    const doc = migrate(old);
    expect(doc.settings.bars).toEqual({ olympic: 20, ez: 7.5 });
    expect(doc.settings.walkAround).toBe(58); // his own values survive
    expect(totalKg(45, 'Bench press', doc.settings)).toBe(65);
  });
  it('keeps a bar weight the user has already customised', () => {
    const doc = migrate({ settings: { bars: { olympic: 15, ez: 7.5 } } });
    expect(totalKg(45, 'Bench press', doc.settings)).toBe(60);
  });
});
