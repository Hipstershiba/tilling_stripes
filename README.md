# Tiling Stripes Pattern Generator

Interactive generative art tool for creating mirrored tiling compositions with editable subtiles, scoped transformations, and export workflows.

## What’s New in This Version

- Added full **Edit History** with UI buttons and keyboard shortcuts:
	- Undo: `Ctrl + Z`
	- Redo: `Ctrl + Shift + Z`
- Improved edit reliability during drag interactions and fixed multiple hit-test/mirroring edge cases.
- Refined **Target Scope** UX (icons + tooltips) and added live preview of affected tiles while hovering.
- Fixed `Grid Position` behavior across mirrored canvas halves.
- Restored stable behavior for `Symmetry (4x)` scope after scope-mapping updates.

## Core Features

- **Seed-based Generation**: Deterministic compositions using seed input + randomize.
- **Tile Type Filtering**: Select which tile families are allowed in generation.
- **Symmetric Grid Construction**: Supertiles mirrored across the composition.
- **Edit Tools**:
	- `Rotate` (cycle/randomize families)
	- `Paint` (apply selected tile type with transform-aware mapping)
- **Target Scopes**:
	- `Single Tile`
	- `Block (2x2)`
	- `Global Match`
	- `Grid Position`
	- `Symmetry (4x)`
- **History Systems**:
	- Generation history (seed/grid states)
	- Edit history (undo/redo snapshots)
- **Export**:
	- PNG save
	- SVG save

## Running Locally

Open [index.html](index.html) in your browser.

No build step is required.

## Main Controls

- **Canvas**: width, height, fit-to-screen, fit-to-grid, fullscreen.
- **Grid**: rows, columns, margin, ratio locks.
- **Seed**: input + randomize + generation history navigation.
- **Edit Panel**: tool mode, target scope, paint palette, undo/redo.

## Notes

- For best results when editing, keep the `Edit` tab active and use hover preview to confirm scope impact before drag operations.
- If you are reviewing changes between versions, see PR description for a complete change summary.
