import { weekNumber, phaseFor, PHASE_INFO, todayStr, DEFAULT_BARS } from '../program.js';
import { migrate, clearAll } from '../store.js';
import { setsCsv, daysCsv, backupJson, download } from '../csv.js';
import { h, toast, confirmDialog } from '../ui.js';

export function renderData(root, ctx) {
  const { doc } = ctx;
  const week = weekNumber(todayStr(), doc.settings.week1Monday);
  const phase = phaseFor(week, doc.settings.phaseOverride);

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Data & program')));

  // ---- program settings ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Program'),
    h('p', { class: 'sub', style: 'margin-bottom:12px' },
      `Currently: week ${week} · ${PHASE_INFO[phase].label} phase. `,
      phase === 'ramp' ? `Build phase starts week 5.` : ''),
    field('Program start (day one)', h('input', {
      type: 'date', value: doc.settings.startDate,
      onchange: (e) => { doc.settings.startDate = e.target.value; ctx.save(); ctx.refresh(); },
    })),
    field('Week 1 Monday', h('input', {
      type: 'date', value: doc.settings.week1Monday,
      onchange: (e) => { doc.settings.week1Monday = e.target.value; ctx.save(); ctx.refresh(); },
    })),
    field('Phase override', (() => {
      const sel = h('select', {
        onchange: (e) => { doc.settings.phaseOverride = e.target.value || null; ctx.save(); ctx.refresh(); },
      },
        h('option', { value: '' }, 'Auto (from week number)'),
        h('option', { value: 'ramp' }, 'Force Ramp (3 sets, RIR 3–4)'),
        h('option', { value: 'build' }, 'Force Build (4 sets, heavy)'),
      );
      sel.value = doc.settings.phaseOverride || '';
      return sel;
    })()),
    h('button', { class: 'btn', style: 'width:100%;margin-top:4px', onclick: () => ctx.openBaseline() },
      'Edit day-one baseline weights'),
  ));

  // ---- bar weights ----
  // Lift logging takes plates only; these are what gets added on top. Editable
  // because bars vary between gyms — a women's bar is 15 kg, not 20.
  const barField = (key, label, hint) => field(label, h('input', {
    type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '50',
    value: doc.settings.bars?.[key] ?? DEFAULT_BARS[key],
    onchange: (e) => {
      const v = e.target.value === '' ? DEFAULT_BARS[key] : Number(e.target.value);
      doc.settings.bars = { ...DEFAULT_BARS, ...doc.settings.bars, [key]: v };
      ctx.save();
      ctx.refresh();
      toast(`${label} set to ${v} kg`, 'good');
    },
    title: hint,
  }));

  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Bar weights'),
    h('p', { class: 'sub', style: 'margin-bottom:12px' },
      'You log the plates you load; the app adds the bar. Check your gym\'s bars once and correct these — a women\'s bar is 15 kg, and cheap bars run 10–15 kg.'),
    barField('olympic', 'Straight barbell', 'Squat, bench, deadlift, RDL, hip thrust'),
    barField('ez', 'EZ curl bar', 'EZ-bar curl'),
    h('p', { class: 'sub', style: 'margin-top:8px' },
      'Landmine, cable, machine, dumbbell and kettlebell work gets no bar added — the number you log is already the load.'),
  ));

  // ---- export ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Export'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { download('sets.csv', setsCsv(doc)); toast('sets.csv downloaded', 'good'); } }, '⬇ sets.csv'),
      h('button', { class: 'btn', onclick: () => { download('days.csv', daysCsv(doc)); toast('days.csv downloaded', 'good'); } }, '⬇ days.csv'),
      h('button', { class: 'btn btn-primary', style: 'flex:1 1 100%', onclick: () => {
        download('workout-backup.json', backupJson(doc), 'application/json');
        doc.flags.lastBackup = todayStr();
        ctx.save();
        toast('Full backup downloaded', 'good');
      } }, '⬇ Full backup (.json)'),
    ),
    backupNudge(doc),
  ));

  // ---- restore ----
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    try {
      const restored = migrate(JSON.parse(await f.text()));
      const ok = await confirmDialog({
        title: 'Restore backup?',
        body: `This replaces everything currently in the app with the backup (${Object.keys(restored.days).length} days, ${Object.keys(restored.sessions).length} sessions).`,
        confirmLabel: 'Restore',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
      ctx.replaceDoc(restored);
      toast('Backup restored', 'good');
      ctx.refresh();
    } catch {
      toast('That file is not a valid backup', 'warn');
    }
  });
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Restore'),
    fileIn,
    h('button', { class: 'btn', style: 'width:100%', onclick: () => fileIn.click() }, 'Restore from backup file…'),
  ));

  // ---- danger ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Danger zone'),
    h('button', {
      class: 'btn btn-danger', style: 'width:100%',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Erase all data?',
          body: 'Every log, session, and setting is deleted from this device. Download a backup first.',
          confirmLabel: 'Erase everything',
          cancelLabel: 'Keep my data',
        });
        if (!ok) return;
        clearAll();
        location.reload();
      },
    }, 'Erase all data'),
  ));
}

function field(label, input) {
  return h('div', { class: 'field' }, h('label', {}, label), input);
}

function backupNudge(doc) {
  const last = doc.flags.lastBackup;
  const stale = !last || (new Date(todayStr()) - new Date(last)) / 86400000 > 14;
  if (!stale) return h('p', { class: 'sub', style: 'margin-top:10px' }, `Last backup: ${last}`);
  return h('div', { class: 'warn-note' }, h('span', {}, '⚠︎'),
    last ? `Last backup ${last} — iOS can evict local data; back up every couple of weeks.`
         : 'No backup yet — iOS can evict local data from installed web apps. Download one now.');
}
