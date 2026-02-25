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

## Tutorial: Adding New Tiles

The project now supports a registration API in [tile_registry.js](tile_registry.js) so you can add tiles without manually editing multiple arrays.

### 1) Where to add

Open [tile_registry.js](tile_registry.js) and add your tile near the `registerTile(...)` examples at the bottom of the file.

### 2) Simplest case (symmetric tile)

Use this when the tile looks the same after mirror/flip:

```javascript
registerTile({
  name: "Empty Tile",
  family: "utility", // string family label (auto-created if missing)
  symmetric: true,
  render: (ctx, w, h, padding, color) => {
    // draw nothing
  }
});
```

### 3) Tile with custom transforms

Use this when a tile changes under flip and needs explicit mapping:

```javascript
const myTileId = registerTile({
  name: "My Tile",
  family: "custom",
  transforms: {
    x: 'self', // can be 'self' or a numeric tile id
    y: 'self',
    xy: 'self'
  },
  render: (ctx, w, h, padding, color) => {
    // draw commands
  }
});
```

### 4) Creating a family of variants

For oriented sets (for example TL/TR/BR/BL), register each variation and map transforms to each other using their returned IDs.

```javascript
const tl = registerTile({ name: "Corner TL", family: "corner-set", render: (...) => {} });
const tr = registerTile({ name: "Corner TR", family: "corner-set", render: (...) => {} });
const br = registerTile({ name: "Corner BR", family: "corner-set", render: (...) => {} });
const bl = registerTile({ name: "Corner BL", family: "corner-set", render: (...) => {} });

// Optional: override transforms after ids exist
TILE_TRANSFORM_MAP[tl] = { x: tr, y: bl, xy: br };
TILE_TRANSFORM_MAP[tr] = { x: tl, y: br, xy: bl };
TILE_TRANSFORM_MAP[br] = { x: bl, y: tr, xy: tl };
TILE_TRANSFORM_MAP[bl] = { x: br, y: tl, xy: tr };
```

### 5) Family parameter notes

- `family: "name"` → creates/uses a labeled family automatically.
- `family: 3` → uses existing numeric family index.

### 6) Validation checklist

After adding tiles:

- Reload browser and confirm tile appears in palette.
- Test `Rotate` cycle behavior (family order).
- Test `Paint` in mirrored areas (transform mapping).
- Test `Grid Position` and `Symmetry (4x)` scopes for expected output.

## Notes

- For best results when editing, keep the `Edit` tab active and use hover preview to confirm scope impact before drag operations.
- If you are reviewing changes between versions, see PR description for a complete change summary.
