# Workout Tracker

Mobile-first PWA for daily training + lifestyle tracking. Dark, minimal, one-handed at the gym. No accounts, no backend — everything lives in the phone's localStorage.

Built around a specific program: 3 lifting days + posterior chain, AM Zone 2 cardio, Wed hard recovery, weekend Muay Thai sparring. Ramp phase weeks 1–4 (3 sets, RIR 3–4) → Build phase week 5+ (4 sets, main lifts 4–6 reps, Sunday sparring goes live). Week 1 = Mon 2026-08-17.

## Tabs

- **Today** — wake / bedtime / sleep / body weight / weed log, AM + PM slots with set-by-set lift logging (tap ✓ with empty fields to auto-fill the suggested weight × target reps), sauna/plunge check-offs (with the plunge-on-lifting-day warning), sparring notes.
- **Week** — 7-day status grid + the full suggested split, phase-adjusted.
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
