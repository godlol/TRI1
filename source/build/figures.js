// Small inline SVG diagrams. Colors come from the page's CSS classes.
function r(n) { return Math.round(n * 10) / 10; }

function sub(base, s) {
  return base + '<tspan dy="3" font-size="9">' + s + '</tspan><tspan dy="-3"></tspan>';
}

function adasPanel(x0, kind) {
  const ox = x0 + 46, oy = 196, top = 26, right = x0 + 296;
  const ex = x0 + 171, ey = 111; // AD and SRAS cross here
  const lras = kind === 'rec' ? x0 + 226 : x0 + 116;
  const title = kind === 'rec' ? 'Recessionary gap' : 'Inflationary gap';
  const note = kind === 'rec' ? 'output below potential' : 'output above potential';
  const gx1 = Math.min(ex, lras), gx2 = Math.max(ex, lras);
  return `
  <g>
    <text class="fig-title" x="${ox}" y="14">${title}</text>
    <text class="fig-note" x="${right}" y="14" text-anchor="end">${note}</text>
    <line class="fig-axis" x1="${ox}" y1="${top}" x2="${ox}" y2="${oy}"/>
    <line class="fig-axis" x1="${ox}" y1="${oy}" x2="${right}" y2="${oy}"/>
    <text class="fig-label" transform="translate(${x0 + 12} ${(top + oy) / 2 + 14}) rotate(-90)" text-anchor="middle">Price level</text>
    <text class="fig-label" x="${right}" y="${oy + 30}" text-anchor="end">Real GDP</text>
    <line class="fig-line" x1="${ex - 105}" y1="${ey - 70}" x2="${ex + 105}" y2="${ey + 70}"/>
    <text class="fig-label" x="${ex + 109}" y="${ey + 74}">AD</text>
    <line class="fig-line" x1="${ex - 105}" y1="${ey + 70}" x2="${ex + 105}" y2="${ey - 70}"/>
    <text class="fig-label" x="${ex + 109}" y="${ey - 68}">SRAS</text>
    <line class="fig-line fig-strong" x1="${lras}" y1="${top + 8}" x2="${lras}" y2="${oy}"/>
    <text class="fig-label" x="${lras}" y="${top + 2}" text-anchor="middle">LRAS</text>
    <line class="fig-dash" x1="${ox}" y1="${ey}" x2="${ex}" y2="${ey}"/>
    <line class="fig-dash" x1="${ex}" y1="${ey}" x2="${ex}" y2="${oy}"/>
    <circle class="fig-dot" cx="${ex}" cy="${ey}" r="4"/>
    <text class="fig-label" x="${ox - 6}" y="${ey + 4}" text-anchor="end">${sub('PL', '1')}</text>
    <text class="fig-label" x="${ex}" y="${oy + 15}" text-anchor="middle">${sub('Y', '1')}</text>
    <text class="fig-label" x="${lras}" y="${oy + 15}" text-anchor="middle">${sub('Y', 'f')}</text>
    <line class="fig-gap" x1="${gx1}" y1="${oy}" x2="${gx2}" y2="${oy}"/>
  </g>`;
}

function adasGaps() {
  return `<figure class="fig"><svg viewBox="0 0 660 232" role="img" aria-label="Two aggregate demand and aggregate supply graphs. In the first, AD and SRAS cross to the left of the vertical LRAS curve, a recessionary gap. In the second, they cross to the right of LRAS, an inflationary gap.">
  ${adasPanel(0, 'rec')}${adasPanel(340, 'inf')}
  </svg><figcaption>Short-run equilibrium is where AD crosses SRAS. Its position relative to LRAS shows the type of output gap. The thick segment on the axis is the gap between actual output and full-employment output.</figcaption></figure>`;
}

