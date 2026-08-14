// Hand-rolled single-series SVG line chart with tap/drag tooltip.
// Marks per spec: 2px line, small dots with oversized hit layer, recessive
// hairline grid, muted axis ink, last point direct-labeled.

const NS = 'http://www.w3.org/2000/svg';

const INK = { line: '#3987e5', grid: '#2c2c2a', axis: '#383835', muted: '#898781', ink: '#ffffff', surface: '#1a1a19' };

function s(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function niceExtent(values, padFrac = 0.12) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * padFrac;
  return [min - pad, max + pad];
}

// points: [{ label, value }], opts: { unit, height, reference: {value,label}, decimals }
export function lineChart(points, opts = {}) {
  const W = 520;
  const H = opts.height ?? 220;
  const M = { top: 14, right: 16, bottom: 26, left: 40 };
  const unit = opts.unit ?? '';
  const dec = opts.decimals ?? 1;

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';

  if (!points || points.length === 0) {
    wrap.innerHTML = '<div class="chart-empty">No data yet — log something and it shows up here.</div>';
    return wrap;
  }

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  const vals = points.map((p) => p.value);
  const extentVals = opts.reference ? [...vals, opts.reference.value] : vals;
  const [yMin, yMax] = niceExtent(extentVals);
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i) => (points.length === 1 ? M.left + iw / 2 : M.left + (i / (points.length - 1)) * iw);
  const y = (v) => M.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

  // grid: 3 hairlines + y labels
  for (let g = 0; g <= 2; g++) {
    const v = yMin + ((yMax - yMin) * g) / 2;
    const gy = y(v);
    svg.append(s('line', { x1: M.left, x2: W - M.right, y1: gy, y2: gy, stroke: INK.grid, 'stroke-width': 1 }));
    const t = s('text', { x: M.left - 6, y: gy + 4, 'text-anchor': 'end', fill: INK.muted, 'font-size': 11 });
    t.textContent = v.toFixed(v >= 100 ? 0 : dec);
    svg.append(t);
  }

  // reference line (e.g. 7h sleep target)
  if (opts.reference) {
    const ry = y(opts.reference.value);
    svg.append(s('line', { x1: M.left, x2: W - M.right, y1: ry, y2: ry, stroke: INK.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
    if (opts.reference.label) {
      const t = s('text', { x: W - M.right, y: ry - 5, 'text-anchor': 'end', fill: INK.muted, 'font-size': 10 });
      t.textContent = opts.reference.label;
      svg.append(t);
    }
  }

  // x labels: first + last (middle if room)
  const xLabelIdx = points.length > 4 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0, points.length - 1];
  for (const i of new Set(xLabelIdx)) {
    const t = s('text', {
      x: x(i), y: H - 8, fill: INK.muted, 'font-size': 11,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    });
    t.textContent = points[i].label;
    svg.append(t);
  }

  // series line
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    svg.append(s('path', { d, fill: 'none', stroke: INK.line, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }

  // dots (small mark, surface ring)
  points.forEach((p, i) => {
    svg.append(s('circle', { cx: x(i), cy: y(p.value), r: 3.5, fill: INK.line, stroke: INK.surface, 'stroke-width': 2 }));
  });

  // last-point direct label
  const li = points.length - 1;
  const lt = s('text', {
    x: Math.min(x(li), W - M.right - 2), y: y(points[li].value) - 9,
    'text-anchor': 'end', fill: INK.ink, 'font-size': 13, 'font-weight': 700,
  });
  lt.textContent = `${points[li].value.toFixed(dec).replace(/\.0$/, '')}${unit ? ' ' + unit : ''}`;
  svg.append(lt);

  // hover/tap layer: crosshair + tooltip
  const cross = s('line', { y1: M.top, y2: M.top + ih, stroke: INK.muted, 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' });
  const tipG = s('g', { visibility: 'hidden' });
  const tipBg = s('rect', { rx: 6, fill: '#242422', stroke: INK.grid });
  const tipT1 = s('text', { fill: INK.ink, 'font-size': 12, 'font-weight': 700 });
  const tipT2 = s('text', { fill: INK.muted, 'font-size': 11 });
  tipG.append(tipBg, tipT1, tipT2);
  svg.append(cross, tipG);

  function showTip(i) {
    const px = x(i), py = y(points[i].value);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');
    tipT1.textContent = `${points[i].value.toFixed(dec).replace(/\.0$/, '')}${unit ? ' ' + unit : ''}`;
    tipT2.textContent = points[i].label;
    const w = Math.max(tipT1.textContent.length, tipT2.textContent.length) * 7 + 16;
    const tx = Math.max(M.left, Math.min(px - w / 2, W - M.right - w));
    const ty = Math.max(2, py - 46);
    tipBg.setAttribute('x', tx); tipBg.setAttribute('y', ty);
    tipBg.setAttribute('width', w); tipBg.setAttribute('height', 36);
    tipT1.setAttribute('x', tx + 8); tipT1.setAttribute('y', ty + 15);
    tipT2.setAttribute('x', tx + 8); tipT2.setAttribute('y', ty + 29);
    tipG.setAttribute('visibility', 'visible');
  }

  function nearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((_, i) => { const d = Math.abs(x(i) - relX); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  svg.addEventListener('pointerdown', (e) => showTip(nearest(e.clientX)));
  svg.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') showTip(nearest(e.clientX)); });
  svg.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tipG.setAttribute('visibility', 'hidden'); });

  wrap.append(svg);
  return wrap;
}
