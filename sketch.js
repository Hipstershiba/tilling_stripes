let subtiles = [];
let tiles = [];
let rows = 4;
let cols = 4;
let tilesWidth, tilesHeight;
let seed = 0;
let allowedTypes = []; 
let totalTileTypes = (typeof TILE_RENDERERS !== 'undefined') ? TILE_RENDERERS.length : 21;
let margin = 0;

let isCanvasLocked = false;
let isGridLocked = false;
let canvasRatio = 1;
let gridRatio = 1;

// Interaction State
let interactionMode = 'none'; // 'none', 'mirror', 'edit'
let interactionScope = 'single'; // 'single', 'global'
let currentPaintTile = 0;

// Define Tile Families (Manually mapped based on registry groups)
const TILE_FAMILIES = [
    [0, 1, 2, 3],       // Half Rect + Circle
    [4, 5, 6, 7],       // Corner Triangles
    [8, 9, 10, 11],     // Side Triangles
    [12, 13, 14, 15],   // Centered / Symmetric
    [16, 17],           // Checkers
    [18, 19],           // Stripes
    [20, 21, 22, 23],   // Waves
    [24, 25],           // Zigzag
    [26, 27],           // Bowtie/Hourglass
    [28, 29, 30, 31],   // L-Shape
    [32, 33, 34, 35],   // T-Shape
    [36, 37],           // Diagonal
    [38, 39, 40, 41],   // Arcs
    [42],               // Grid (Single)
    [43, 44]            // Three dots
];
// Helper to find next family member
function getNextInFamily(currentType) {
    for (let family of TILE_FAMILIES) {
        let idx = family.indexOf(currentType);
        if (idx !== -1) {
            return family[(idx + 1) % family.length];
        }
    }
    return currentType; // No family found
}

function setup() {
  // Update total types if registry loaded later (unlikely but safe)
  if (typeof TILE_RENDERERS !== 'undefined') {
      totalTileTypes = TILE_RENDERERS.length;
  }
  // Initial canvas creation
  let canvas = createCanvas(600, 600);
  canvas.parent('canvas-container');
  
  // Use existing seed from input if valid, otherwise random
  let seedInput = select('#seedInput');
  if (seedInput && seedInput.value() !== "") {
     let s = parseInt(seedInput.value());
     if (!isNaN(s)) {
        seed = s;
     } else {
        seed = floor(random(10000));
     }
  } else {
     seed = floor(random(10000));
  }
  
  // Initialize UI controls
  setupUI(canvas);

  // Populate tile selector
  generateTileThumbnails();

  // Select all by default
  selectAllTiles();

  // Initial grid generation
  initGrid();
}

