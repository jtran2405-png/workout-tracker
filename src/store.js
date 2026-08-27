// localStorage persistence — single versioned document, write-through saves.

import { DEFAULT_SETTINGS } from './program.js';

const KEY = 'wt.data.v1';

export function emptyDoc() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    days: {},      // 'YYYY-MM-DD' -> day record
    sessions: {},  // 'YYYY-MM-DD:AM'|':PM' -> session record
    flags: {},     // one-time UI flags (baselineDone, etc.)
  };
}

export function migrate(doc) {
  if (!doc || typeof doc !== 'object') return emptyDoc();
  const base = emptyDoc();
  return {
    ...base,
    ...doc,
    settings: { ...base.settings, ...(doc.settings || {}) },
    days: doc.days || {},
    sessions: doc.sessions || {},
    flags: doc.flags || {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyDoc();
  } catch {
    return emptyDoc();
  }
}

export function save(doc) {
  localStorage.setItem(KEY, JSON.stringify(doc));
}

export function clearAll() {
  localStorage.removeItem(KEY);
}

export function getDay(doc, date) {
  if (!doc.days[date]) {
    doc.days[date] = {
      wake: null, bedtime: null, sleepHours: null, bodyWeight: null,
      weed: [], extras: [], food: { protein: false, junk: false, late: false, note: '' },
      recovery: { sauna: false, plunge: false },
      amDone: false, pmDone: false, sparringNotes: null,
    };
  }
  // backfill fields added after a day record was created
  const d = doc.days[date];
  if (!d.weed) d.weed = [];
  if (!d.extras) d.extras = [];
  if (!d.food) d.food = { protein: false, junk: false, late: false, note: '' };
  if (!d.recovery) d.recovery = { sauna: false, plunge: false };
  if (!d.recoveryChecks) d.recoveryChecks = {};
  if (d.attest === undefined) d.attest = false;
  return d;
}

export function sessionKey(date, slot) {
  return `${date}:${slot}`;
}

export function getSession(doc, date, slot, template) {
  const key = sessionKey(date, slot);
  if (!doc.sessions[key]) {
    doc.sessions[key] = { date, slot, template, status: 'open', exercises: {} };
  }
  return doc.sessions[key];
}

// Latest session (before `beforeDate`) containing this exercise → its sets.
export function lastSetsFor(doc, exerciseName, beforeDate) {
  const keys = Object.keys(doc.sessions)
    .filter((k) => k.slice(0, 10) < beforeDate)
    .sort()
    .reverse();
  for (const k of keys) {
    const ex = doc.sessions[k].exercises?.[exerciseName];
    if (ex && ex.some((s) => s.done)) return ex;
  }
  return null;
}

// All (date, weight) points for an exercise, oldest first.
export function historyFor(doc, exerciseName) {
  return Object.values(doc.sessions)
    .filter((s) => s.exercises?.[exerciseName]?.some((set) => set.done && set.weight != null))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => ({
      date: s.date,
      weight: Math.max(...s.exercises[exerciseName].filter((x) => x.done && x.weight != null).map((x) => Number(x.weight))),
    }));
}
