class Supertile {
    // the super tile is a 2x2 grid of tiles,
    // the top left tile is normal, the top right tile is flipped horizontally, the bottom left tile is flipped vertically, and the bottom right tile is flipped both horizontally and vertically
    constructor(x, y, w, h, allowedTypes) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.allowedTypes = allowedTypes;

        // We now store 4 independent Tile objects, one for each quadrant.
        // Index 0: TL, 1: TR, 2: BL, 3: BR
        this.tiles = [];

        // Generate the initial "seed" types for symmetry
        let initialTypes = [];
        this.gen_initial_types(initialTypes);

        // Create the 4 tiles, initially identical (symmetry)
        for(let i = 0; i < 4; i++) {
            // Create a COPY of initialTypes so they can diverge later
            this.tiles.push(new Tile(0, 0, this.w/2, this.h/2, [...initialTypes]));
        }

        this.mirrorX = false;
        this.mirrorY = false;
        this.baseTile = this.tiles[0]; // Keep for compatibility if needed, but preferably remove usage
    }

    gen_initial_types(targetArray) {
        for (let i = 0; i < 4; i++) {
            if (this.allowedTypes && this.allowedTypes.length > 0) {
                targetArray.push(random(this.allowedTypes));
            } else {
                let limit = (typeof TILE_RENDERERS !== 'undefined') ? TILE_RENDERERS.length : 21;
                targetArray.push(floor(random(limit)));
            }
        }
    }   

    render() {
        push();
        translate(this.x, this.y);
        
        // Apply Global Mirroring
        if (this.mirrorX) scale(-1, 1);
        if (this.mirrorY) scale(1, -1);

        // Top-Left: Normal (Index 0)
        push();
        translate(-this.w/4, -this.h/4);
        this.tiles[0].render();
        pop();

        // Top-Right: Flipped Horizontally (Index 1)
        push();
        translate(this.w/4, -this.h/4);
        scale(-1, 1);
        this.tiles[1].render();
        pop();

        // Bottom-Left: Flipped Vertically (Index 2)
        push();
        translate(-this.w/4, this.h/4);
        scale(1, -1);
        this.tiles[2].render();
        pop();

        // Bottom-Right: Flipped Both (Index 3)
        push();
        translate(this.w/4, this.h/4);
        scale(-1, -1);
        this.tiles[3].render();
        pop();

        pop();
    }

    renderVector(targetCtx, customColor) {
        targetCtx.push();
        targetCtx.translate(this.x, this.y);
        
        // Apply Global Mirroring
        if (this.mirrorX) targetCtx.scale(-1, 1);
        if (this.mirrorY) targetCtx.scale(1, -1);

        // Top-Left: Normal
        targetCtx.push();
        targetCtx.translate(-this.w/4, -this.h/4);
        this.tiles[0].renderVector(targetCtx, 0, 0, customColor);
        targetCtx.pop();

        // Top-Right: Flipped Horizontally
        targetCtx.push();
        targetCtx.translate(this.w/4, -this.h/4);
        targetCtx.scale(-1, 1);
        this.tiles[1].renderVector(targetCtx, 0, 0, customColor);
        targetCtx.pop();

        // Bottom-Left: Flipped Vertically
        targetCtx.push();
        targetCtx.translate(-this.w/4, this.h/4);
        targetCtx.scale(1, -1);
        this.tiles[2].renderVector(targetCtx, 0, 0, customColor);
        targetCtx.pop();

        // Bottom-Right: Flipped Both
        targetCtx.push();
        targetCtx.translate(this.w/4, this.h/4);
        targetCtx.scale(-1, -1);
        this.tiles[3].renderVector(targetCtx, 0, 0, customColor);
        targetCtx.pop();

        targetCtx.pop();
    }



}