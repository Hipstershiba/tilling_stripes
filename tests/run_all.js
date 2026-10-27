// tests/run_all.js
// Executes all automated test suites in order, exiting with code 1 on the first failure.

const { spawnSync } = require('child_process');
const path = require('path');

const testSuites = [
  // 1. Math & Symmetry Kernel
  'test_tile_registry.js',
  'test_d4_invariance.js',
  'test_d4_block_combinations.js',
  'test_d4_editor.js',
  'test_d4_badge_state.js',

  // 2. Mosaic Engine
  'test_mosaic_engine.js',

  // 3. State Persistence & Quota (IndexedDB + localStorage)
  'test_state_persistence.js',
  'test_indexeddb_persistence.js',
  'test_save_scheduler.js',
  'test_save_status.js',
  'test_storage_key.js',
  'test_payload_version.js',
  'test_history_limits.js',
  'test_persistence_quota.js',
  'test_history_nav.js',
  'test_history_edit_preservation.js',
  'test_document_snapshot.js',
  'test_regeneration_capture.js',
  'test_multistep_undo.js',
  'test_document_edit_transactions.js',
  'test_studio_commands.js',
  'test_visual_tokens.js',
  'test_ui_fields.js',
  'test_dirty_guard.js',

  // 4. UI Architecture & Accessibility
  'test_scope_chip.js',
  'test_info_scopes_source.js',
  'test_info_aria.js',
  'test_editor_ui_state.js',
  'test_info_ui_state.js',
  'test_viewport_pan_zoom.js',
  'test_brush_sizing_snap.js',
  'test_ui_control_registry.js',
  'test_ui_layout_contract.js',

  // 5. Documentation & Contracts
  'test_docs_consistency.js',

  // 6. Subtile Freezing / Locking
  'test_freeze_subtiles.js',
  'test_freeze_generation.js',
  'test_freeze_wiring.js',
  'test_freeze_state.js',
  'test_freeze_undo.js',
  'test_freeze_ui_contract.js',

  // 7. Output & Vector SVG
  'test_spout_output.js',
  'test_simple_svg_paths.js',

  // 8. Vector Subtile Library, D4 Detection & Compiler
  'test_vector_renderer.js',
  'test_d4_detect.js',
  'test_library_compiler.js',
  'test_library_store_crud.js',
  'test_tile_studio_ui_contract.js',
  'test_vector_editor_ops.js',
  'test_vector_boolean_svg.js',
  'test_subtile_review_regressions.js'
];

console.log('====================================================');
console.log(`Running all ${testSuites.length} test suites for Tiling Stripes Studio...`);
console.log('====================================================\n');

let passed = 0;
const startTotal = Date.now();

for (let i = 0; i < testSuites.length; i++) {
  const suite = testSuites[i];
  const suitePath = path.join(__dirname, suite);
  const suiteName = `[${i + 1}/${testSuites.length}] ${suite}`;

  process.stdout.write(`→ Running ${suiteName}... `);
  const start = Date.now();

  const res = spawnSync(process.execPath, [suitePath], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  const duration = Date.now() - start;

  if (res.error) {
    console.log(`FAILED (${duration}ms)`);
    console.error('\n' + '='.repeat(60));
    console.error(`FAILURE in ${suite}:`);
    console.error(`spawn falhou em ${suite}: ${res.error.code || res.error.message}`);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }

  if (res.status === 0) {
    passed++;
    console.log(`PASSED (${duration}ms)`);
  } else {
    console.log(`FAILED (${duration}ms)`);
    console.error('\n' + '='.repeat(60));
    console.error(`FAILURE in ${suite}:`);
    console.error('='.repeat(60));
    if (res.stdout) console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

const totalDuration = Date.now() - startTotal;
console.log('\n====================================================');
console.log(`ALL ${passed}/${testSuites.length} TEST SUITES PASSED in ${totalDuration}ms!`);
console.log('====================================================');
process.exit(0);
