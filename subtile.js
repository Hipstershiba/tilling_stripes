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
        if (this.type == 0) {
            this.type0(ctx);
        }
        else if (this.type == 1) {
            this.type1(ctx);
        }
        else if (this.type == 2) {
            this.type2(ctx);
        }
        else if (this.type == 3) {
            this.type3(ctx);
        }
        else if (this.type == 4) {
            this.type4(ctx);
        }
        else if (this.type == 5) {
            this.type5(ctx);
        }
        else if (this.type == 6) {
            this.type6(ctx);
        }
        else if (this.type == 7) {
            this.type7(ctx);
        }
        else if (this.type == 8) {
            this.type8(ctx);
        }
        else if (this.type == 9) {
            this.type9(ctx);
        }
        else if (this.type == 10) {
            this.type10(ctx);
        }
        else if (this.type == 11) {
            this.type11(ctx);
        }
        else if (this.type == 12) {
            this.type12(ctx);
        }
        else if (this.type == 13) {
            this.type13(ctx);
        }
        ctx.pop();
    }

    type0(ctx) {
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(
            -this.w/2 + this.padding,
            -this.h/2 + this.padding,
            this.w/2 - this.padding,
            this.h - this.padding*2
        );
        ctx.ellipse(
            this.w/4,
            0, 
            this.w/2 - this.padding*2,
            this.h/2 - this.padding*2
        );
    }

    type1(ctx) {
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(
            0,
            -this.h/2 + this.padding,
            this.w/2 - this.padding,
            this.h - this.padding*2
        )
        ctx.ellipse(
            -this.w/4,
            0, 
            this.w/2 - this.padding*2,
            this.h/2 - this.padding*2
        );
    }

    type2(ctx) {
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(
            -this.w/2 + this.padding,
            -this.h/2 + this.padding,
            this.w - this.padding*2,
            this.h/2 - this.padding
        )
        ctx.ellipse(
            0,
            this.h/4, 
            this.w/2 - this.padding*2,
            this.h/2 - this.padding*2
        );
    }

    type3(ctx) {
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(
            -this.w/2 + this.padding,
            -this.h/2 + this.padding,
            this.w - this.padding*2,
            this.h/2 - this.padding
        )
        ctx.ellipse(
            0,
            this.h/4, 
            this.w/2 - this.padding*2,
            this.h/2 - this.padding*2
        );
    } 

    type4(ctx) {
        // Triangle top-left
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, -this.h/2 + this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    type5(ctx) {
        // Triangle center pointing up
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            0, -this.h/2 + this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    type6(ctx) {
        // Two horizontal stripes
        ctx.fill(this.color);
        ctx.noStroke();
        let stripeH = (this.h - this.padding*2) / 3;
        ctx.rect(
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            this.w - this.padding*2, stripeH
        );
        ctx.rect(
            -this.w/2 + this.padding, -this.h/2 + this.padding + stripeH * 2,
            this.w - this.padding*2, stripeH
        );
    }

    type7(ctx) {
        // Cross
        ctx.fill(this.color);
        ctx.noStroke();
        let thicknessX = (this.w - this.padding*2) / 3;
        let thicknessY = (this.h - this.padding*2) / 3;
        // Vertical
        ctx.rect(
            -thicknessX/2, -this.h/2 + this.padding,
            thicknessX, this.h - this.padding*2
        );
        // Horizontal
        ctx.rect(
            -this.w/2 + this.padding, -thicknessY/2,
            this.w - this.padding*2, thicknessY
        );
    }

    type8(ctx) {
        // Checkers 2x2
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2)/2;
        let h = (this.h - this.padding*2)/2;
        
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding, w, h);
        ctx.rect(0, 0, w, h);
    }

    type9(ctx) {
        // Diamond
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2)/2;
        let h = (this.h - this.padding*2)/2;
        ctx.beginShape();
        ctx.vertex(0, -h); 
        ctx.vertex(w, 0); 
        ctx.vertex(0, h); 
        ctx.vertex(-w, 0);
        ctx.endShape(CLOSE);
    }

    type10(ctx) {
        // Target
        ctx.noFill();
        ctx.stroke(this.color);
        let weight = min(this.w, this.h) / 20;
        ctx.strokeWeight(weight);
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        ctx.ellipse(0, 0, w, h);
        ctx.ellipse(0, 0, w*0.6, h*0.6);
        ctx.ellipse(0, 0, w*0.2, h*0.2);
    }

    type11(ctx) {
        // Dots
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2);
        let h = (this.h - this.padding*2);
        let d = min(w, h) * 0.2;
        let ox = w/4;
        let oy = h/4;
        ctx.ellipse(-ox, -oy, d, d);
        ctx.ellipse(ox, -oy, d, d);
        ctx.ellipse(-ox, oy, d, d);
        ctx.ellipse(ox, oy, d, d);
    }

    type12(ctx) {
        // Half Diag 1
        ctx.fill(this.color);
        ctx.noStroke();
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        ctx.triangle(-w/2, -h/2, -w/2, h/2, w/2, h/2);
    }

    type13(ctx) {
        // Half Diag 2
        ctx.fill(this.color);
        ctx.noStroke();
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        ctx.triangle(-w/2, -h/2, w/2, -h/2, w/2, h/2);
    }
}