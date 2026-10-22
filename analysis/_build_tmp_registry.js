/**
 * analysis/_build_tmp_registry.js
 * Monta uma cópia temporária do registro com os 19 tiles propostos e roda
 * o teste oficial de D4, para provar que a expansão é implementável.
 * Não altera o app.
 */
const fs = require('fs');
const path = require('path');
const { PROPOSED_FAMILIES } = require('./proposed_tiles.js');

const root = path.resolve(__dirname, '..');
const tmp = path.join(__dirname, '_tmp_registry_test');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, 'core'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });

let reg = fs.readFileSync(path.join(root, 'core/tile_registry.js'), 'utf8').replace(/\r\n/g, '\n');

// 1. Renderers
const renderers = [];
for (const fam of PROPOSED_FAMILIES) {
  for (const t of fam.tiles) {
    let body = t.draw.toString();
    // draw(ctx, w, h, p) { ... }
    body = body.replace(/^draw\(ctx, w, h, p\)\s*\{/, 'function (ctx, w, h, padding, color) {\n    const p = padding;')
      .replace(/\}\s*$/, '  }');
    body = body.replace(/#000/g, 'color');
    renderers.push(body);
  }
}
const rendererBlock = '\n  // --- GRUPO 7: GRAMÁTICA DE CONJUNTOS (NOVOS) ---\n' + renderers.join(',\n') + '\n';
const emptyAnchor = `  // Family 31: Tile Vazio (Espaço) (88)
  function () {
    // Intentionally empty
  }
];`;
if (!reg.includes(emptyAnchor)) throw new Error('empty anchor not found');
reg = reg.replace(emptyAnchor, `  // Family 31: Tile Vazio (Espaço) (88)
  function () {
    // Intentionally empty
  },${rendererBlock}];`);

// 2. Names
const names = [];
for (const fam of PROPOSED_FAMILIES) for (const t of fam.tiles) names.push(`  ${JSON.stringify(t.name)}`);
const namesAnchor = `  // Grupo 6: Espaço Negativo
  "Tile Vazio (Espaço)"
];`;
if (!reg.includes(namesAnchor)) throw new Error('names anchor not found');
reg = reg.replace(namesAnchor, `  // Grupo 6: Espaço Negativo
  "Tile Vazio (Espaço)",

  // Grupo 7: Gramática de Conjuntos (novos)
${names.join(',\n')}
];`);

// 3. Meta
const meta = PROPOSED_FAMILIES.map(f => `  { id: '${f.id}', name: ${JSON.stringify(f.name)}, group: ${JSON.stringify(f.group)}, tileIds: [${f.tiles.map(t => t.id).join(', ')}] }`);
const metaAnchor = `  { id: 'empty-tile', name: 'Tile Vazio (Espaço)', group: 'Espaço Negativo', tileIds: [84] }
];`;
if (!reg.includes(metaAnchor)) throw new Error('meta anchor not found');
reg = reg.replace(metaAnchor, `  { id: 'empty-tile', name: 'Tile Vazio (Espaço)', group: 'Espaço Negativo', tileIds: [84] },

${meta.join(',\n')}
];`);

// 4. D4
const d4 = [
  '  registerCorner4(85, 86, 87, 88);',
  '  registerEdge4(89, 90, 91, 92);',
  '  registerEdge4(93, 94, 95, 96);',
  '  registerSymmetric1(97);',
  '  registerSymmetric1(98);',
  '  registerSymmetric1(99);',
  '  registerSymmetric1(100);',
  '  registerSymmetric1(101);',
  '  registerSymmetric1(102);',
  '  registerSymmetric1(103);'
].join('\n');
const d4Anchor = `  registerSymmetric1(84);            // Family 31: Tile Vazio (Espaço)`;
if (!reg.includes(d4Anchor)) throw new Error('d4 anchor not found');
reg = reg.replace(d4Anchor, `${d4Anchor}\n${d4}`);

fs.writeFileSync(path.join(tmp, 'core/tile_registry.js'), reg);
fs.copyFileSync(path.join(root, 'core/d4_symmetry.js'), path.join(tmp, 'core/d4_symmetry.js'));
fs.copyFileSync(path.join(root, 'tests/test_tile_registry.js'), path.join(tmp, 'tests/test_tile_registry.js'));
console.log('temp registry built at', tmp);
