# Workout Tracker

Mobile-first PWA for daily training + lifestyle tracking. Dark, minimal, one-handed at the gym. No accounts, no backend — everything lives in the phone's localStorage.

Built around a specific program — fighter-first, aerobic base before volume:

- **Every day:** 3–5k Zone 2 easy run (its own `RUN` slot, counts toward adherence).
- **Mon / Tue / Thu:** AM lift (Lower · power, Upper push/pull, Posterior · power), sauna after. Each carries a PM slot — mobility Mon/Thu, light bag work Tue.
- **Wed:** hard no-lift day — incline walk AM, recovery checklist PM.
- **Fri:** hard conditioning block, AM only.
- **Sat / Sun:** freestyle + cold plunge, then Muay Thai sparring — technical weeks 1–4, live from week 5.

Ramp phase weeks 1–4 (3 sets, RIR 3–4) → Build phase week 5+ (4 sets, main lifts 4–6 reps). Week 1 = Mon 2026-08-17. The split lives in `WEEK_TEMPLATE` / `DAILY_BASE` in `src/program.js`; adherence is recomputed from the template rather than stored, so editing it re-scores past weeks.

**Logged lift weights are plates only.** The bar is added by the app (`totalKg` in `src/program.js`), so there is no arithmetic to do mid-set — enter what you put on the bar. Bar weights are set in Data → Bar weights (straight 20 kg, EZ 7.5 kg by default) since gyms vary. Landmine, cable, machine, dumbbell and kettlebell work gets nothing added; a landmine is anchored at one end, so "plates + bar" would be a fiction. Everything downstream — coach report, `sets.csv`'s `total_kg`, the progression chart — reports the real weight moved.

## Tabs

- **Health** — the habit ledger: sleep / body weight / weed log, food flags, the four non-negotiable dailies, sauna/plunge check-offs (with the plunge-on-lifting-day warning). Fell-asleep + woke-up auto-fill sleep hours; typing in the box overrides until the next picker change. A day record holds **the night that ended on that date** — log it on the morning you wake up, since the Train tab gates that day's lift on it.
- **Train** — the day's plan: AM + PM slots plus the daily RUN, set-by-set lift logging (tap ✓ with empty fields to auto-fill the suggested weight × target reps), an off-plan lift picker, extras, sparring notes. Strict mode: a lift's ✓ is only accepted once every planned set is logged.
- **Week** (`#/train/week`) — 7-day status grid + the full suggested split, phase-adjusted.
- **Progress** — stat tiles, per-exercise weight charts with the +2.5 kg suggestion (bump only when all planned sets hit the top of the rep range), body-weight and sleep trends.
- **Data** — program settings, CSV exports (`sets.csv`, `days.csv`), full JSON backup/restore, baseline editor.

## Develop

```
npm install
npm run dev      # local dev server
npm test         # rules-engine + CSV unit tests
npm run build    # production build → dist/
```

## Deploy (GitHub Pages)

Any static host works — the build is fully self-contained (`base: './'`). For GitHub Pages: push, enable Pages, serve `dist/` via an Actions workflow. Install to the phone from Safari → Share → Add to Home Screen.

> ⚠️ Data lives in localStorage on the device. iOS can evict it from rarely-used web apps — the Data tab nudges a JSON backup every 14 days. Back up before deleting/reinstalling the app.
