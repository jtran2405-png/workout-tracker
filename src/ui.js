// Tiny DOM helpers — no framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

let toastTimer = null;
export function toast(msg, kind = 'info') {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

export function confirmDialog({ title, body, confirmLabel = 'Log it anyway', cancelLabel = 'Skip' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const close = (val) => { root.innerHTML = ''; resolve(val); };
    root.append(
      h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target.classList.contains('modal-backdrop')) close(false); } },
        h('div', { class: 'modal' },
          h('h3', {}, title),
          h('p', { class: 'modal-body' }, body),
          h('div', { class: 'modal-actions' },
            h('button', { class: 'btn', onclick: () => close(false) }, cancelLabel),
            h('button', { class: 'btn btn-danger', onclick: () => close(true) }, confirmLabel),
          ),
        ),
      ),
    );
  });
}

export function nowTime() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
