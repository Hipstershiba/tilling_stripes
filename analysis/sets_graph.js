/**
 * analysis/sets_graph.js
 * Grafo de sinergia ESTRUTURAL entre famílias.
 * - Só conta bordas com matéria (intervals), não contatos pontuais (points).
 * - Ignora lado vazio dos dois lados (isso é respiro, não conexão).
 * - Pondera o encaixe pela menor cobertura das duas bordas.
 */
const d = require('./edge_profiles.json');
const byId = Object.fromEntries(d.profiles.map(p => [p.id, p]));

function eq(a, b, tol = 0.02) {
  if (a.intervals.length !== b.intervals.length) return false;
  for (let i = 0; i < a.intervals.length; i++) {
    if (Math.abs(a.intervals[i][0] - b.intervals[i][0]) > tol) return false;
    if (Math.abs(a.intervals[i][1] - b.intervals[i][1]) > tol) return false;
  }
  return true;
}
function cov(side) { return side.intervals.reduce((n, [a, b]) => n + (b - a), 0); }
function active(side) { return side.intervals.length > 0 && cov(side) >= 0.05; }

function tileMatch(a, b) {
  const A = byId[a], B = byId[b];
  const h = active(A.sides.right) && active(B.sides.left) && eq(A.sides.right, B.sides.left)
    ? Math.min(cov(A.sides.right), cov(B.sides.left)) : 0;
  const v = active(A.sides.bottom) && active(B.sides.top) && eq(A.sides.bottom, B.sides.top)
    ? Math.min(cov(A.sides.bottom), cov(B.sides.top)) : 0;
  return { h, v, any: h > 0 || v > 0 };
}

const famPairs = {};
for (const A of d.families) for (const B of d.families) {
  let count = 0, h = 0, v = 0, weight = 0;
  for (const a of A.tileIds) for (const b of B.tileIds) {
    const m = tileMatch(a, b);
    if (m.any) { count++; if (m.h) h++; if (m.v) v++; weight += m.h + m.v; }
  }
  if (count) famPairs[`${A.id}→${B.id}`] = { a: A.id, b: B.id, count, h, v, weight: +weight.toFixed(2) };
}

const partners = {};
for (const f of d.families) partners[f.id] = new Set();
for (const k in famPairs) partners[famPairs[k].a].add(famPairs[k].b);
const degree = Object.fromEntries(d.families.map(f => [f.id, partners[f.id].size]));
const best = {};
for (const f of d.families) {
  best[f.id] = [...partners[f.id]]
    .map(id => ({ id, pairs: (famPairs[`${f.id}→${id}`]?.count || 0) + (famPairs[`${id}→${f.id}`]?.count || 0), weight: +((famPairs[`${f.id}→${id}`]?.weight || 0) + (famPairs[`${id}→${f.id}`]?.weight || 0)).toFixed(1) }))
    .sort((a, b) => b.weight - a.weight || b.pairs - a.pairs)
    .slice(0, 10);
}

const seen = new Set();
const comps = [];
for (const f of d.families) {
  if (seen.has(f.id)) continue;
  const stack = [f.id], comp = [];
  seen.add(f.id);
  while (stack.length) {
    const id = stack.pop(); comp.push(id);
    for (const n of partners[id]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  }
  comps.push(comp);
}
comps.sort((a, b) => b.length - a.length);

console.log('=== SINERGIA ESTRUTURAL (grau / peso) ===');
for (const f of [...d.families].sort((a, b) => degree[b.id] - degree[a.id])) {
  console.log(String(degree[f.id]).padStart(2), f.id.padEnd(20), f.name);
  console.log('   ', best[f.id].map(x => `${x.id}(${x.pairs}p,${x.weight})`).join(', '));
}

console.log('\n=== COMPONENTES ESTRUTURAIS ===');
for (const c of comps) console.log(c.length, c.join(', '));

console.log('\n=== PARES COM MAIS ENCAIXES (peso) ===');
const top = Object.values(famPairs).sort((a, b) => b.weight - a.weight).slice(0, 30);
for (const p of top) console.log(String(p.weight).padStart(7), `${p.a}→${p.b}`, `pares ${p.count} h${p.h}/v${p.v}`);

function closure(famIds) {
  const set = new Set(famIds);
  let activeSides = 0, closed = 0;
  for (const f of d.families) {
    if (!set.has(f.id)) continue;
    for (const id of f.tileIds) {
      const p = byId[id];
      for (const side of ['left', 'right', 'top', 'bottom']) {
        if (!active(p.sides[side])) continue;
        activeSides++;
        let ok = false;
        for (const g of d.families) {
          if (!set.has(g.id)) continue;
          for (const jd of g.tileIds) {
            const q = byId[jd];
            if (side === 'left' && active(q.sides.right) && eq(p.sides.left, q.sides.right)) ok = true;
            if (side === 'right' && active(q.sides.left) && eq(p.sides.right, q.sides.left)) ok = true;
            if (side === 'top' && active(q.sides.bottom) && eq(p.sides.top, q.sides.bottom)) ok = true;
            if (side === 'bottom' && active(q.sides.top) && eq(p.sides.bottom, q.sides.top)) ok = true;
            if (ok) break;
          }
          if (ok) break;
        }
        if (ok) closed++;
      }
    }
  }
  return { active: activeSides, closed, pct: activeSides ? closed / activeSides : 0 };
}

const CURATED = {
  fita: ['center-stripe', 'center-tee', 'center-cross', 'elbow-ribbon', 'truchet-ribbon', 'center-elbow'],
  fitaMaisBorda: ['center-stripe', 'center-tee', 'center-cross', 'elbow-ribbon', 'truchet-ribbon', 'center-elbow', 'edge-t-shape'],
  moldura: ['edge-l-shape', 'edge-t-shape'],
  listrasDuplas: ['stripes', 'corner-stripes'],
  bordasTramas: ['stripes', 'corner-stripes', 'edge-l-shape', 'edge-t-shape'],
  massa: ['half-block', 'corner-triangle', 'side-triangle', 'bowtie', 'quarter-arc-full', 'edge-semicircle', 'checkers', 'quarter-arc-mid'],
  arcos: ['half-circle', 'edge-semicircle', 'quarter-arc-mid', 'quarter-arc-full', 'corner-waves'],
  linha: ['diagonal-line', 'diagonal-hatch', 'zigzag'],
  foco: ['target-circle', 'target-square', 'four-dots', 'diagonal-dots', 'diamond', 'corner-petal'],
  vazio: ['empty-tile']
};
console.log('\n=== FECHAMENTO DOS CONJUNTOS CURADOS (bordas ativas) ===');
for (const [name, fams] of Object.entries(CURATED)) {
  const c = closure(fams);
  console.log(name.padEnd(16), `${c.closed}/${c.active}`, (c.pct * 100).toFixed(1) + '%');
}

require('fs').writeFileSync(__dirname + '/sets_graph.json', JSON.stringify({ famPairs, partners: Object.fromEntries(Object.entries(partners).map(([k, v]) => [k, [...v]])), comps, degree, best }, null, 2));
console.log('\nwrote analysis/sets_graph.json');
