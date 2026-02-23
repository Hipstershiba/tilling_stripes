class Tile {
    constructor(x, y, w, h, types) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.types = types;
        this.subtiles = [];
        this.buffer = createGraphics(this.w, this.h);
        this.create_subtiles();
        this.render_to_buffer();
    }

    create_subtiles() {
        // let subtileColor = color(random(256), random(256), random(256));
        let subtileW = this.w / 2;
        let subtileH = this.h / 2;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                let subtile = new Subtile(
                    subtileW,
                    subtileH,
                    this.types[i * 2 + j]
                );
                // subtile.set_color(subtileColor);
                this.subtiles.push(subtile);
            }
        }
    }

    render_to_buffer() {
        // We draw relative to the center of the buffer
        this.buffer.translate(this.w / 2, this.h / 2);
        for (let i = 0; i < this.subtiles.length; i++) {
            this.subtiles[i].render(
                this.buffer,
                (i % 2 - 0.5) * this.w / 2,
                (floor(i / 2) - 0.5) * this.h / 2
            );
        }
    }

    render(x, y) {
        // If x, y are provided, use them, otherwise use stored pos (but stored pos is center)
        let drawX = x !== undefined ? x : this.x;
        let drawY = y !== undefined ? y : this.y;
        
        imageMode(CENTER);
        image(this.buffer, drawX, drawY);
    }

    set_pos(x, y) {
        this.x = x;
        this.y = y;
    }

}