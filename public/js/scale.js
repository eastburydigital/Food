// Scale the leading quantity of an ingredient line, e.g. "2 carrots" x2 -> "4 carrots".
// Lines without a leading number ("Pinch of salt") are left alone.

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const NUM = String.raw`(?:\d+(?:\.\d+)?(?:\s?[½¼¾⅓⅔])?|[½¼¾⅓⅔])`;
const LEAD = new RegExp(String.raw`^(${NUM})(?:\s*[–-]\s*(${NUM}))?(.*)$`);

function parseNum(s) {
  s = s.trim();
  let total = 0;
  const frac = s.match(/[½¼¾⅓⅔]/);
  if (frac) { total += FRACTIONS[frac[0]]; s = s.replace(frac[0], '').trim(); }
  if (s) total += parseFloat(s);
  return total;
}

function formatCount(n) {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const options = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  let best = options[0];
  for (const o of options) if (Math.abs(o[0] - rest) < Math.abs(best[0] - rest)) best = o;
  const w = best[0] === 1 ? whole + 1 : whole;
  if (w === 0 && best[1]) return best[1];
  if (w === 0) return '¼';
  return `${w}${best[1]}`;
}

function formatMetric(n) {
  if (n >= 100) return String(Math.round(n / 10) * 10);
  if (n >= 20) return String(Math.round(n / 5) * 5);
  return String(Math.round(n));
}

// Keep common nouns agreeing with the new number: "1 egg", "2 lemons", "1 garlic clove".
const NOUNS = ['egg yolk', 'egg', 'garlic clove', 'lemon', 'lime', 'banana', 'apple', 'pear', 'carrot', 'courgette', 'onion', 'leek', 'sweet potato', 'potato', 'sheet', 'slice'];
function agree(tail, n) {
  for (const w of NOUNS) {
    const pl = w.endsWith('potato') ? `${w}es` : `${w}s`;
    const re = new RegExp(String.raw`^(\s*(?:(?:large|medium|small|ripe|very ripe|dried) )?)(${pl}|${w})\b`);
    const m = tail.match(re);
    if (m) return m[1] + (n > 1 ? pl : w) + tail.slice(m[0].length);
  }
  return tail;
}

export function scaleLine(text, factor) {
  if (factor === 1) return text;
  const pre = text.match(/^((?:Zest and juice|Juice|Zest) of )(.*)$/i);
  if (pre) return pre[1] + scaleLine(pre[2], factor);
  const m = text.match(LEAD);
  if (!m) return text;
  const [, a, b, rest] = m;

  // Packs and tins keep their size; scale how many you need: "2 × 400g tin ..."
  if (/^(g|ml)\s+(tin|jar|block|pack|ball|bag)\b/.test(rest) || /^(g|ml)\s+\w+\s+(tin|jar|block)\b/.test(rest)) {
    const count = formatCount(factor);
    return count === '1' ? text : `${count} × ${text}`;
  }

  const metric = /^\s*(g|ml)\b/.test(rest);
  const kilo = /^\s*kg\b/.test(rest);
  const litre = /^\s*litres?\b/.test(rest);
  // Things you can't sensibly have half of: round to whole numbers.
  const whole = /^\s*(large |medium |small )?(eggs?|egg yolks?)\b/.test(rest) || /\b(sheets?|slices?)\b/.test(rest);
  const fmt = (v) => {
    const x = parseNum(v) * factor;
    if (metric) return formatMetric(x);
    if (kilo) return String(Math.round(x * 10) / 10);
    if (whole) return String(Math.max(1, Math.round(x)));
    return formatCount(x);
  };
  if (litre) {
    const tail = rest.replace(/^\s*litres?/, '');
    const lo = parseNum(a) * factor;
    const hi = b ? parseNum(b) * factor : lo;
    if (hi < 1) return `${formatMetric(lo * 1000)}${b ? `–${formatMetric(hi * 1000)}` : ''}ml${tail}`;
    const r = (v) => Math.round(v * 10) / 10;
    return `${r(lo)}${b && r(hi) !== r(lo) ? `–${r(hi)}` : ''} ${r(hi) === 1 ? 'litre' : 'litres'}${tail}`;
  }
  const lo = fmt(a);
  const hi = b ? fmt(b) : null;
  let out = lo + (hi && hi !== lo ? `–${hi}` : '');
  let tail = rest;
  return out + agree(tail, parseNum(hi || lo));
}
