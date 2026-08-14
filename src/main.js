import './styles.css';
import { load, save } from './store.js';
import { renderToday } from './views/today.js';
import { renderWeek } from './views/week.js';
import { renderProgress } from './views/progress.js';
import { renderData } from './views/data.js';
import { openBaselineModal } from './views/baseline.js';

const doc = load();

const ctx = {
  doc,
  state: {},
  save: () => save(ctx.doc),
  refresh: () => render(),
  replaceDoc: (newDoc) => { ctx.doc = newDoc; save(newDoc); },
  openBaseline: () => openBaselineModal(ctx),
};

const routes = {
  '#/today': renderToday,
  '#/week': renderWeek,
  '#/progress': renderProgress,
  '#/data': renderData,
};

function render() {
  const hash = routes[location.hash] ? location.hash : '#/today';
  const view = document.getElementById('view');
  view.innerHTML = '';
  routes[hash](view, ctx);
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === hash);
  });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();

// first run: prompt for the day-one baseline
if (!ctx.doc.flags.baselineDone) {
  openBaselineModal(ctx);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