function businessCycle() {
  const ox = 52, oy = 196, right = 640, top = 20;
  const W = right - ox - 16;
  const gdp = (t) => 40 + 92 * t + 26 * Math.sin(2 * Math.PI * 1.85 * t + 0.35); // height above axis
  const trend = (t) => 40 + 92 * t;
  const X = (t) => ox + 8 + W * t;
  const Y = (h) => oy - h;
  let d = '';
  const N = 160;
  const pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([t, gdp(t)]); d += (i ? 'L' : 'M') + r(X(t)) + ' ' + r(Y(gdp(t))); }
  const ext = [];
  for (let i = 1; i < N; i++) {
    if (pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1]) ext.push(['Peak', pts[i]]);
    if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) ext.push(['Trough', pts[i]]);
  }
  let marks = '';
  ext.forEach(([name, [t, h]]) => {
    const up = name === 'Peak';
    marks += `<circle class="fig-dot" cx="${r(X(t))}" cy="${r(Y(h))}" r="4"/>`;
    marks += `<text class="fig-label" x="${r(X(t))}" y="${r(Y(h) + (up ? -10 : 19))}" text-anchor="middle">${name}</text>`;
  });
  // phase labels between consecutive turning points
  let phases = '';
  for (let i = 0; i + 1 < ext.length; i++) {
    const [n1, [t1]] = ext[i], [, [t2]] = ext[i + 1];
    const tm = (t1 + t2) / 2;
    const name = n1 === 'Peak' ? 'Recession' : 'Expansion';
    const off = n1 === 'Peak' ? 20 : -14;
    phases += `<text class="fig-note" x="${r(X(tm) + off)}" y="${r(Y(gdp(tm)) + (n1 === 'Peak' ? -6 : 4))}" text-anchor="${n1 === 'Peak' ? 'start' : 'end'}">${name}</text>`;
  }
  return `<figure class="fig"><svg viewBox="0 0 660 226" role="img" aria-label="Graph of real GDP over time. Output rises and falls in waves around an upward-sloping trend line. High points are peaks, low points are troughs, falling stretches are recessions, and rising stretches are expansions.">
    <line class="fig-axis" x1="${ox}" y1="${top}" x2="${ox}" y2="${oy}"/>
    <line class="fig-axis" x1="${ox}" y1="${oy}" x2="${right}" y2="${oy}"/>
    <text class="fig-label" transform="translate(16 ${(top + oy) / 2 + 26}) rotate(-90)" text-anchor="middle">Real GDP</text>
    <text class="fig-label" x="${right}" y="${oy + 18}" text-anchor="end">Time</text>
    <line class="fig-dash" x1="${r(X(0))}" y1="${r(Y(trend(0)))}" x2="${r(X(1))}" y2="${r(Y(trend(1)))}"/>
    <text class="fig-note" x="${r(X(1))}" y="${r(Y(trend(1)) + 30)}" text-anchor="end">Growth trend (potential output)</text>
    <path class="fig-line fig-strong" fill="none" d="${d}"/>
    ${marks}${phases}
  </svg><figcaption>Actual output moves above and below potential output. The distance between the curve and the trend line at any moment is the output gap.</figcaption></figure>`;
}

function discPanel(x0, kind) {
  const w = 190, ax = x0 + 14, bx = x0 + w - 6, base = 128, cx = x0 + 104;
  let body = '';
  if (kind === 'removable') {
    // gentle curve with a hole at cx
    const f = (x) => 96 - 0.42 * (x - ax) + 0.0009 * (x - ax) * (x - ax);
    let d = '';
    for (let x = ax + 6; x <= bx - 6; x += 4) d += (d ? 'L' : 'M') + r(x) + ' ' + r(f(x));
    body = `<path class="fig-line fig-strong" fill="none" d="${d}"/>
      <circle class="fig-open" cx="${cx}" cy="${r(f(cx))}" r="4.5"/>
      <circle class="fig-dot" cx="${cx}" cy="${r(f(cx) - 30)}" r="4"/>`;
  } else if (kind === 'jump') {
    body = `<line class="fig-line fig-strong" x1="${ax + 6}" y1="92" x2="${cx}" y2="78"/>
      <circle class="fig-dot" cx="${cx}" cy="78" r="4"/>
      <line class="fig-line fig-strong" x1="${cx}" y1="40" x2="${bx - 6}" y2="26"/>
      <circle class="fig-open" cx="${cx}" cy="40" r="4.5"/>`;
  } else {
    const g = (x) => Math.max(12, 112 - 2600 / Math.pow(Math.abs(x - cx), 1.45));
    let dl = '', dr = '';
    for (let x = ax + 6; x <= cx - 7; x += 2) dl += (dl ? 'L' : 'M') + r(x) + ' ' + r(g(x));
    for (let x = cx + 7; x <= bx - 6; x += 2) dr += (dr ? 'L' : 'M') + r(x) + ' ' + r(g(x));
    body = `<path class="fig-line fig-strong" fill="none" d="${dl}"/><path class="fig-line fig-strong" fill="none" d="${dr}"/>`;
  }
  const names = { removable: 'Removable (hole)', jump: 'Jump', infinite: 'Infinite (asymptote)' };
  return `<g>
    <line class="fig-axis" x1="${ax}" y1="${base}" x2="${bx}" y2="${base}"/>
    <line class="fig-dash" x1="${cx}" y1="8" x2="${cx}" y2="${base}"/>
    <text class="fig-label" x="${cx}" y="${base + 15}" text-anchor="middle">x = c</text>
    ${body}
    <text class="fig-title" x="${x0 + w / 2 + 4}" y="${base + 36}" text-anchor="middle">${names[kind]}</text>
  </g>`;
}

