// TRAIN face — the daily planner: programmed session + flexible extra slots.
// Reads Health data (sleep) to adjust the day's guidance.

import {
  todayStr, addDays, weekdayOf, weekNumber, phaseFor, PHASE_INFO, DAY_NAMES,
  slotsFor, LIFTS, setsFor, repRange, repTargetLabel, suggestNextWeight,
  sparringMode, parseDate, runPace, RECOVERY_PROGRAM,
} from '../program.js';
import { getDay, getSession, sessionKey, lastSetsFor } from '../store.js';
import { h, toast, nowTime } from '../ui.js';
import { weekAdherence } from '../grit.js';

function prettyDate(dateStr) {
  const d = parseDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} · ${d.getDate()}/${d.getMonth() + 1}`;
}

export function renderTrain(root, ctx) {
  const { doc } = ctx;
  const date = ctx.state.date ?? todayStr();
  const isToday = date === todayStr();
  const day = getDay(doc, date);
  const week = weekNumber(date, doc.settings.week1Monday);
  const phase = phaseFor(week, doc.settings.phaseOverride);
  const template = slotsFor(date);
  const adh = weekAdherence(doc, Math.max(0, weekNumber(todayStr(), doc.settings.week1Monday)));

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, isToday ? 'Train' : prettyDate(date)),
      h('div', { class: 'datenav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Previous day', onclick: () => { ctx.state.date = addDays(date, -1); ctx.refresh(); } }, '‹'),
        h('button', {
          class: 'iconbtn', style: 'font-size:12px;font-weight:700;padding:0 10px;min-width:64px',
          onclick: () => { ctx.state.date = null; ctx.refresh(); },
        }, isToday ? prettyDate(date).split(' · ')[1] : 'Today'),
        h('button', { class: 'iconbtn', 'aria-label': 'Next day', onclick: () => { ctx.state.date = addDays(date, 1); ctx.refresh(); } }, '›'),
      ),
    ),
    h('div', { class: 'phase-banner' },
      h('span', { class: 'pb-week' },
        week < 1 ? 'Baseline week' : `Week ${week} · ${PHASE_INFO[phase].label}`,
        adh.pct != null ? h('span', { style: 'float:right;color:var(--ink-2)' }, `${adh.pct}% wk`) : null),
      h('span', { class: 'pb-cue' }, PHASE_INFO[phase].cue),
    ),
  );

  // readiness: Train reads Health
  if (day.sleepHours != null && day.sleepHours < 6 && template.pm?.type === 'lift') {
    root.append(h('div', { class: 'warn-note', style: 'margin: -4px 2px 12px' }, '⚠︎',
      `${day.sleepHours}h sleep — show up anyway, but keep weights at last session's numbers and cut the last set if form slips.`));
  }

  // baseline week: the program hasn't started — no programmed lifting yet
  const suppress = (spec) => week < 1 && spec?.type === 'lift';
  if (template.am && !suppress(template.am)) root.append(slotCard(ctx, date, day, 'AM', template.am, week, phase));
  if (template.pm && !suppress(template.pm)) root.append(slotCard(ctx, date, day, 'PM', template.pm, week, phase));
  if (suppress(template.pm)) {
    root.append(h('div', { class: 'card' },
      h('h2', {}, 'PM'),
      h('p', { class: 'sub' }, `Program starts Monday ${doc.settings.week1Monday.slice(8)}/${doc.settings.week1Monday.slice(5, 7)}. Rest, walk, mobility.`),
    ));
  }

  root.append(adhocCard(ctx, date, day, phase));
  root.append(extrasCard(ctx, date, day));

  if (date === doc.settings.startDate) {
    const done = !!doc.sessions[sessionKey(date, 'AM')];
    root.append(h('div', { class: 'card' },
      h('h2', {}, 'Day one · onboarding'),
      h('p', { class: 'sub' }, done ? 'Baseline session logged. Edit it from the Data tab.' : 'Baseline session weights not logged yet.'),
      !done && h('div', { style: 'margin-top:10px' },
        h('button', { class: 'btn btn-primary', onclick: () => ctx.openBaseline() }, 'Enter baseline weights'),
      ),
    ));
  }

  root.append(h('a', { href: '#/train/week', class: 'btn btn-ghost week-link' }, 'View full week & split →'));
}

