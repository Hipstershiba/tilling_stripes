// TILE_TRANSFORMS maps tile IDs to their transformed counterparts.
// Used to compensate for mirroring when painting specific tiles.

// For a given tile ID 't', TILE_TRANSFORMS[t].flipX gives the ID of the tile that results from flipping 't' horizontally.
// We need the INVERSE operation: "I want tile T to appear. What tile S should I put so S flipped becomes T?"
// Conveniently, flipping is its own inverse (FlipX(FlipX(T)) = T). So the map works both ways.

const TILE_TRANSFORMS = (() => {
    const map = {};
    
    // Helper to register a set of transforms
    // symmetry: 'none', 'x', 'y', 'xy', 'all'
    function register(id, symType, ...others) {
        map[id] = { x: id, y: id, xy: id };
        
        if (symType === 'all') { // Fully symmetric (e.g. circle)
            // Default is already identity
        } 
        else if (symType === 'horizontal_pair') { // e.g. Left/Right pair. 0<->1
            let [pairId] = others;
            map[id].x = pairId;
            map[id].xy = pairId; 
            // Y flip usually keeps it same side for vertical-neutral shapes
        }
        else if (symType === 'vertical_pair') { // e.g. Top/Bottom pair. 2<->3
            let [pairId] = others;
            map[id].y = pairId;
            map[id].xy = pairId;
        }
        else if (symType === 'four_way') { // e.g. Corners. 4(TL), 5(TR), 6(BL), 7(BR)
            // We need to know specific relative positions to define the partner
            // Let's define manual mapping instead for complex groups
        }
    }

    // Manual Definitions based on tile_registry.js

    // Group 1: Half Rect + Circle
    // 0: Left, 1: Right. (Mirror X swaps them)
    // 2: Top, 3: Bottom. (Mirror Y swaps them)
    // Note: 0 mirrored Y is still 0. 2 mirrored X is still 2.
    map[0] = { x: 1, y: 0, xy: 1 };
    map[1] = { x: 0, y: 1, xy: 0 };
    map[2] = { x: 2, y: 3, xy: 3 }; 
    map[3] = { x: 3, y: 2, xy: 2 };

    // Group 2: Corner Triangles
    // 4: TL, 5: TR, 6: BL, 7: BR
    map[4] = { x: 5, y: 6, xy: 7 }; 
    map[5] = { x: 4, y: 7, xy: 6 };
    map[6] = { x: 7, y: 4, xy: 5 };
    map[7] = { x: 6, y: 5, xy: 4 };

    // Group 3: Side Triangles
    // 8: Left, 9: Right
    // 10: Top, 11: Bottom
    map[8] = { x: 9, y: 8, xy: 9 };
    map[9] = { x: 8, y: 9, xy: 8 };
    map[10] = { x: 10, y: 11, xy: 11 };
    map[11] = { x: 11, y: 10, xy: 10 };

    // Group 4: Symmetric
    // 12, 13, 14, 15 are all fully symmetric
    [12, 13, 14, 15].forEach(i => {
        map[i] = { x: i, y: i, xy: i };
    });

    // Group 5: Checkers
    // 16: TL/BR, 17: TR/BL
    // 16 FlipX -> TR/BL (17). FlipY -> TR/BL (17). FlipXY -> TL/BR (16)
    map[16] = { x: 17, y: 17, xy: 16 };
    map[17] = { x: 16, y: 16, xy: 17 };

    // Group 6: Stripes
    // 18: Horz (Sym X, Sym Y)
    // 19: Vert (Sym X, Sym Y)
    map[18] = { x: 18, y: 18, xy: 18 };
    map[19] = { x: 19, y: 19, xy: 19 };

    // Group 7: Waves (Corners)
    // 20: TL, 21: TR, 22: BR, 23: BL  <-- Note order in registry might differ
    // Registry: 20:TL, 21:TR, 22:BR, 23:BL. Correct.
    // Wait, let's double check registry for 22/23.
    // 22: Waves Bottom Right
    // 23: Waves Bottom Left
    map[20] = { x: 21, y: 23, xy: 22 };
    map[21] = { x: 20, y: 22, xy: 23 };
    map[22] = { x: 23, y: 21, xy: 20 }; // BR FlipX -> BL. FlipY -> TR.
    map[23] = { x: 22, y: 20, xy: 21 }; // BL FlipX -> BR. FlipY -> TL.

    // Group 8: Zigzag
    // 24: Horz, 25: Vert
    map[24] = { x: 24, y: 24, xy: 24 }; // Assuming symmetric enough or irrelevant phase
    map[25] = { x: 25, y: 25, xy: 25 };

    // Group 9: Bowtie/Hourglass
    // 26: Bowtie (Horz), 27: Hourglass (Vert)
    map[26] = { x: 26, y: 26, xy: 26 };
    map[27] = { x: 27, y: 27, xy: 27 };

    // Group 10: L-Shape
    // tile_registry order: 28:TL, 29:TR, 30:BR, 31:BL
    map[28] = { x: 29, y: 31, xy: 30 };
    map[29] = { x: 28, y: 30, xy: 31 };
    map[30] = { x: 31, y: 29, xy: 28 };
    map[31] = { x: 30, y: 28, xy: 29 };

    // Group 11: T-Shape
    // 32: Top, 33: Right, 34: Bottom, 35: Left
    // 32(Top) FlipX -> Top(32). FlipY -> Bottom(34). FlipXY -> Bottom(34)
    map[32] = { x: 32, y: 34, xy: 34 };
    map[33] = { x: 35, y: 33, xy: 35 }; // Right FlipX -> Left(35). FlipY -> Right(33)
    map[34] = { x: 34, y: 32, xy: 32 };
    map[35] = { x: 33, y: 35, xy: 33 };

    // Group 12: Diagonal
    // 36: TL-BR (\), 37: TR-BL (/)
    map[36] = { x: 37, y: 37, xy: 36 };
    map[37] = { x: 36, y: 36, xy: 37 };

    // Group 13: Arcs
    // 38: TL, 39: TR, 40: BL, 41: BR
    map[38] = { x: 39, y: 40, xy: 41 };
    map[39] = { x: 38, y: 41, xy: 40 };
    map[40] = { x: 41, y: 38, xy: 39 };
    map[41] = { x: 40, y: 39, xy: 38 };

    // Group 14: Grid
    map[42] = { x: 42, y: 42, xy: 42 };

    // Group 15: Three Dots
    // 43: TopLeft-ish, 44: Custom?
    // Let's assume standard behavior or no-op if unknown
    map[43] = { x: 43, y: 43, xy: 43 }; // Placeholder
    map[44] = { x: 44, y: 44, xy: 44 };

    return map;
})();

function getTransformedTile(tileId, flipX, flipY) {
    if (!TILE_TRANSFORMS[tileId]) return tileId; // Unknown tile, return as is
    
    // Net transformation:
    // If only X: return .x
    // If only Y: return .y
    // If both: return .xy
    // If none: return tileId

    if (flipX && flipY) return TILE_TRANSFORMS[tileId].xy;
    if (flipX) return TILE_TRANSFORMS[tileId].x;
    if (flipY) return TILE_TRANSFORMS[tileId].y;
    return tileId;
}
