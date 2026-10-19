// TILE_TRANSFORMS maps tile IDs to their transformed counterparts.
// Used to compensate for mirroring when painting specific tiles.
//
// For a given tile ID 't', TILE_TRANSFORMS[t].flipX gives the ID of the tile
// that results from flipping 't' horizontally.
//
// We need the INVERSE operation: "I want tile T to appear. What tile S should I
// put so S flipped becomes T?" Conveniently, flipping is its own inverse
// (FlipX(FlipX(T)) = T). So the map works both ways.
//
// SOURCE OF TRUTH: tile_registry.js sets window.TILE_TRANSFORMS during bootstrap.
// This file simply re-exposes it and provides the lookup helper.

const TILE_TRANSFORMS =
    (typeof window !== 'undefined' && window.TILE_TRANSFORMS)
        ? window.TILE_TRANSFORMS
        : {};

/**
 * Given a desired tile ID and a flip configuration, returns the tile ID that
 * should actually be placed so that after mirroring it appears as the desired one.
 *
 * @param {number} tileId - The tile we want to see after mirroring.
 * @param {boolean} flipX - Whether the quadrant is flipped horizontally.
 * @param {boolean} flipY - Whether the quadrant is flipped vertically.
 * @returns {number} The tile ID to place.
 */
function getTransformedTile(tileId, flipX, flipY) {
    const entry = TILE_TRANSFORMS[tileId];
    if (!entry) return tileId; // Unknown tile, return as is

    // Net transformation:
    // If only X: return .x
    // If only Y: return .y
    // If both: return .xy
    // If none: return tileId
    if (flipX && flipY) return entry.xy;
    if (flipX) return entry.x;
    if (flipY) return entry.y;
    return tileId;
}