// ---------- slots ----------

function slotCard(ctx, date, day, slot, spec, week, phase) {
  const doneKey = slot === 'AM' ? 'amDone' : 'pmDone';
  const toggle = h('button', {
    class: `done-toggle${day[doneKey] ? ' on' : ''}`,
    onclick: () => {
      // strict mode: a lift tick must be earned — every planned set logged
      if (!day[doneKey] && spec.type === 'lift') {
        const sess = ctx.doc.sessions[sessionKey(date, slot)];
        const complete = !!sess && LIFTS[spec.lift].exercises.every((ex) => {
          const arr = sess.exercises?.[ex.name] || [];
          return arr.filter((s) => s.done).length >= setsFor(ex, phase);
        });
        if (!complete) {
          toast('Strict mode: log every set first — the tick is earned.', 'warn');
          return;
        }
      }
      day[doneKey] = !day[doneKey];
      ctx.save();
      ctx.refresh();
    },
  }, day[doneKey] ? '✓ Done' : 'Done?');

  const card = h('div', { class: 'card' },
    h('div', { class: 'slot-head' },
      h('div', {},
        h('div', { class: 'slot-tag' }, slot),
        h('div', { class: 'slot-label' }, spec.type === 'lift' ? `${LIFTS[spec.lift].title} — lift` : spec.label),
      ),
      toggle,
    ),
  );

  if (spec.type === 'lift') {
    card.append(liftBody(ctx, date, day, spec.lift, phase, slot));
    card.append(h('p', { class: 'sub', style: 'margin-top:12px' }, '→ sauna after (always fine post-lift)'));
  } else if (spec.type === 'recovery' && weekdayOf(date) === 3) {
    card.append(
      h('p', { class: 'sub', style: 'margin-bottom:10px' }, 'Hard no-lift day. Tick them off — recovery is training too.'),
      recoveryChecklist(ctx, day),
    );
  } else if (spec.type === 'freestyle') {
    card.append(
      h('p', { class: 'sub', style: 'margin-bottom:8px' },
        'How you feel today: sparring, an ad-hoc lift (card below), or easy Zone 2. Something counts — nothing is a zero.'),
      h('textarea', {
        class: 'notes', placeholder: 'What did you do? Notes…',
        onchange: (e) => { day.sparringNotes = e.target.value || null; ctx.save(); },
      }, day.sparringNotes || ''),
    );
  } else if (spec.type === 'sparring') {
    const mode = sparringMode(week);
    if (weekdayOf(date) === 0) {
      card.append(h('div', { style: 'margin-bottom:8px' },
        h('span', { class: `chip ${mode === 'live' ? 'chip-warn' : 'chip-accent'}` }, mode === 'live' ? 'LIVE sparring' : 'Technical only')));
    }
    card.append(
      h('textarea', {
        class: 'notes', placeholder: 'Sparring notes — what worked, what got exploited…',
        onchange: (e) => { day.sparringNotes = e.target.value || null; ctx.save(); },
      }, day.sparringNotes || ''),
    );
  }
  return card;
}

// ---------- ad-hoc lift sessions (off-template days: chest with a buddy, etc.) ----------

function adhocCard(ctx, date, day, phase) {
  const { doc } = ctx;
  const existing = doc.sessions[sessionKey(date, 'XT')];

  if (existing) {
    const tpl = LIFTS[existing.template];
    return h('div', { class: 'card' },
      h('div', { class: 'slot-head' },
        h('div', {},
          h('div', { class: 'slot-tag' }, 'Ad-hoc'),
          h('div', { class: 'slot-label' }, `${tpl.title} — lift`),
        ),
      ),
      liftBody(ctx, date, day, existing.template, phase, 'XT'),
      h('p', { class: 'sub', style: 'margin-top:12px' }, 'Counts as a logged extra — it won’t touch the programmed split.'),
    );
  }

  const adhocKeys = Object.keys(LIFTS).filter((k) => LIFTS[k].adhoc);
  return h('div', { class: 'card' },
    h('h2', {}, 'Off-plan lift?'),
    ...adhocKeys.map((k) => h('button', {
      class: 'btn btn-ghost', style: 'width:100%',
      onclick: () => { getSession(doc, date, 'XT', k); ctx.save(); ctx.refresh(); },
    }, `+ Start ${LIFTS[k].title.toLowerCase()}`)),
  );
}

