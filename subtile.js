class Subtile {
    constructor(w, h, type) {
        this.w = w;
        this.h = h;
        // Padding based on smaller dimension or average? Let's use smaller dimension.
        this.padding = min(w, h) * 0.05;
        this.type = type;
        this.color = color(256, 256, 256);
    }

    set_color(color) {
        this.color = color;
    }

    render(ctx, x, y) {
        ctx.push();
        ctx.translate(x, y);
        
        if (typeof TILE_RENDERERS !== 'undefined' && TILE_RENDERERS[this.type]) {
             TILE_RENDERERS[this.type](ctx, this.w, this.h, this.padding, this.color);
        } else {
            // Fallback or error
            console.warn(`Tile type ${this.type} not found in registry`);
        }

        ctx.pop();
    }
}