function setupUI(mainCanvas) {
  // Bind inputs
  let wInput = select('#canvasW');
  let hInput = select('#canvasH');
  
  // Lock buttons
  let btnLockCanvasRatio = select('#btnLockCanvasRatio');
  let btnLockGridRatio = select('#btnLockGridRatio');

  if (btnLockCanvasRatio) {
    btnLockCanvasRatio.mousePressed(() => {
        isCanvasLocked = !isCanvasLocked;
        btnLockCanvasRatio.html(isCanvasLocked ? '🔒' : '🔓');
        if (isCanvasLocked) {
           let w = parseInt(wInput.value());
           let h = parseInt(hInput.value());
           if (h > 0) canvasRatio = w / h;
        }
    });
  }

  wInput.input(() => {
    let val = parseInt(wInput.value());
    if (val > 0) {
      if (isCanvasLocked) {
        let newH = floor(val / canvasRatio);
        hInput.value(newH);
        resizeCanvasAndUpdate(val, newH);
      } else {
        resizeCanvasAndUpdate(val, height);
      }
    }
  });
  
  hInput.input(() => {
    let val = parseInt(hInput.value());
    if (val > 0) {
      if (isCanvasLocked) {
        let newW = floor(val * canvasRatio);
        wInput.value(newW);
        resizeCanvasAndUpdate(newW, val);
      } else {
        resizeCanvasAndUpdate(width, val);
      }
    }
  });

  let gridRowsInput = select('#gridRows');
  let gridColsInput = select('#gridCols');

  if (btnLockGridRatio) {
     btnLockGridRatio.mousePressed(() => {
        isGridLocked = !isGridLocked;
        btnLockGridRatio.html(isGridLocked ? '🔒' : '🔓');
        if (isGridLocked) {
           let r = parseInt(gridRowsInput.value());
           let c = parseInt(gridColsInput.value());
           if (r > 0) gridRatio = c / r; // cols per row
        }
     });
  }
  
  gridRowsInput.input(() => { 
    let val = parseInt(gridRowsInput.value());
    if (val > 0) {
      rows = val;
      if (isGridLocked) {
         let newCols = floor(rows * gridRatio);
         if (newCols < 1) newCols = 1;
         cols = newCols;
         gridColsInput.value(cols);
      }
      initGrid(); 
    }
  });
  
  gridColsInput.input(() => { 
    let val = parseInt(gridColsInput.value());
    if (val > 0) { 
      cols = val;
      if (isGridLocked) {
        let newRows = floor(cols / gridRatio);
        if (newRows < 1) newRows = 1;
        rows = newRows;
        gridRowsInput.value(rows);
      }
      initGrid(); 
    }
  });
  
  select('#gridMargin').input(() => {
    let val = parseInt(select('#gridMargin').value());
    if (!isNaN(val) && val >= 0) { margin = val; initGrid(); }
  });

  select('#btnFitScreen').mousePressed(fitCanvasToScreen);
  // select('#btnSquareGrid').mousePressed(makeGridSquare); // Removing this one? No, I'll keep both.
  select('#btnFitCanvas').mousePressed(fitCanvasToGrid);
  select('#btnSquareGrid').mousePressed(makeGridSquare);
  select('#btnFullscreen').mousePressed(toggleFullscreen);

  select('#seedInput').value(seed);
  select('#seedInput').input(() => { 
    let val = parseInt(select('#seedInput').value());
    if (!isNaN(val)) { seed = val; initGrid(); }
  });
  
  select('#btnRandomize').mousePressed(() => {
    seed = floor(random(10000));
    select('#seedInput').value(seed);
    initGrid();
  });
  
  // select('#btnRedraw').mousePressed(initGrid); // Removed as it auto-updates
  
  // Use Vanilla JS for save button to ensure reliability
  let btnSave = document.getElementById('btnSave');
  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault(); 
      e.stopPropagation();

      let ratio = (width / height).toFixed(2);
      let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
      let filename = `tilling_stripes_seed-${seed}_${width}x${height}_ratio-${ratio}_${timestamp}.png`;
      
      // Manual save to avoid potential p5.js/browser conflicts
      // mainCanvas is a p5.Element, .elt is the HTML5 canvas
      try {
        let dataURL = mainCanvas.elt.toDataURL('image/png');
        let link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Error saving canvas:", err);
      }
    });
  }

  // Save SVG Logic
  let btnSaveSVG = document.getElementById('btnSaveSVG');
  if (btnSaveSVG) {
    btnSaveSVG.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            // Create off-screen SVG graphics using our custom SimpleSVG context
            let svg = new SimpleSVG(width, height);
            
            // Note: We do NOT draw a background rect here, so the background is transparent.
            // This is ideal for plotting.
            
            // Render all tiles to SVG buffer
            // We pass 'black' (or any dark color) to force high contrast for the plotter
            // regardless of the on-screen colors (which might be white-on-black).
            let exportColor = 'black'; 

            for (let tile of tiles) {
                if (typeof tile.renderVector === 'function') {
                    // Pass export color down the chain
                    tile.renderVector(svg, exportColor);
                } else {
                    console.warn('Tile missing renderVector method');
                }
            }

            let ratio = (width / height).toFixed(2);
            let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
            let filename = `tilling_stripes_seed-${seed}_${width}x${height}_ratio-${ratio}_${timestamp}.svg`;
            
            svg.save(filename);
            
        } catch (err) {
            console.error("Error saving SVG:", err);
            alert("Error saving SVG. See console for details.");
        }
    });
  }

  select('#selectAll').mousePressed(selectAllTiles);
  select('#selectNone').mousePressed(selectNoneTiles);

  // Interaction Logic (Wiring the buttons)
  selectAll('.mode-btn').forEach(btn => {
      btn.mousePressed(() => {
          selectAll('.mode-btn').forEach(b => b.removeClass('active'));
          btn.addClass('active');
          interactionMode = btn.attribute('data-mode');
          console.log('Mode set to:', interactionMode);
          
          let previewContainer = select('#paintTileDisplay'); // Correct ID for paint preview
          let scopeContainer = select('#scopeControl');

          if (interactionMode === 'mirror') {
             if(previewContainer) previewContainer.style('display', 'none');
             if(scopeContainer) scopeContainer.style('display', 'block');
             select('#tileSelector').removeClass('paint-mode');
             generateTileThumbnails(); // Refresh to remove paint highlight
          } else if (interactionMode === 'edit') {
             if(previewContainer) previewContainer.style('display', 'block');
             if(scopeContainer) scopeContainer.style('display', 'block');
             select('#tileSelector').addClass('paint-mode');
             // Refresh thumbnails to show paint selection state if needed
             generateTileThumbnails(); 
          } else {
             if(previewContainer) previewContainer.style('display', 'none');
             if(scopeContainer) scopeContainer.style('display', 'none');
             select('#tileSelector').removeClass('paint-mode');
             generateTileThumbnails(); // Refresh to remove paint highlight
          }
      });
  });
  
  selectAll('.scope-btn').forEach(btn => {
      btn.mousePressed(() => {
          selectAll('.scope-btn').forEach(b => b.removeClass('active'));
          btn.addClass('active');
          interactionScope = btn.attribute('data-scope');
          console.log('Scope set to:', interactionScope);
      });
  });
}

