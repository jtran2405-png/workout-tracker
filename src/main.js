import './styles.css';
import { load, save } from './store.js';
import { renderHealth } from './views/health.js';
import { renderTrain } from './views/train.js';
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
  '#/health': renderHealth,
  '#/train': renderTrain,
  '#/train/week': renderWeek,
  '#/progress': renderProgress,
  '#/data': renderData,
};

// old bookmarks/home-screen installs from v1
const redirects = { '#/today': '#/train', '#/week': '#/train/week' };

function render() {
  let hash = redirects[location.hash] || location.hash;
  if (!routes[hash]) hash = '#/train';
  const view = document.getElementById('view');
  view.innerHTML = '';
  routes[hash](view, ctx);
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', hash.startsWith(a.dataset.route));
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
