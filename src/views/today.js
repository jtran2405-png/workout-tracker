import {
  todayStr, addDays, weekdayOf, weekNumber, phaseFor, PHASE_INFO, DAY_NAMES,
  slotsFor, LIFTS, setsFor, repRange, repTargetLabel, suggestNextWeight,
  plungeWarning, sparringMode, parseDate,
} from '../program.js';
import { getDay, getSession, sessionKey, lastSetsFor } from '../store.js';
import { h, toast, confirmDialog, nowTime } from '../ui.js';

function prettyDate(dateStr) {
  const d = parseDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} · ${d.getDate()}/${d.getMonth() + 1}`;
}

export function renderToday(root, ctx) {
  const { doc } = ctx;
  const date = ctx.state.todayDate ?? todayStr();
  const isToday = date === todayStr();
  const day = getDay(doc, date);
  const week = weekNumber(date, doc.settings.week1Monday);
  const phase = phaseFor(week, doc.settings.phaseOverride);
  const template = slotsFor(date);

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, isToday ? 'Today' : prettyDate(date)),
      h('div', { class: 'datenav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Previous day', onclick: () => { ctx.state.todayDate = addDays(date, -1); ctx.refresh(); } }, '‹'),
        h('button', {
          class: 'iconbtn', style: 'font-size:12px;font-weight:700;padding:0 10px;min-width:64px',
          onclick: () => { ctx.state.todayDate = null; ctx.refresh(); },
        }, isToday ? prettyDate(date).split(' · ')[1] : 'Today'),
        h('button', { class: 'iconbtn', 'aria-label': 'Next day', onclick: () => { ctx.state.todayDate = addDays(date, 1); ctx.refresh(); } }, '›'),
      ),
    ),
    h('div', { class: 'phase-banner' },
      h('span', { class: 'pb-week' }, week < 1 ? 'Baseline week' : `Week ${week} · ${PHASE_INFO[phase].label}`),
      h('span', { class: 'pb-cue' }, PHASE_INFO[phase].cue),
    ),
    habitCard(ctx, date, day),
  );

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
  root.append(recoveryCard(ctx, date, day));

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
}

// ---------- habit strip ----------

function habitCard(ctx, date, day) {
  const num = (v) => (v === '' ? null : Number(v));
  const habit = (label, input) => h('div', { class: 'habit' }, h('label', {}, label), input);

  const weedList = h('div', {});
  const renderWeed = () => {
    weedList.innerHTML = '';
    (day.weed || []).forEach((w, i) => {
      weedList.append(h('div', { class: 'weed-row' },
        h('input', { type: 'time', value: w.time, onchange: (e) => { w.time = e.target.value; ctx.save(); } }),
        h('input', { type: 'text', placeholder: 'note (optional)', value: w.note || '', onchange: (e) => { w.note = e.target.value; ctx.save(); } }),
        h('button', { class: 'iconbtn', 'aria-label': 'Remove', onclick: () => { day.weed.splice(i, 1); ctx.save(); renderWeed(); } }, '×'),
      ));
    });
  };
  renderWeed();

  return h('div', { class: 'card' },
    h('h2', {}, 'Daily log'),
    h('div', { class: 'habits' },
      habit('Wake', h('input', { type: 'time', value: day.wake || '', onchange: (e) => { day.wake = e.target.value || null; ctx.save(); } })),
      habit('Bedtime', h('input', { type: 'time', value: day.bedtime || '', onchange: (e) => { day.bedtime = e.target.value || null; ctx.save(); } })),
      habit('Sleep h', h('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '14', placeholder: '7.5', value: day.sleepHours ?? '', onchange: (e) => { day.sleepHours = num(e.target.value); ctx.save(); } })),
      habit('Weight kg', h('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: '30', max: '200', placeholder: '—', value: day.bodyWeight ?? '', onchange: (e) => { day.bodyWeight = num(e.target.value); ctx.save(); } })),
    ),
    weedList,
    h('div', { style: 'margin-top:10px' },
      h('button', {
        class: 'btn btn-ghost', style: 'width:100%',
        onclick: () => { day.weed.push({ time: nowTime(), note: '' }); ctx.save(); ctx.refresh(); },
      }, `+ log weed session${day.weed.length ? ` (${day.weed.length} today)` : ''}`),
    ),
  );
}

// ---------- slots ----------

function slotCard(ctx, date, day, slot, spec, week, phase) {
  const doneKey = slot === 'AM' ? 'amDone' : 'pmDone';
  const toggle = h('button', {
    class: `done-toggle${day[doneKey] ? ' on' : ''}`,
    onclick: () => { day[doneKey] = !day[doneKey]; ctx.save(); ctx.refresh(); },
  }, day[doneKey] ? '✓ Done' : 'Done?');

  const head = h('div', { class: 'slot-head' },
    h('div', {},
      h('div', { class: 'slot-tag' }, slot),
      h('div', { class: 'slot-label' }, slotTitle(spec, week)),
    ),
    toggle,
  );

  const card = h('div', { class: 'card' }, head);

  if (spec.type === 'lift') {
    card.append(liftBody(ctx, date, day, spec.lift, phase));
    card.append(h('p', { class: 'sub', style: 'margin-top:12px' }, '→ sauna after (always fine post-lift)'));
  } else if (spec.type === 'recovery' && weekdayOf(date) === 3) {
    card.append(h('p', { class: 'sub' }, 'Hard no-lift day. Sauna, cold plunge, mobility — let the tissue rebuild.'));
  } else if (spec.type === 'sparring') {
    const mode = sparringMode(week);
    card.append(
      weekdayOf(date) === 0
        ? h('div', { style: 'margin-bottom:8px' }, h('span', { class: `chip ${mode === 'live' ? 'chip-warn' : 'chip-accent'}` }, mode === 'live' ? 'LIVE sparring' : 'Technical only'))
        : null,
      h('textarea', {
        class: 'notes', placeholder: 'Sparring notes — what worked, what got exploited…',
        onchange: (e) => { day.sparringNotes = e.target.value || null; ctx.save(); },
      }, day.sparringNotes || ''),
    );
  }
  return card;
}

function slotTitle(spec, week) {
  if (spec.type === 'lift') return `${LIFTS[spec.lift].title} — lift`;
  if (spec.type === 'sparring') return spec.label;
  return spec.label;
}

// ---------- lift logging ----------

function liftBody(ctx, date, day, liftKey, phase) {
  const { doc } = ctx;
  const tpl = LIFTS[liftKey];
  const body = h('div', {});
  const existing = doc.sessions[sessionKey(date, 'PM')];

  const ensure = () => {
    const sess = getSession(doc, date, 'PM', liftKey);
    return sess;
  };

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
        const sess = ensure();
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
    const sess = ctx.doc.sessions[sessionKey(date, 'PM')];
    if (!sess) return;
    const allDone = tpl.exercises.every((ex) => {
      const planned = setsFor(ex, phase);
      const arr = sess.exercises[ex.name] || [];
      return arr.filter((s) => s.done).length >= planned;
    });
    if (allDone && !day.pmDone) {
      day.pmDone = true;
      sess.status = 'done';
      ctx.save();
      toast('Session complete 💪 Sauna time.', 'good');
      ctx.refresh();
    }
  }

  return body;
}

function fmtW(w) {
  return String(Number(w.toFixed(1))).replace(/\.0$/, '');
}

// ---------- recovery ----------

function recoveryCard(ctx, date, day) {
  const chip = (key, label) => h('button', {
    class: `rec-chip${day.recovery[key] ? ' on' : ''}`,
    onclick: async () => {
      if (key === 'plunge' && !day.recovery.plunge) {
        const warn = plungeWarning(date);
        if (warn) {
          const ok = await confirmDialog({ title: 'Cold plunge on a lifting day?', body: warn });
          if (!ok) return;
        }
      }
      day.recovery[key] = !day.recovery[key];
      ctx.save();
      ctx.refresh();
    },
  }, label);

  return h('div', { class: 'card' },
    h('h2', {}, 'Recovery'),
    h('div', { class: 'recovery-chips' }, chip('sauna', '🔥 Sauna'), chip('plunge', '🧊 Cold plunge')),
    plungeWarning(date) && !day.recovery.plunge
      ? h('div', { class: 'warn-note' }, '⚠︎', 'Lifting day — skip the plunge (sauna is fine).')
      : null,
  );
}
