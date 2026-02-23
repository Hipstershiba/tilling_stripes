class Supertile {
    // the super tile is a 2x2 grid of tiles,
    // the top left tile is normal, the top right tile is flipped horizontally, the bottom left tile is flipped vertically, and the bottom right tile is flipped both horizontally and vertically
    constructor(x, y, w, h, allowedTypes) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.allowedTypes = allowedTypes;
        this.types = [];
        this.gen_types();
        // Create only one base tile centered at 0,0 locally
        this.baseTile = new Tile(0, 0, this.w/2, this.h/2, this.types);
        this.mirrorX = false;
        this.mirrorY = false;
    }

    gen_types() {
        for (let i = 0; i < 4; i++) {
            if (this.allowedTypes && this.allowedTypes.length > 0) {
                this.types.push(random(this.allowedTypes));
            } else {
                let limit = (typeof TILE_RENDERERS !== 'undefined') ? TILE_RENDERERS.length : 21;
                this.types.push(floor(random(limit)));
            }
        }
    }   

    render() {
        push();
        translate(this.x, this.y);
        
        // Apply Global Mirroring
        if (this.mirrorX) scale(-1, 1);
        if (this.mirrorY) scale(1, -1);

        // Top-Left: Normal
        push();
        translate(-this.w/4, -this.h/4);
        this.baseTile.render();
        pop();

        // Top-Right: Flipped Horizontally
        push();
        translate(this.w/4, -this.h/4);
        scale(-1, 1);
        this.baseTile.render();
        pop();

        // Bottom-Left: Flipped Vertically
        push();
        translate(-this.w/4, this.h/4);
        scale(1, -1);
        this.baseTile.render();
        pop();

        // Bottom-Right: Flipped Both
        push();
        translate(this.w/4, this.h/4);
        scale(-1, -1);
        this.baseTile.render();
        pop();

        pop();
    }


}