import { describe, it, expect } from 'vitest';
import { shiftSleep } from '../scripts/shift-sleep.mjs';
import { sleepHoursOf } from '../src/program.js';

const day = (patch = {}) => ({
  wake: null, bedtime: null, sleepHours: null, bodyWeight: null,
  weed: [], extras: [], food: { protein: false, junk: false, late: false, note: '' },
  recovery: { sauna: false, plunge: false },
  amDone: false, pmDone: false, runDone: false, sparringNotes: null, ...patch,
});

const docOf = (days) => ({ version: 1, settings: {}, days, sessions: {}, flags: {} });

describe('shifting mis-dated sleep forward a day', () => {
  it('moves a run of nights forward without eating each other', () => {
    // the failure mode to avoid: moving oldest-first makes every night collide
    // with the one in front of it, so nothing shifts at all
    const doc = docOf({
      '2026-09-14': day({ bedtime: '23:00', wake: '06:30', sleepHours: 7.5 }),
      '2026-09-15': day({ bedtime: '23:30', wake: '07:00', sleepHours: 7.5 }),
      '2026-09-16': day({ bedtime: '22:45', wake: '06:15', sleepHours: 7.5 }),
    });
    const { doc: out, moves, collisions } = shiftSleep(doc);

    expect(collisions).toEqual([]);
    expect(moves).toHaveLength(3);
    expect(out.days['2026-09-14'].bedtime).toBe(null); // vacated
    expect(out.days['2026-09-15'].bedtime).toBe('23:00');
    expect(out.days['2026-09-16'].bedtime).toBe('23:30');
    expect(out.days['2026-09-17'].bedtime).toBe('22:45'); // day created
    expect(out.days['2026-09-17'].wake).toBe('06:15');
  });

  it('only sleep moves — everything else stays on its own day', () => {
    const doc = docOf({
      '2026-09-14': day({
        bedtime: '23:00', wake: '06:30', sleepHours: 7.5,
        bodyWeight: 61.2, amDone: true, runDone: true,
        food: { protein: true, junk: false, late: false, note: 'pho' },
        weed: [{ time: '21:00', note: '' }],
      }),
    });
    const { doc: out } = shiftSleep(doc);

    const src = out.days['2026-09-14'];
    expect(src.bodyWeight).toBe(61.2); // weigh-in was on the right day already
    expect(src.amDone).toBe(true);
    expect(src.runDone).toBe(true);
    expect(src.food.note).toBe('pho');
    expect(src.weed).toHaveLength(1);
    expect(sleepHoursOf(src)).toBe(null); // sleep gone from the source

    const dest = out.days['2026-09-15'];
    expect(sleepHoursOf(dest)).toBe(7.5);
    expect(dest.bodyWeight).toBe(null); // nothing else came along
    expect(dest.amDone).toBe(false);
  });

  it('cascades a consecutive run rather than stalling on the next night', () => {
    // consecutive days both hold a mis-dated night, so BOTH have to move; the
    // newest moving first is what frees each target in turn
    const doc = docOf({
      '2026-09-14': day({ bedtime: '23:00', wake: '06:30', sleepHours: 7.5 }),
      '2026-09-15': day({ bedtime: '22:00', wake: '05:00', sleepHours: 7 }),
      '2026-09-16': day({ bodyWeight: 61 }),
    });
    const { doc: out, moves, collisions } = shiftSleep(doc);

    expect(collisions).toEqual([]);
    expect(moves.map((m) => m.from)).toEqual(['2026-09-14', '2026-09-15']);
    expect(out.days['2026-09-15'].bedtime).toBe('23:00'); // 14th's night
    expect(out.days['2026-09-16'].bedtime).toBe('22:00'); // 15th's night
    expect(out.days['2026-09-16'].bodyWeight).toBe(61);   // its own data survived
    expect(out.days['2026-09-14'].bedtime).toBe(null);
  });

  it('refuses to overwrite a night it is not allowed to move out of the way', () => {
    // the real collision: at the --through boundary, the night on the target
    // day is out of scope, so two nights claim one morning and only he can say
    // which is which
    const doc = docOf({
      '2026-09-14': day({ bedtime: '23:00', wake: '06:30', sleepHours: 7.5 }),
      '2026-09-15': day({ bedtime: '22:00', wake: '05:00', sleepHours: 7 }),
    });
    const { doc: out, moves, collisions } = shiftSleep(doc, { through: '2026-09-14' });

    expect(moves).toEqual([]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({ from: '2026-09-14', to: '2026-09-15' });
    // both sides left exactly as they were — nothing is guessed
    expect(out.days['2026-09-14'].bedtime).toBe('23:00');
    expect(out.days['2026-09-15'].bedtime).toBe('22:00');
  });

  it('leaves days with no sleep alone', () => {
    const doc = docOf({
      '2026-09-14': day({ bodyWeight: 61 }),
      '2026-09-15': day({ amDone: true }),
    });
    const { doc: out, moves } = shiftSleep(doc);
    expect(moves).toEqual([]);
    expect(out.days['2026-09-16']).toBeUndefined(); // no empty day invented
    expect(out.days).toEqual(doc.days);
  });

  it('--through stops the repair at the day he fixed his habit', () => {
    const doc = docOf({
      '2026-09-20': day({ bedtime: '23:00', wake: '06:30', sleepHours: 7.5 }),
      '2026-09-22': day({ bedtime: '22:30', wake: '06:00', sleepHours: 7.5 }), // logged correctly
    });
    const { doc: out, moves } = shiftSleep(doc, { through: '2026-09-21' });
    expect(moves.map((m) => m.from)).toEqual(['2026-09-20']);
    expect(out.days['2026-09-22'].bedtime).toBe('22:30'); // untouched
  });

  it('moves a partially logged night as-is rather than dropping it', () => {
    const doc = docOf({ '2026-09-14': day({ wake: '06:30' }) }); // bedtime never entered
    const { doc: out, moves } = shiftSleep(doc);
    expect(moves).toHaveLength(1);
    expect(out.days['2026-09-15'].wake).toBe('06:30');
    expect(out.days['2026-09-15'].bedtime).toBe(null);
    expect(out.days['2026-09-14'].wake).toBe(null);
  });

  it('does not mutate the document it was given', () => {
    const doc = docOf({ '2026-09-14': day({ bedtime: '23:00', wake: '06:30', sleepHours: 7.5 }) });
    const before = structuredClone(doc);
    shiftSleep(doc);
    expect(doc).toEqual(before);
  });

  it('sessions and settings ride through untouched', () => {
    const doc = docOf({ '2026-09-14': day({ bedtime: '23:00', wake: '06:30' }) });
    doc.sessions['2026-09-14:AM'] = { date: '2026-09-14', slot: 'AM', template: 'LOWER', status: 'done', exercises: {} };
    doc.settings = { startDate: '2026-08-14', bars: { olympic: 20, ez: 7.5 } };
    const { doc: out } = shiftSleep(doc);
    expect(out.sessions['2026-09-14:AM'].template).toBe('LOWER');
    expect(out.settings.bars.olympic).toBe(20);
  });
});
