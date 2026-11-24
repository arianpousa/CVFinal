// contrast-check.mjs: verifies Sable's token pairs meet the HIG/WCAG AA minimums.
// HIG Accessibility (WCAG AA as used by Accessibility Inspector): text up to 17 pt needs 4.5:1,
// 18 pt+ or bold needs 3:1. HIG Dark Mode: aim for 7:1 for custom small text.
// Glass is checked at its WORST case: composited over pure black AND pure white backdrops.
// Run: node contrast-check.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const block = (sel) => css.slice(css.indexOf(sel)).split('}')[0];
const parse = (b) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = parse(block(':root {'));
const dark = { ...light, ...parse(block('@media (prefers-color-scheme: dark)')) };

const rgba = (s) => {
  if (s.startsWith('#')) { const h = s.slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  const m = s.match(/rgba?\(([^)]+)\)/); const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1];
};
const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let fails = 0;
function check(theme, t, fgKey, bgSpec, min, label) {
  const fg = rgba(t[fgKey]);
  const bgs = bgSpec === 'glass'
    ? [over(rgba(t['glass-fill']), [0, 0, 0, 1]), over(rgba(t['glass-fill']), [255, 255, 255, 1])]
    : [rgba(t[bgSpec])];
  const worst = Math.min(...bgs.map((bg) => ratio(fg, bg)));
  const ok = worst >= min;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)} ${label.padEnd(34)} ${worst.toFixed(2)}:1 (min ${min}:1)`);
}

for (const [name, t] of [['light', light], ['dark', dark]]) {
  check(name, t, 'text', 'bg', 7, 'body text on background (7:1 goal)');
  check(name, t, 'text', 'surface', 7, 'body text on card (7:1 goal)');
  check(name, t, 'text-2', 'surface', 4.5, 'secondary text on card');
  check(name, t, 'text', 'glass', 4.5, 'text on glass (worst backdrop)');
  check(name, t, 'text-2', 'glass', 4.5, 'secondary text on glass (worst)');
  check(name, t, 'on-accent', 'accent', 4.5, 'primary button label');
  check(name, t, 'accent', 'surface', 4.5, 'accent link text on card');
  check(name, t, 'danger', 'surface', 4.5, 'destructive text on card');
  check(name, t, 'ok', 'surface', 3, 'ok status dot (non-text 3:1)');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