// ---------- wednesday recovery checklist ----------

function recoveryChecklist(ctx, day) {
  const isOn = (item) => (item.store === 'recovery' ? !!day.recovery[item.key] : !!day.recoveryChecks[item.key]);
  const setOn = (item, v) => {
    if (item.store === 'recovery') day.recovery[item.key] = v;
    else day.recoveryChecks[item.key] = v;
  };
  const wrap = h('div', { class: 'rec-list' });
  const render = () => {
    wrap.innerHTML = '';
    for (const item of RECOVERY_PROGRAM) {
      const on = isOn(item);
      wrap.append(h('button', {
        class: `rec-item${on ? ' on' : ''}`,
        onclick: () => {
          setOn(item, !on);
          ctx.save();
          if (RECOVERY_PROGRAM.every(isOn) && !day.pmDone) {
            day.pmDone = true;
            ctx.save();
            toast('Recovery day complete 🧘 Tissue rebuilt.', 'good');
            ctx.refresh();
            return;
          }
          render();
        },
      },
        h('span', { class: 'rec-check' }, on ? '✓' : ''),
        h('span', { class: 'rec-name' }, item.name),
        h('span', { class: 'rec-target' }, item.target),
      ));
    }
  };
  render();
  return wrap;
}

// ---------- lift logging ----------

function liftBody(ctx, date, day, liftKey, phase, slot = 'PM') {
  const { doc } = ctx;
  const tpl = LIFTS[liftKey];
  const body = h('div', {});
  const existing = doc.sessions[sessionKey(date, slot)];

  for (const ex of tpl.exercises) {
    const planned = setsFor(ex, phase);
    const { high } = repRange(ex, phase);
    const prev = lastSetsFor(doc, ex.name, date);
    const suggest = suggestNextWeight(prev, planned, high);
    const sets = existing?.exercises?.[ex.name] || [];

    const exEl = h('div', { class: 'exercise' },
      h('div', { class: 'ex-head' },
        h('span', { class: 'ex-name' }, ex.name),
        h('span', { class: 'ex-target' },
          repTargetLabel(ex, phase),
          suggest != null ? h('span', { class: 'ex-suggest' }, `  → ${fmtW(suggest)} kg`) : null,
        ),
        ex.note ? h('span', { class: 'ex-note' }, ex.note) : null,
      ),
    );

    for (let i = 0; i < Math.max(planned, sets.length); i++) {
      const cur = sets[i] || {};
      const wIn = h('input', {
        type: 'number', inputmode: 'decimal', step: '2.5', min: '0',
        placeholder: suggest != null ? fmtW(suggest) : 'kg', value: cur.weight ?? '',
      });
      const rIn = h('input', {
        type: 'number', inputmode: 'numeric', step: '1', min: '0',
        placeholder: String(high), value: cur.reps ?? '',
      });
      const dBtn = h('button', { class: `set-done${cur.done ? ' on' : ''}`, 'aria-label': `Set ${i + 1} done` }, '✓');

      const writeSet = (patch) => {
        const sess = getSession(doc, date, slot, liftKey);
        if (!sess.exercises[ex.name]) sess.exercises[ex.name] = [];
        const arr = sess.exercises[ex.name];
        while (arr.length <= i) arr.push({ weight: null, reps: null, done: false });
        Object.assign(arr[i], patch);
        ctx.save();
        return arr[i];
      };

      wIn.addEventListener('change', () => writeSet({ weight: wIn.value === '' ? null : Number(wIn.value) }));
      rIn.addEventListener('change', () => writeSet({ reps: rIn.value === '' ? null : Number(rIn.value) }));
      dBtn.addEventListener('click', () => {
        // one-tap logging: adopt placeholder values when fields are empty
        if (wIn.value === '' && suggest != null) wIn.value = String(suggest);
        if (rIn.value === '') rIn.value = String(high);
        const set = writeSet({
          weight: wIn.value === '' ? null : Number(wIn.value),
          reps: rIn.value === '' ? null : Number(rIn.value),
          done: !dBtn.classList.contains('on'),
        });
        dBtn.classList.toggle('on', set.done);
        checkSessionDone();
      });

      exEl.append(h('div', { class: 'set-row' }, h('span', { class: 'set-n' }, String(i + 1)), wIn, rIn, dBtn));
    }
    body.append(exEl);
  }

  function checkSessionDone() {
    const sess = ctx.doc.sessions[sessionKey(date, slot)];
    if (!sess) return;
    const allDone = tpl.exercises.every((ex) => {
      const planned = setsFor(ex, phase);
      const arr = sess.exercises[ex.name] || [];
      return arr.filter((s) => s.done).length >= planned;
    });
    if (!allDone || sess.status === 'done') return;
    sess.status = 'done';
    if (slot === 'AM' || slot === 'PM') {
      day[slot === 'AM' ? 'amDone' : 'pmDone'] = true;
      toast('Session complete 💪 Sauna time.', 'good');
    } else {
      // ad-hoc lift: record it as an extra so streak/week view see it
      if (!day.extras.some((x) => x.note === tpl.title)) {
        day.extras.push({ time: nowTime(), type: 'Lift', minutes: null, note: tpl.title });
      }
      toast(`${tpl.title} done 💪 Logged as an extra.`, 'good');
    }
    ctx.save();
    ctx.refresh();
  }

  return body;
}

