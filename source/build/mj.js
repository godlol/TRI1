// Server-side TeX -> SVG rendering with a shared glyph cache.
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: 'global' });
const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });

const memo = new Map();
const fallback = [];
let count = 0;

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Returns an inline <svg> wrapped in a span. `display` only switches TeX display style.
function render(src, display) {
  const key = (display ? 'D' : 'I') + src;
  if (memo.has(key)) return memo.get(key);
  const node = doc.convert(src, { display: !!display });
  let out = adaptor.innerHTML(node); // the <svg> element only
  if (/data-mml-node="merror"|data-mjx-error|="red"/.test(out)) {
    throw new Error('TeX error in: ' + src);
  }
  if (/<text[ >]/.test(out)) fallback.push(src);
  out = out.replace(/ data-(?:mml-node|mjx-texclass|c|variant|mjx-alternate|latex)="[^"]*"/g, '');
  out = out.replace(' role="img" focusable="false"', ' focusable="false"');
  out = out.replace(' xmlns="http://www.w3.org/2000/svg"', '').replace(' xmlns:xlink="http://www.w3.org/1999/xlink"', '');
  out = out.replace(/<g><\/g>/g, '');
  out = out.replace('<svg ', '<svg aria-hidden="true" ');
  const html = '<span class="mx" role="img" aria-label="' + esc(src) + '">' + out + '</span>';
  memo.set(key, html);
  count++;
  return html;
}

function cacheSvg() {
  const el = svg.pageElements(doc);
  return el ? adaptor.outerHTML(el) : '';
}

function styles() {
  return adaptor.textContent(svg.styleSheet(doc));
}

module.exports = { render, cacheSvg, styles, stats: () => ({ unique: count, fallback }) };