function resizeCanvasAndUpdate(w, h) {
  resizeCanvas(w, h);
  initGrid();
}

function fitCanvasToScreen() {
  // Get container dimensions
  let containerElt = document.getElementById('canvas-container');
  // Use clientWidth/Height accounting for padding (set to 10px in CSS)
  let w = containerElt.clientWidth - 20; 
  let h = containerElt.clientHeight - 20;

  if (w < 100) w = 100;
  if (h < 100) h = 100;
  
  select('#canvasW').value(floor(w));
  select('#canvasH').value(floor(h));
  resizeCanvasAndUpdate(w, h);
}

function windowResized() {
  // Optional: Automatically resize if in fullscreen or a "responsive" mode?
  // For now, let's just make sure the container is handled by CSS.
  // Unless the user wants the canvas content to resize:
  // fitCanvasToScreen(); 
}

function fitCanvasToGrid() {
  if (cols <= 0 || rows <= 0) return;
  
  // Calculate grid ratio
  let gridRatio = cols / rows;
  
  // Fit to width or height?
  // Let's try to maintain the largest dimension
  if (width > height) {
     let newH = width / gridRatio;
     select('#canvasH').value(floor(newH));
     resizeCanvasAndUpdate(width, newH);
  } else {
     let newW = height * gridRatio;
     select('#canvasW').value(floor(newW));
     resizeCanvasAndUpdate(newW, height);
  }
}

function makeGridSquare() {
  let drawW = width - (margin * 2);
  let drawH = height - (margin * 2);

  if (drawH <= 0 || drawW <= 0) return;

  // Let's adjust columns to match rows
  let ratio = drawW / drawH;
  let newCols = max(1, round(rows * ratio));
  
  cols = newCols;
  select('#gridCols').value(cols);
  initGrid();
}

function toggleFullscreen() {
  let body = select('body');
  if (body.hasClass('fullscreen')) {
    body.removeClass('fullscreen');
  } else {
    body.addClass('fullscreen');
  }
}

