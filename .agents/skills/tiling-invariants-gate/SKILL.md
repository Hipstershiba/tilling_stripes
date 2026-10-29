---
name: tiling-invariants-gate
description: >-
  Use this skill before committing or delivering any code changes in this workspace to enforce the 7 project invariants of Tiling Stripes Studio: D4 dihedral group algebra, cell stabilizers, UI 5-surface hierarchy, 60 frozen controls registry, persistence schema v3, documentation consistency, and interface microcopy.
---

# Tiling Stripes Invariants & Quality Gate

This skill acts as the quality firewall for the `tiling_stripes` workspace. No code change may be considered complete without passing through this gate.

---

## 1. The 7 Non-Negotiable Project Invariants

1. **D4 Dihedral Group Symmetry ($D_4$):**
   - Strictly 8 square isometries: `id`, `r90`, `r180`, `r270`, `mx`, `my`, `md`, `mad`.
   - In cells with non-trivial stabilizers under `mandala_d4`, the assigned tile MUST be stabilizer-invariant ($g(t) = t$) or default to the canonical Empty Tile (`#84`).
   - The 4 canonical symmetry mode IDs are: `mandala_d4`, `kaleidoscope`, `rotational_c4`, `bilateral_d2`. NEVER use `kaleidoscope_permissive`.
   - The 85-tile catalog (IDs 0–84) in 31 families is algebraically closed under $D_4$.

2. **UI 5-Surfaces Contract, Illustrator Geography & Flex Order:**
   - `#top-control-bar` (above the body) — **Control Bar** for the active tool only: `#topToolContext`, `#ctxPaint`, `#rotateToolOptionsWrap`, `#freezeToolOptionsWrap` and `#selectionSummary`. Static document controls MUST NOT return here.
   - `#left-toolbar` (order: 0) — 2-column tool column: tools, visual guides, swatches.
   - `#workspace-viewport` (order: 1) — Canvas with 2D pan and zoom via CSS transforms.
   - `#utility-rail` (order: 2) — 40px document rail: **Histórico** (`#dock-history`), persistent flyouts for **Peças** (`#railFlyoutPieces`) and **Documento** (`#railFlyoutDocument`), plus the Biblioteca shortcut (`#railOpenLibrary`). Flyouts open left and stay open until the same button is clicked again or another rail item opens; they MUST NOT close on outside click. Panel tabs MUST NOT live here.
   - `#right-dock` (order: 3) — **Static** property dock: collapsible 44px drawer toggle (`#btnToggleRightDock`), `#dock-generator` (top strip), `#panelSymmetryGroup` with tabs `#propertiesTabs` for `#panel-symmetry`/`#panel-edit-scope`, `#panel-edit-brush` alone below, `#dock-workspace-tiles` in pieces mode, and `#dock-export` (footer). It MUST NOT swap panels or tabs when the tool changes.
   - **No sidebar scrolls as a whole.** `#left-toolbar`, `#utility-rail`, `#right-dock` and `#dock-workspace-generate` keep their own layout; only sections inside them scroll (`panel-body`, flyout body, swatch list, brush palette, history list).
   - NEVER create `#left-rail`, `#workspaceSwitcher`, `#btnContextGenerator`, `#dock-workspace-edit`, or a `#dockTabs` strip.
   - The control registry consists of **exactly 60 frozen control IDs**; new rail/flyout buttons are additive IDs, never replacements.

3. **Persistence and Snapshots:**
   - Canonical localStorage key: `tiling_stripes_studio_v3_state` (NEVER v2).
   - IndexedDB database: `TilingStripesDB_v1` / store: `studio_state`.
   - Undo snapshots between generations must use `DocumentSnapshot.collectParams` and `DocumentSnapshot.attachDocument`.
   - The 8 pure persistence functions in `core/state_persistence.js` must remain exported.

4. **Canonical Shortcuts:**
   - `V`: Inspect (neutral tool; generation panels stay in the static dock)
   - `B`: Brush | `E`: Eraser (Tile #84) | `R`: Rotate | `S`: Stamp (`C` captures) | `F`: Freeze (`Shift+F` clears)
   - `H` or `Space`: Pan | `Z`: Zoom | `1` / `Shift+1`: 100% centered | `0`: Fit to window
   - `Q` / `Tab`: Cycle symmetry scopes (1..6)
   - `Ctrl+U`: Snap to block | `Shift` (hold): Momentary snap invert
   - `Ctrl+Z` / `Ctrl+Shift+Z`: Undo and redo

5. **Spout Real-Time Output:**
   - Rendered offscreen in a dedicated `p5.Graphics` at native artboard dimensions (clean buffer: no zoom, no guides, no hover ghosts).
   - Frame broadcast via WebSocket `ws://127.0.0.1:8766` with `artifactSignature` frame deduplication.

6. **Documentation Synchronization:**
   - `README.md` and `docs/MANUAL_MANUTENCAO.md` must stay in 100% sync with code contracts.

7. **Interface Microcopy:**
   - No explaining sentence in the permanent chrome: icon first, then the shortest intuitive name.
   - Full name on hover (`title`/`data-tooltip`); detail behind an info trigger (`data-info-topic` → `INFO_TOPICS` in `ui_info.js`) or the Ajuda menu.
   - Warnings appear only when a state blocks an action and say only what is needed; dialogs (`role="dialog"`) may explain themselves.
   - `node tests/test_ui_microcopy.js` fails any static label above 64 characters, a control whose name precedes its icon, or an info trigger without a topic.

---

## 2. Verification Protocol (Pre-flight and Post-flight)

Execute the full automated test suite using Node.js:

```powershell
node tests/run_all.js
```

### Acceptance Criteria:
* Exit code MUST be `0`.
* All test suites MUST output `PASSED` (currently 60 suites, including `test_ui_microcopy.js`).
* If any test fails, inspect the failing suite individually:
  ```powershell
  node tests/<suite_name>.js
  ```
* Revert or fix deviations immediately before finishing any turn.
