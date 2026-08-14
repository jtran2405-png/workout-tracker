import { describe, it, expect } from 'vitest';
import { setsCsv, daysCsv, backupJson } from '../src/csv.js';
import { emptyDoc, migrate } from '../src/store.js';

function sampleDoc() {
  const doc = emptyDoc();
  doc.days['2026-08-18'] = {
    wake: '06:30', bedtime: '22:45', sleepHours: 7.5, bodyWeight: 78.4,
    weed: [{ time: '21:10', note: 'after dinner' }],
    extras: [{ time: '17:00', type: 'Muay Thai', minutes: 45, note: 'light drills' }],
    food: { protein: true, junk: false, late: true, note: 'pho for lunch' },
    recovery: { sauna: true, plunge: false },
    amDone: true, pmDone: true, sparringNotes: null,
  };
  doc.sessions['2026-08-18:PM'] = {
    date: '2026-08-18', slot: 'PM', template: 'UPPER_A', status: 'done',
    exercises: {
      'Bench press': [
        { weight: 40, reps: 8, done: true },
        { weight: 40, reps: 8, done: true },
        { weight: 40, reps: 7, done: true },
      ],
      'Lat pulldown': [{ weight: 50, reps: 10, done: true }],
    },
  };
  return doc;
}

describe('sets.csv', () => {
  it('one row per set with header', () => {
    const csv = setsCsv(sampleDoc());
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('date,slot,workout,exercise,set,weight,reps,done');
    expect(lines).toHaveLength(1 + 3 + 1);
    expect(lines[1]).toBe('2026-08-18,PM,UPPER_A,Bench press,1,40,8,1');
    expect(lines[3]).toBe('2026-08-18,PM,UPPER_A,Bench press,3,40,7,1');
  });
  it('escapes commas and quotes', () => {
    const doc = sampleDoc();
    doc.sessions['2026-08-18:PM'].exercises['Deadlift, "heavy"'] = [{ weight: 100, reps: 5, done: true }];
    const csv = setsCsv(doc);
    expect(csv).toContain('"Deadlift, ""heavy"""');
  });
});

describe('days.csv', () => {
  it('one row per day with habit fields', () => {
    const csv = daysCsv(sampleDoc());
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('date,wake,bedtime,sleep_hours,body_weight,weed_count');
    expect(lines[0]).toContain('protein_hit,junk,ate_late,food_note');
    expect(lines[0]).toContain('sparring_notes,extras');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-08-18,06:30,22:45,7.5,78.4,1,21:10,1,0,1,pho for lunch,1,0,1,1,,17:00 Muay Thai 45min (light drills)');
  });
});

describe('backup roundtrip', () => {
  it('backupJson → migrate reproduces the document', () => {
    const doc = sampleDoc();
    const restored = migrate(JSON.parse(backupJson(doc)));
    expect(restored).toEqual(doc);
  });
  it('migrate fills defaults on partial/corrupt input', () => {
    expect(migrate(null).version).toBe(1);
    expect(migrate({}).settings.week1Monday).toBe('2026-08-17');
    expect(migrate({ days: { x: {} } }).sessions).toEqual({});
  });
});
