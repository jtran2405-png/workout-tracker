// Program rules engine — pure functions, unit tested. No DOM, no storage.

export const DEFAULT_SETTINGS = {
  startDate: '2026-08-14',   // day-one baseline session (Friday)
  week1Monday: '2026-08-17', // program weeks are Monday-anchored
  phaseOverride: null,       // null | 'ramp' | 'build'
  unit: 'kg',
  walkAround: 58,            // lean walk-around target ≈128 lb (realistic range 127–130)
  goalWeight: 55.5,          // fight weight ≈122 lb (range 121–123); water cut covers lower when needed
};

export function kgLb(kg) {
  return `${kg} kg / ${Math.round(kg * 2.2046)} lb`;
}

export const WEIGHT_INCREMENT = 2.5;

// ---------- date helpers (local time, 'YYYY-MM-DD' strings) ----------

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayStr() {
  return fmtDate(new Date());
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function weekdayOf(dateStr) {
  return parseDate(dateStr).getDay(); // 0=Sun..6=Sat
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- phase logic ----------

// Week 0 = anything before week1Monday (baseline/onboarding window).
// Week 1 starts on week1Monday; each week is Mon..Sun.
export function weekNumber(dateStr, week1Monday = DEFAULT_SETTINGS.week1Monday) {
  const diff = Math.round((parseDate(dateStr) - parseDate(week1Monday)) / 86400000);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

export function mondayOfWeek(week, week1Monday = DEFAULT_SETTINGS.week1Monday) {
  return addDays(week1Monday, (week - 1) * 7);
}

// 'baseline' | 'ramp' (weeks 1–4) | 'build' (week 5+)
export function phaseFor(week, override = null) {
  if (override === 'ramp' || override === 'build') return override;
  if (week < 1) return 'baseline';
  return week <= 4 ? 'ramp' : 'build';
}

export const PHASE_INFO = {
  baseline: { label: 'Baseline', cue: 'Onboarding — light weights, learn the movements, log your numbers.' },
  ramp:     { label: 'Ramp',     cue: 'Stay 3–4 reps short of failure. Weights on the light side — tendons before muscle.' },
  build:    { label: 'Build',    cue: 'Last set close to failure. Main lifts move to heavier 4–6 rep work.' },
};

// Sunday sparring: technical only weeks 1–4, live from week 5.
export function sparringMode(week) {
  return week >= 5 ? 'live' : 'technical';
}

// ---------- lifting templates ----------

export const LIFTS = {
  LOWER: {
    title: 'Lower · power',
    exercises: [
      { name: 'WARMUP: 5–10 min easy cardio (bike/treadmill)', low: 1, high: 1, sets: 1, note: 'easy pace, get heart rate up' },
      { name: 'WARMUP: Leg swings & hip circles', low: 1, high: 1, sets: 1, note: '10 each direction per leg' },
      { name: 'WARMUP: Air squats', low: 10, high: 10, sets: 1, note: 'bodyweight, full range' },
      { name: 'Box jump', low: 3, high: 3, sets: 3, note: 'low box, stick the landing, full rest' },
      { name: 'Back squat', low: 6, high: 8, main: true },
      { name: 'Romanian deadlift', low: 8, high: 8 },
      { name: 'Bulgarian split squat', low: 8, high: 8, note: 'per leg — balance under load' },
      { name: 'Standing calf raise', low: 12, high: 12, sets: 4 },
      { name: 'Landmine rotation', low: 10, high: 10, note: 'per side, controlled' },
    ],
  },
  UPPER_A: {
    title: 'Upper push/pull',
    exercises: [
      { name: 'WARMUP: 5–10 min easy cardio (bike/rower)', low: 1, high: 1, sets: 1, note: 'easy pace' },
      { name: 'WARMUP: Arm circles & band pull-aparts', low: 1, high: 1, sets: 1, note: '15 pull-aparts each direction' },
      { name: 'WARMUP: Light rows', low: 8, high: 8, sets: 1, note: 'half load, groove the pattern' },
      { name: 'Med-ball chest pass', low: 5, high: 5, sets: 3, note: 'explosive intent, full rest' },
      { name: 'Bench press', low: 6, high: 8, main: true, note: 'flat DB bench if no machine/bar free' },
      { name: 'Lat pulldown', low: 8, high: 10, note: 'or assisted pull-up' },
      { name: 'Seated cable row', low: 10, high: 10 },
      { name: 'Landmine punch press', low: 6, high: 6, note: 'per side, fight stance' },
      { name: 'Neck work', low: 15, high: 15 },
    ],
  },
  POSTERIOR: {
    title: 'Posterior · power',
    exercises: [
      { name: 'WARMUP: 5–10 min easy cardio (bike/treadmill)', low: 1, high: 1, sets: 1, note: 'easy pace' },
      { name: 'WARMUP: Cat-cow stretch', low: 1, high: 1, sets: 1, note: '10 reps, mobilize spine' },
      { name: 'WARMUP: Light hip thrusts', low: 10, high: 10, sets: 1, note: 'bodyweight or light, groove hips' },
      { name: 'Med-ball rotational slam', low: 5, high: 5, sets: 3, note: 'per side — throw violently, full rest' },
      { name: 'Deadlift', low: 5, high: 5, main: true, note: 'trap bar or conventional' },
      { name: 'Hip thrust', low: 10, high: 10 },
      { name: 'Chest-supported row', low: 12, high: 12 },
      { name: "Farmer's carry", low: 3, high: 3, unitLabel: 'trips' },
    ],
  },
  ATHLETIC: {
    title: 'Athletic upper (power)',
    adhoc: true, // Saturday-freestyle material; anchors conditioning day from week 5
    exercises: [
      { name: 'Med-ball chest pass', low: 5, high: 5, sets: 3, note: 'explosive intent, full rest' },
      { name: 'Landmine punch press', low: 6, high: 6, main: true, note: 'per side, fight stance' },
      { name: 'Sled push', low: 1, high: 1, sets: 6, unitLabel: 'trips', note: '20 m, fast, walk-back rest' },
      { name: 'Med-ball rotational slam', low: 8, high: 8, note: 'per side' },
      { name: 'Chin-up', low: 6, high: 8 },
    ],
  },
  CONDITIONING: {
    title: 'Hard conditioning block (fighter prep)',
    adhoc: true,
    exercises: [
      { name: 'WARMUP: 5–10 min easy cardio + dynamic mobility', low: 1, high: 1, sets: 1, note: 'bike/treadmill, arm circles, leg swings' },
      { name: 'Landmine rotational punch throws', low: 5, high: 5, sets: 4, note: 'per side, full rest, max intent' },
      { name: 'Med-ball floor slams', low: 6, high: 6, sets: 4, note: 'overhead to floor, full violence' },
      { name: 'Med-ball rotational scoop toss', low: 5, high: 5, sets: 3, note: 'per side, throw sideways, chase it' },
      { name: 'Jump squats', low: 5, high: 5, sets: 4, note: 'light DBs at sides ok, land soft' },
      { name: 'KB swings, heavy', low: 8, high: 8, sets: 4, note: 'hip snap like a teep' },
      { name: 'Broad jumps', low: 4, high: 4, sets: 3, note: 'stick the landing (or skip if no space)' },
      { name: 'Engine circuit (2–3 × 3 min)', low: 1, high: 1, sets: 1, unitLabel: 'rounds', note: '30s slams → 30s swings → 30s jump lunges → 30s sprawls → 60s shadowbox, 1 min rest' },
    ],
  },
  UPPER_B: {
    title: 'Upper + arms (aesthetics)',
    exercises: [
      { name: 'Incline DB press', low: 6, high: 8, main: true },
      { name: 'Chin-up', low: 8, high: 10 },
      { name: 'Single-arm DB row', low: 10, high: 10 },
      { name: 'DB shoulder press', low: 10, high: 10 },
      { name: 'Cable lateral raise', low: 15, high: 15 },
      { name: 'EZ-bar curl', low: 12, high: 12 },
      { name: 'Rope triceps pushdown', low: 12, high: 12 },
    ],
  },
  CHEST: {
    title: 'Chest day',
    adhoc: true, // startable from any day's Train view, not part of the weekly split
    exercises: [
      { name: 'Flat bench press', low: 6, high: 8, main: true, note: 'barbell or DB' },
      { name: 'Incline DB press', low: 8, high: 10 },
      { name: 'Cable fly', low: 12, high: 15, note: 'or pec deck' },
      { name: 'Rope triceps pushdown', low: 10, high: 12 },
      { name: 'Push-ups', low: 8, high: 15, note: 'finisher — weight 0 is fine' },
    ],
  },
  BACK_DAY: {
    title: 'Back day',
    adhoc: true,
    exercises: [
      { name: 'Lat pulldown', low: 8, high: 10, main: true, note: 'or assisted pull-up' },
      { name: 'Seated cable row', low: 10, high: 12 },
      { name: 'Chest-supported row', low: 10, high: 12 },
      { name: 'Straight-arm pulldown', low: 12, high: 15 },
      { name: 'Barbell/cable curl', low: 10, high: 12 },
    ],
  },
  SHOULDER_DAY: {
    title: 'Shoulder day',
    adhoc: true,
    exercises: [
      { name: 'DB shoulder press', low: 8, high: 10, main: true },
      { name: 'Cable lateral raise', low: 12, high: 15 },
      { name: 'Rear delt fly', low: 12, high: 15, note: 'cable or pec-deck reverse' },
      { name: 'DB shrug', low: 10, high: 12 },
      { name: 'Neck work', low: 12, high: 15 },
    ],
  },
  ARM_DAY: {
    title: 'Arm day',
    adhoc: true,
    exercises: [
      { name: 'EZ-bar curl', low: 8, high: 12, main: true },
      { name: 'Rope triceps pushdown', low: 10, high: 12 },
      { name: 'Incline DB curl', low: 10, high: 12 },
      { name: 'Overhead rope extension', low: 10, high: 12 },
      { name: 'Hammer curl', low: 10, high: 12 },
    ],
  },
  FULL_BODY: {
    title: 'Full-body (quick)',
    adhoc: true,
    exercises: [
      { name: 'Goblet squat', low: 10, high: 12 },
      { name: 'Flat bench press', low: 8, high: 10, note: 'barbell or DB' },
      { name: 'Lat pulldown', low: 8, high: 10 },
      { name: 'DB shoulder press', low: 8, high: 10 },
      { name: "Farmer's carry", low: 1, high: 1, note: 'log trips as reps, weight per hand' },
    ],
  },
  BASELINE: {
    title: 'Onboarding full-body',
    exercises: [
      { name: 'Goblet squat', low: 12, high: 12, sets: 2 },
      { name: 'Flat DB bench press', low: 12, high: 12, sets: 2 },
      { name: 'Lat pulldown', low: 12, high: 12, sets: 2 },
      { name: 'Seated DB shoulder press', low: 10, high: 10, sets: 2 },
      { name: "Farmer's carry", low: 2, high: 2, sets: 2, unitLabel: 'trips' },
    ],
  },
};

// Weekly template keyed by weekday (0=Sun..6=Sat).
// Fighter-first program: 3 lifts/wk (Mon/Tue/Thu) + hard conditioning (Fri) + sparring (Sat/Sun).
// Lifts run in the AM (Justin's preference); conditioning/cardio in PM when needed.
// HCMC heat rule: early morning for outdoor cardio; evening Z2 ok.
export const WEEK_TEMPLATE = {
  1: { am: { type: 'lift', lift: 'LOWER', after: 'sauna' },      pm: { type: 'cardio', label: '25 min easy Z2 + mobility (evening ok)' } },
  2: { am: { type: 'lift', lift: 'UPPER_A', after: 'sauna' },    pm: { type: 'cardio', label: '25 min easy Z2 or light bag work' } },
  3: { am: { type: 'cardio', label: 'Incline walk 30 min · 10–12% · easy' }, pm: { type: 'recovery', label: 'Recovery program' } },
  4: { am: { type: 'lift', lift: 'POSTERIOR', after: 'sauna' },  pm: { type: 'cardio', label: '25 min easy Z2' } },
  5: { am: { type: 'lift', lift: 'CONDITIONING' },                pm: null },
  6: { am: { type: 'freestyle', label: 'Freestyle — spar / lift / Zone 2' }, pm: { type: 'recovery', label: 'Cold plunge (skip if you lifted)' } },
  0: { am: null,                                                 pm: { type: 'sparring', label: 'Sparring' } },
};

// Fighter-base-building program (Sep 2026 onward):
// Reduced lifts (3/wk) with explosive primers → hard conditioning Fri → sparring Sat/Sun.
// UPPER_B (aesthetics) retired in favor of conditioning-first architecture.
// Sleep + weed discipline are load-bearing: minimum 7 hrs/night, no sessions after 6pm.
export function slotsFor(dateStr) {
  return WEEK_TEMPLATE[weekdayOf(dateStr)];
}

// ---------- day rules ----------

export function isLiftingDay(dateStr) {
  const t = slotsFor(dateStr);
  return t.am?.type === 'lift' || t.pm?.type === 'lift';
}

// Wednesday is a hard no-lift day; weekends have no lift slot either.
export function canLift(dateStr) {
  return isLiftingDay(dateStr);
}

// Cold plunge blunts adaptation within ~4h of lifting → warn on lifting days.
// Plunge is fine Wed and after Sat sparring.
// `day`/`doc` are optional: when given, ad-hoc lifts (XT sessions, extras
// of type Lift) trigger the warning too — e.g. a freestyle-Saturday chest day.
export function plungeWarning(dateStr, day = null, doc = null) {
  const liftedAdhoc = !!(doc?.sessions?.[`${dateStr}:XT`])
    || (day?.extras || []).some((x) => x.type === 'Lift');
  if (!isLiftingDay(dateStr) && !liftedAdhoc) return null;
  return 'You lifted today — a cold plunge within ~4 hours of lifting blunts muscle adaptation. Sauna is fine; plunge on non-lifting days.';
}

// Wednesday PM checklist. Items with store:'recovery' read/write the same
// day.recovery flags as the Health tab chips; the rest live in day.recoveryChecks.
export const RECOVERY_PROGRAM = [
  { key: 'sauna', store: 'recovery', name: 'Sauna', target: '15–20 min' },
  { key: 'plunge', store: 'recovery', name: 'Cold plunge', target: '2–4 min — allowed today' },
  { key: 'bands', name: 'Band shoulder work', target: 'pass-throughs + pull-aparts 2×15' },
  { key: 'hips', name: 'Hip flexor + couch stretch', target: '2 min per side' },
  { key: 'hams', name: 'Hamstring + calf stretch', target: '2 min per side' },
  { key: 'roll', name: 'Foam roll', target: 'quads · back · IT band, 5 min' },
  { key: 'neck', name: 'Neck + wrist mobility', target: '2–3 min' },
];

// "6:41/km" from distance + duration; null when either is missing
export function runPace(km, minutes) {
  if (!km || !minutes) return null;
  const s = Math.round((minutes * 60) / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`;
}

// ---------- sets / reps by phase ----------

export function setsFor(exercise, phase) {
  if (exercise.sets) return exercise.sets; // explicit override (calf raise 4, baseline 2)
  return phase === 'build' ? 4 : 3;
}

export function repRange(exercise, phase) {
  if (phase === 'build' && exercise.main) return { low: 4, high: 6 };
  return { low: exercise.low, high: exercise.high };
}

export function repTargetLabel(exercise, phase) {
  const { low, high } = repRange(exercise, phase);
  const range = low === high ? `${low}` : `${low}–${high}`;
  return `${setsFor(exercise, phase)}×${range}${exercise.unitLabel ? ' ' + exercise.unitLabel : ''}`;
}

// ---------- progression ----------

// +2.5 kg when the previous session completed all planned sets at the top of
// the rep range; otherwise repeat the previous weight. null = no history.
export function suggestNextWeight(prevSets, plannedSets, targetHigh) {
  if (!prevSets || prevSets.length === 0) return null;
  const done = prevSets.filter((s) => s.done && s.weight != null);
  if (done.length === 0) return null;
  const weight = Math.max(...done.map((s) => Number(s.weight)));
  const allAtTop = done.length >= plannedSets && done.every((s) => Number(s.reps) >= targetHigh);
  return allAtTop ? weight + WEIGHT_INCREMENT : weight;
}