function fmtW(w) {
  return String(Number(w.toFixed(1))).replace(/\.0$/, '');
}

// ---------- extra sessions (unscheduled: light Muay Thai, a swim, a walk…) ----------

const EXTRA_TYPES = ['Run', 'Muay Thai', 'Cardio', 'Core', 'Plyo', 'Mobility', 'Swim', 'Lift', 'Other'];

function extrasCard(ctx, date, day) {
  const list = h('div', {});
  const render = () => {
    list.innerHTML = '';
    (day.extras || []).forEach((x, i) => {
      const sel = h('select', { class: 'inline-select', onchange: (e) => { x.type = e.target.value; ctx.save(); render(); } });
      for (const t of EXTRA_TYPES) sel.append(h('option', { value: t, selected: t === x.type }, t));
      const pace = x.type === 'Run' ? runPace(x.km, x.minutes) : null;
      list.append(
        h('div', { class: 'weed-row' },
          h('input', { type: 'time', value: x.time, onchange: (e) => { x.time = e.target.value; ctx.save(); } }),
          sel,
          h('button', { class: 'iconbtn', 'aria-label': 'Remove', onclick: () => { day.extras.splice(i, 1); ctx.save(); render(); } }, '×'),
        ),
        h('div', { class: 'weed-row', style: x.type === 'Run' ? '' : 'margin-bottom:14px' },
          h('input', { type: 'number', inputmode: 'numeric', min: '0', step: '5', placeholder: 'min', style: 'flex:0 0 80px', value: x.minutes ?? '', onchange: (e) => { x.minutes = e.target.value === '' ? null : Number(e.target.value); ctx.save(); render(); } }),
          x.type === 'Run'
            ? h('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.01', placeholder: 'km', style: 'flex:0 0 80px', value: x.km ?? '', onchange: (e) => { x.km = e.target.value === '' ? null : Number(e.target.value); ctx.save(); render(); } })
            : null,
          h('input', { type: 'text', placeholder: 'notes (optional)', value: x.note || '', onchange: (e) => { x.note = e.target.value; ctx.save(); } }),
        ),
      );
      if (pace) list.append(h('p', { class: 'sub', style: 'margin:2px 2px 14px' }, `pace ${pace}`));
    });
  };
  render();

  return h('div', { class: 'card' },
    h('h2', {}, 'Extra sessions'),
    list,
    h('button', {
      class: 'btn btn-ghost', style: 'width:100%',
      onclick: () => { day.extras.push({ time: nowTime(), type: 'Muay Thai', minutes: 45, note: '' }); ctx.save(); ctx.refresh(); },
    }, '+ add extra session'),
    h('p', { class: 'sub', style: 'margin-top:8px' },
      'Extras sit on top of the program — keep them light/technical. Fat loss comes from diet + Zone 2, not extra volume.'),
  );
}
