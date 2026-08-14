// Day-one baseline entry modal (Fri 2026-08-14 onboarding session).

import { LIFTS } from '../program.js';
import { getSession, sessionKey, getDay } from '../store.js';
import { h, toast } from '../ui.js';

export function openBaselineModal(ctx) {
  const { doc } = ctx;
  const date = doc.settings.startDate;
  const root = document.getElementById('modal-root');
  const existing = doc.sessions[sessionKey(date, 'AM')];
  const tpl = LIFTS.BASELINE;

  const inputs = {}; // name -> [{w, r}]
  const body = h('div', {});
  for (const ex of tpl.exercises) {
    inputs[ex.name] = [];
    const exEl = h('div', { class: 'exercise' },
      h('div', { class: 'ex-head' },
        h('span', { class: 'ex-name' }, ex.name),
        h('span', { class: 'ex-target' }, `${ex.sets}×${ex.high}${ex.unitLabel ? ' ' + ex.unitLabel : ''}`),
      ),
    );
    for (let i = 0; i < ex.sets; i++) {
      const cur = existing?.exercises?.[ex.name]?.[i] || {};
      const w = h('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', placeholder: 'kg', value: cur.weight ?? '' });
      const r = h('input', { type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: String(ex.high), value: cur.reps ?? ex.high });
      inputs[ex.name].push({ w, r });
      exEl.append(h('div', { class: 'set-row', style: 'grid-template-columns:26px 1fr 1fr' },
        h('span', { class: 'set-n' }, String(i + 1)), w, r));
    }
    body.append(exEl);
  }

  const close = () => { root.innerHTML = ''; };
  const saveBtn = h('button', {
    class: 'btn btn-primary',
    onclick: () => {
      const sess = getSession(doc, date, 'AM', 'BASELINE');
      for (const ex of tpl.exercises) {
        sess.exercises[ex.name] = inputs[ex.name].map(({ w, r }) => ({
          weight: w.value === '' ? null : Number(w.value),
          reps: r.value === '' ? null : Number(r.value),
          done: w.value !== '',
        }));
      }
      sess.status = 'done';
      getDay(doc, date); // ensure the day record exists
      doc.flags.baselineDone = true;
      ctx.save();
      close();
      toast('Baseline saved — progression starts from here.', 'good');
      ctx.refresh();
    },
  }, 'Save baseline');

  root.append(h('div', { class: 'modal-backdrop' },
    h('div', { class: 'modal' },
      h('h3', {}, 'Day one — enter your baseline weights'),
      h('p', { class: 'modal-body' }, 'The onboarding session you did Fri Aug 14 (2 sets each). These weights seed every future suggestion.'),
      body,
      h('div', { class: 'modal-actions', style: 'margin-top:16px' },
        h('button', { class: 'btn', onclick: () => { doc.flags.baselineDone = true; ctx.save(); close(); } }, 'Later'),
        saveBtn,
      ),
    ),
  ));
}
