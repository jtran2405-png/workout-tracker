// CSV + JSON export. Pure functions over the store document — unit tested.

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells) {
  return cells.map(esc).join(',');
}

export function setsCsv(doc) {
  const lines = [row(['date', 'slot', 'workout', 'exercise', 'set', 'weight', 'reps', 'done'])];
  const keys = Object.keys(doc.sessions).sort();
  for (const key of keys) {
    const s = doc.sessions[key];
    for (const [exName, sets] of Object.entries(s.exercises || {})) {
      sets.forEach((set, i) => {
        lines.push(row([s.date, s.slot, s.template, exName, i + 1, set.weight ?? '', set.reps ?? '', set.done ? 1 : 0]));
      });
    }
  }
  return lines.join('\n') + '\n';
}

export function daysCsv(doc) {
  const lines = [row([
    'date', 'wake', 'bedtime', 'sleep_hours', 'body_weight',
    'weed_count', 'weed_times', 'protein_hit', 'junk', 'ate_late', 'food_note',
    'sauna', 'plunge', 'am_done', 'pm_done', 'sparring_notes', 'extras',
  ])];
  const dates = Object.keys(doc.days).sort();
  for (const date of dates) {
    const d = doc.days[date];
    const weed = d.weed || [];
    lines.push(row([
      date, d.wake ?? '', d.bedtime ?? '', d.sleepHours ?? '', d.bodyWeight ?? '',
      weed.length, weed.map((w) => w.time).join(' '),
      d.food?.protein ? 1 : 0, d.food?.junk ? 1 : 0, d.food?.late ? 1 : 0, d.food?.note ?? '',
      d.recovery?.sauna ? 1 : 0, d.recovery?.plunge ? 1 : 0,
      d.amDone ? 1 : 0, d.pmDone ? 1 : 0, d.sparringNotes ?? '',
      (d.extras || []).map((x) => `${x.time} ${x.type}${x.minutes ? ` ${x.minutes}min` : ''}${x.note ? ` (${x.note})` : ''}`).join('; '),
    ]));
  }
  return lines.join('\n') + '\n';
}

export function backupJson(doc) {
  return JSON.stringify(doc, null, 2);
}

// Browser-only: trigger a real file download.
export function download(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