function generateTileThumbnails() {
  let container = select('#tileSelector');
  container.html(''); // Clear existing

  for (let i = 0; i < totalTileTypes; i++) {
    // Create wrapper div
    let div = createDiv('');
    div.class('tile-option');
    div.attribute('data-type', i);
    
    // Restore selection state from global allowedTypes
    if (allowedTypes.includes(i)) {
        div.addClass('selected');
    }

    // Restore paint selection state only if in Edit Mode
    if (interactionMode === 'edit' && i === currentPaintTile) {
        div.addClass('paint-selected');
    }
    
    // Add tooltip
    if (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) {
        div.attribute('title', `#${i}: ${TILE_NAMES[i]}`);
    } else {
        div.attribute('title', 'Tile #' + i);
    }

    div.parent(container);
    
    // Create a graphics object to render the tile
    let gfx = createGraphics(80, 80);
    // Determine color based on CSS variables or fixed contrast
    // Since background is dark (#2d2d2d), let's use a light color
    let c = color(220); 
    
    let s = new Subtile(80, 80, i);
    s.color = c;
    
    // Subtile renders centered at (0,0), so we translate to center of graphics
    // Note: Render method usually expects context and x,y translation
    s.render(gfx, 40, 40); 
    
    // Convert to image element and append to div
    let img = createImg(gfx.canvas.toDataURL());
    img.style('width', '100%');
    img.style('height', '100%');
    img.style('display', 'block');
    img.parent(div);
    
    // Cleanup graphics
    gfx.remove();

    // Click event
    div.mousePressed(() => {
      // If in Edit Mode, clicking the list sets the paint tile
      if (interactionMode === 'edit') {
          currentPaintTile = parseInt(div.attribute('data-type'));
          
           // Update UI to show selected
           selectAll('.tile-option').forEach(el => el.removeClass('paint-selected'));
           div.addClass('paint-selected');
           
           let name = (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[currentPaintTile]) ? TILE_NAMES[currentPaintTile] : ('#' + currentPaintTile);
           
           // Update Display Name
           let nameLabel = select('#paintTileName');
           if(nameLabel) nameLabel.html(name);

           // Update Display Preview (clone the img)
           let previewBox = select('#paintTilePreview');
           if(previewBox) {
               previewBox.html('');
               let previewImg = createImg(img.attribute('src'));
               previewImg.style('width', '100%');
               previewImg.style('height', '100%');
               previewImg.parent(previewBox);
           }

           return;
      }

      // Normal behavior: Toggle allowed types
      if (div.hasClass('selected')) {
        div.removeClass('selected');
      } else {
        div.addClass('selected');
      }
      updateAllowedTypes();
      initGrid();
    });
  }
}

