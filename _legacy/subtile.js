const SUBTILE_MAX_SAFE_CHANNEL = 230;
const SUBTILE_DEFAULT_OFFWHITE = [226, 224, 220];

function clampSubtileColorToSafeRange(inputColor) {
    let c = inputColor;
    if (c === undefined || c === null) {
        c = color(SUBTILE_DEFAULT_OFFWHITE[0], SUBTILE_DEFAULT_OFFWHITE[1], SUBTILE_DEFAULT_OFFWHITE[2]);
    }

    let r = red(c);
    let g = green(c);
    let b = blue(c);
    let a = alpha(c);

    let peak = max(r, g, b);
    if (peak > SUBTILE_MAX_SAFE_CHANNEL) {
        let scale = SUBTILE_MAX_SAFE_CHANNEL / peak;
        r *= scale;
        g *= scale;
        b *= scale;
    }

    return color(round(r), round(g), round(b), a);
}

class Subtile {
    constructor(w, h, type) {
        this.w = w;
        this.h = h;
        // Padding based on smaller dimension or average? Let's use smaller dimension.
        this.padding = min(w, h) * 0.05;
        this.type = type;
        this.color = clampSubtileColorToSafeRange(color(255, 255, 255));
    }

    set_color(color) {
        this.color = clampSubtileColorToSafeRange(color);
    }

    render(ctx, x, y, customColor) {
        ctx.push();
        ctx.translate(x, y);
        
        let c = customColor !== undefined ? customColor : clampSubtileColorToSafeRange(this.color);

        if (typeof TILE_RENDERERS !== 'undefined' && TILE_RENDERERS[this.type]) {
             TILE_RENDERERS[this.type](ctx, this.w, this.h, this.padding, c);
        } else {
            // Fallback or error
            console.warn(`Tile type ${this.type} not found in registry`);
        }

        ctx.pop();
    }
}
