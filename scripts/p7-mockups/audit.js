// Injected into each captured page: flags text below WCAG AA contrast and
// interactive elements whose hit box is under 44x44 CSS px. Backgrounds are
// resolved by alpha-compositing ancestor background-colors over the page
// surface (gradients/images are ignored, so photo-backed text is skipped).
(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const over = (top, bot) => {
    const a = top[3] + bot[3] * (1 - top[3]);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const page = parse(getComputedStyle(document.body).backgroundColor) ?? [12, 12, 14, 1];
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none' && n !== document.body) return null;
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    return layers.reverse().reduce((acc, l) => over(l, acc), [...page.slice(0, 3), 1]);
  };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const contrast = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (!t.textContent.trim() || !el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[aria-hidden="true"],[aria-hidden]')) continue;
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const cr = ratio(over(fg, bg), bg);
    if (cr < need) contrast.push({ text: t.textContent.trim().slice(0, 40), ratio: +cr.toFixed(2), need, color: cs.color, size });
  }
  const targets = [];
  document.querySelectorAll('button, a[href], [role="button"], input, select, textarea, [onclick]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
    if (r.width < 44 || r.height < 44) targets.push({ label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
  });
  return { contrast, targets };
})();