function discontinuities() {
  return `<figure class="fig"><svg viewBox="0 0 660 172" role="img" aria-label="Three small graphs. A removable discontinuity is a curve with a hole. A jump discontinuity is two pieces at different heights. An infinite discontinuity is a curve that shoots upward on both sides of a vertical asymptote.">
  ${discPanel(20, 'removable')}${discPanel(235, 'jump')}${discPanel(450, 'infinite')}
  </svg><figcaption>An open circle marks a point the graph approaches but does not include. A filled dot marks the actual function value.</figcaption></figure>`;
}

function peCurve() {
  const ox = 60, oy = 190, top = 14, right = 620;
  const zeroY = 70; // y of potential energy = 0
  const depth = 96; // well depth in px
  const r0 = 1, a = 2.3;
  const V = (x) => Math.pow(1 - Math.exp(-a * (x - r0)), 2) - 1; // Morse, minimum -1 at r0
  const X = (x) => ox + (x - 0.45) / (3.6 - 0.45) * (right - ox - 20);
  const Y = (v) => zeroY - v * depth;
  let d = '';
  for (let x = 0.6; x <= 3.6; x += 0.01) {
    const y = Y(V(x));
    if (y < top) continue;
    d += (d ? 'L' : 'M') + r(X(x)) + ' ' + r(y);
  }
  const mx = r(X(r0)), my = r(Y(-1));
  return `<figure class="fig"><svg viewBox="0 0 660 226" role="img" aria-label="Graph of potential energy against the distance between two nuclei. The curve is very high at short distances, drops to a minimum at the bond length, then rises toward zero at large distances. The depth of the minimum below zero is the bond energy.">
    <line class="fig-axis" x1="${ox}" y1="${top}" x2="${ox}" y2="${oy}"/>
    <line class="fig-axis" x1="${ox}" y1="${oy}" x2="${right}" y2="${oy}"/>
    <text class="fig-label" transform="translate(18 ${(top + oy) / 2 + 40}) rotate(-90)" text-anchor="middle">Potential energy</text>
    <text class="fig-label" x="${right}" y="${oy + 18}" text-anchor="end">Distance between nuclei</text>
    <line class="fig-dash" x1="${ox}" y1="${zeroY}" x2="${right}" y2="${zeroY}"/>
    <text class="fig-label" x="${ox - 6}" y="${zeroY + 4}" text-anchor="end">0</text>
    <path class="fig-line fig-strong" fill="none" d="${d}"/>
    <line class="fig-dash" x1="${mx}" y1="${my}" x2="${mx}" y2="${oy}"/>
    <circle class="fig-dot" cx="${mx}" cy="${my}" r="4"/>
    <text class="fig-label" x="${mx}" y="${oy + 18}" text-anchor="middle">bond length</text>
    <line class="fig-gap" x1="${mx + 150}" y1="${zeroY}" x2="${mx + 150}" y2="${my}"/>
    <text class="fig-label" x="${mx + 160}" y="${(zeroY + my) / 2 + 4}">bond energy</text>
    <line class="fig-dash" x1="${mx}" y1="${my}" x2="${mx + 150}" y2="${my}"/>
    <text class="fig-note" x="${r(X(0.62)) + 10}" y="${top + 12}">repulsion dominates</text>
    <text class="fig-note" x="${right - 6}" y="${zeroY - 8}" text-anchor="end">atoms too far apart to interact</text>
  </svg><figcaption>The most stable separation is at the bottom of the well. A deeper well means a stronger bond.</figcaption></figure>`;
}

module.exports = {
  'adas-gaps': adasGaps,
  'business-cycle': businessCycle,
  'discontinuities': discontinuities,
  'pe-curve': peCurve,
};
