/**
 * analysis/classify_ports.js
 * Classifica as bordas dos 85 subtiles em classes de porta legíveis e
 * deriva a assinatura de cada família (multiconjunto de perfis sob D4).
 */
const d = require('./edge_profiles.json');

const T = {
  full: [[0, 1]],
  center3: [[1 / 3, 2 / 3]],
  half0: [[0, 0.5]],
  half1: [[0.5, 1]],
  third0: [[0, 1 / 3]],
  third1: [[2 / 3, 1]],
  doubleThird: [[0, 1 / 3], [2 / 3, 1]],
  midHalf: [[0.25, 0.75]],
  quarter0: [[0, 0.25]],
  quarter1: [[0.75, 1]]
};

function close(a, b, tol = 0.025) { return Math.abs(a - b) <= tol; }
function sameIntervals(iv, tpl, tol = 0.025) {
  if (iv.length !== tpl.length) return false;
  for (let i = 0; i < iv.length; i++) {
    if (!close(iv[i][0], tpl[i][0], tol) || !close(iv[i][1], tpl[i][1], tol)) return false;
  }
  return true;
}

function classify(side) {
  const iv = side.intervals;
  if (iv.length === 0) return side.points.length ? `P(${side.points.join(',')})` : '∅';
  for (const [name, tpl] of Object.entries(T)) {
    if (sameIntervals(iv, tpl)) return name;
  }
  // faixas finas (traços): descreve centros e larguras
  if (iv.every(([a, b]) => b - a < 0.22)) {
    return 'S[' + iv.map(([a, b]) => `${((a + b) / 2).toFixed(2)}w${(b - a).toFixed(2)}`).join(' ') + ']';
  }
  return '?' + JSON.stringify(iv);
}

const rows = [];
for (const p of d.profiles) {
  const sig = ['left', 'right', 'top', 'bottom'].map(s => classify(p.sides[s]));
  rows.push({ id: p.id, name: p.name, family: p.family, sig });
}

const fams = d.families.map(f => {
  const members = rows.filter(r => r.family === f.id);
  const sigs = [...new Set(members.map(m => m.sig.join('|')))];
  const classes = [...new Set(members.flatMap(m => m.sig))];
  return { id: f.id, name: f.name, group: f.group, size: f.tileIds.length, sigs, classes };
});

console.log('=== ASSINATURAS POR TILE (L|R|T|B) ===');
for (const r of rows) console.log(String(r.id).padStart(3), r.family.padEnd(18), r.sig.join(' | '), ' ', r.name);
console.log('\n=== FAMÍLIAS ===');
for (const f of fams) {
  console.log(`\n${f.id} (${f.name}) [${f.group}] n=${f.size}`);
  console.log('  classes:', f.classes.join(', '));
  for (const s of f.sigs) console.log('  ', s);
}

require('fs').writeFileSync(__dirname + '/ports_classified.json', JSON.stringify({ rows, fams }, null, 2));