function selectAllTiles() {
  let options = selectAll('.tile-option');
  for (let opt of options) {
    opt.addClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function selectNoneTiles() {
  let options = selectAll('.tile-option');
  for (let opt of options) {
    opt.removeClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function updateAllowedTypes() {
  allowedTypes = [];
  let options = selectAll('.tile-option');
  for (let opt of options) {
    if (opt.hasClass('selected')) {
      allowedTypes.push(parseInt(opt.attribute('data-type')));
    }
  }
}

function initGrid() {
  randomSeed(seed);
  
  if (allowedTypes.length === 0) {
      tiles = [];
      background(0);
      return; 
  }

  // Calculate dimensions with margin
  let drawW = width - (margin * 2);
  let drawH = height - (margin * 2);
  
  if (drawW <= 0 || drawH <= 0) {
      tilesWidth = 0;
      tilesHeight = 0;
  } else {
      tilesWidth = drawW / cols;
      tilesHeight = drawH / rows;
  }

  tiles = [];
  
  // Create a 2D array to hold supertiles for reference
  let grid = new Array(cols).fill(0).map(() => new Array(rows));

  // Determine the center indices for symmetry.
  let centerX = ceil(cols / 2);
  let centerY = ceil(rows / 2);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      
      let x = margin + j * tilesWidth + tilesWidth / 2;
      let y = margin + i * tilesHeight + tilesHeight / 2;
      
      // Determine the source coordinates. 
      // Maps bottom/right quadrants to top-left quadrant indices
      let sourceI = i < centerY ? i : rows - 1 - i;
      let sourceJ = j < centerX ? j : cols - 1 - j;
      
      if (i === sourceI && j === sourceJ) {
        // This is a source tile (Top-Left quadrant or center axes)
        let supertile = new Supertile(x, y, tilesWidth, tilesHeight, allowedTypes);
        grid[j][i] = supertile;
        tiles.push(supertile);
      } else {
        // This is a mirrored tile. 
        // We reuse the types from the source tile to ensure symmetry.
        let sourceTile = grid[sourceJ][sourceI];
        
        let supertile = new Supertile(x, y, tilesWidth, tilesHeight, allowedTypes);
        
        // Force the same types as the source
        if (sourceTile) {
            supertile.types = [...sourceTile.types];
            // Re-create the baseTile component with these specific types
            // The constructor created a random one, we discard it and make a matching one.
            supertile.baseTile = new Tile(0, 0, supertile.w/2, supertile.h/2, supertile.types);
        }
        
        // Mark for mirroring in render
        supertile.mirrorX = (j >= cols / 2); 
        supertile.mirrorY = (i >= rows / 2); 
        
        tiles.push(supertile);
        grid[j][i] = supertile; 
      }
    }
  }
  
  redraw();
}

function draw() {
  background(0);
  for (let tile of tiles) {
    if (tile.render) {
        tile.render();
    }
  }
  noLoop(); 
}

function mousePressed() {
    // Only interact if click is on canvas
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    
    // Ignore clicks if mode is none
    if (interactionMode === 'none') return;
    
    console.log("Click detected at:", mouseX, mouseY);
    handleTileClick(mouseX, mouseY);
}

function handleTileClick(mx, my) {
    console.log("handleTileClick", mx, my);
    // 1. Determine Grid Col/Row
    if (mx < margin || mx > width - margin || my < margin || my > height - margin) return;

    let relativeX = mx - margin;
    let relativeY = my - margin;

    let col = floor(relativeX / tilesWidth);
    let row = floor(relativeY / tilesHeight);

    console.log("Col/Row:", col, row);

    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    // 2. Get the Supertile
    let index = row * cols + col;
    if (index >= tiles.length) return;
    let supertile = tiles[index];

    // 3. Determine Quadrant within Supertile
    // Supertile x,y is centered. 
    // Wait, supertile.x is center? 
    // Let's check initGrid: x = margin + j * tilesWidth + tilesWidth / 2; Yes.
    
    let stLeft = supertile.x - supertile.w/2;
    let stTop = supertile.y - supertile.h/2;
    
    let localX = mx - stLeft;
    let localY = my - stTop;
    
    // 0: TL, 1: TR, 2: BL, 3: BR
    // Logic matches Supertile render order or create_subtiles order?
    // Supertile renders: TL, TR, BL, BR
    // But Supertile transforms rendering. 
    // The BaseTile has 4 subtiles: 0 (TL), 1 (TR), 2 (BL), 3 (BR)
    // We need to map the Click Quadrant to the BaseTile Subtile Index, accounting for Supertile mirroring.

    // Determine visual quadrant (0=TL, 1=TR, 2=BL, 3=BR)
    let qCol = localX > supertile.w/2 ? 1 : 0;
    let qRow = localY > supertile.h/2 ? 1 : 0;
    let visualQuadrant = qRow * 2 + qCol;

    // Now, which subtile of the *BaseTile* is displayed in this visual quadrant?
    // BaseTile also has 4 subtiles (TL, TR, BL, BR).
    // Supertile transformations:
    // TL (Visual 0): Normal. Maps to BaseTile Quadrant logic directly?
    //    BaseTile renders at -w/4, -h/4. 
    //    And within BaseTile, it renders subtiles at offsets.
    
    // Let's simplify:
    // We have visual quadrant of Supertile (0,1,2,3).
    // Within that quadrant, we are looking at a transformed BaseTile.
    // Calculate local coord *within* that quadrant to find which *part* of the BaseTile we clicked.
    
    let quadrantX = localX % (supertile.w/2);
    let quadrantY = localY % (supertile.h/2);
    
    // BaseTile is w/2 x h/2.
    // Subtiles are w/4 x h/4.
    // So within a quadrant (size w/2 x h/2), there are 2x2 subtiles.
    
    let subCol = quadrantX > (supertile.w/4) ? 1 : 0;
    let subRow = quadrantY > (supertile.h/4) ? 1 : 0;
    
    // We need to account for the Supertile Flip to find the *original* base tile index.
    
    let targetSubCol = subCol;
    let targetSubRow = subRow;
    
    // Visual Quadrant 1 (TR): Flipped X (Right side of SuperTile)
    if (visualQuadrant === 1) { 
        targetSubCol = 1 - subCol; 
    }
    
    // Visual Quadrant 2 (BL): Flipped Y (Bottom side of SuperTile)
    if (visualQuadrant === 2) { 
        targetSubRow = 1 - subRow; 
    }

    // Visual Quadrant 3 (BR): Flipped X AND Y
    if (visualQuadrant === 3) {
        targetSubCol = 1 - subCol;
        targetSubRow = 1 - subRow;
    }
    
    let baseTileSubtileIndex = targetSubRow * 2 + targetSubCol;
    console.log("VisualQ", visualQuadrant, "TargetSub", targetSubCol, targetSubRow, "Index", baseTileSubtileIndex);
    
    // Now we know which index in supertile.types (or baseTile.types) we want to modify.
    // supertile.types is array of 4 ints.
    
    let oldType = supertile.types[baseTileSubtileIndex];
    let newType = oldType;
    
    if (interactionMode === 'mirror') {
        newType = getNextInFamily(oldType);
    } else if (interactionMode === 'edit') {
        newType = currentPaintTile;
    }
    
    console.log("OldType", oldType, "NewType", newType, "Mode", interactionMode);

    if (oldType === newType && interactionMode !== 'edit') return; // No change unless forced edit (though normally edit checks too)
    
    // Apply Change
    if (interactionScope === 'single') {
        
        // Update the type
        supertile.types[baseTileSubtileIndex] = newType;
        
        // Re-create the baseTile to reflect visual changes
        // Use slice() to ensure we pass a copy, though Tile constructor references it.
        // Actually, let's explicitely use the modified types array.
        if(supertile.baseTile) {
             // If baseTile has a buffer, we might want to manually clear it?
             // But the new Tile() creates a new buffer.
             // Let's verify if p5.js manages this memory well. 
             // In JS, GC handles it.
             supertile.baseTile.buffer.remove(); // Explicitly remove p5 graphics to prevent memory leaks/glitches
        }
        supertile.baseTile = new Tile(0, 0, supertile.w/2, supertile.h/2, [...supertile.types]);

    } else {

        // Let's implement global replace by Type.
        // We need to be careful. Global Replace replaces ALL instances of OldType with NewType across the board?
        // Or per position?
        // User asked for "Global Scope". Usually means "Change this tile everywhere".
        
        // But here we are changing a SUBTILE type.
        // So we should find all subtiles of OldType and change them to NewType?
        // That's usually what "Global Paint" means.
        
        for (let s of tiles) {
            let changed = false;
            // Iterate over all 4 subtiles of this Supertile
            for (let i = 0; i < 4; i++) {
                if (s.types[i] === oldType) {
                    s.types[i] = newType;
                    changed = true;
                }
            }
            if (changed) {
                if(s.baseTile) s.baseTile.buffer.remove();
                s.baseTile = new Tile(0, 0, s.w/2, s.h/2, [...s.types]);
            }
        }
    }
    
    redraw();
}
