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
let lastEditTool = 'mirror'; // Default tool for Edit tab
let interactionScope = 'single'; // 'single', 'global'
let currentPaintTile = 0;
let lastInteractedId = null; // Tracks the last tile modified during a drag operation

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
  
  // SVG Icons
  // Unlock: Outline only, shackle lifted
  const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
  // Lock: Filled body for emphasis, shackle closed
  const ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  // Lock buttons
  let btnLockCanvasRatio = select('#btnLockCanvasRatio');
  let btnLockGridRatio = select('#btnLockGridRatio');

  if (btnLockCanvasRatio) {
    btnLockCanvasRatio.mousePressed(() => {
        isCanvasLocked = !isCanvasLocked;
        btnLockCanvasRatio.html(isCanvasLocked ? ICON_LOCK : ICON_UNLOCK);
        if (isCanvasLocked) {
           btnLockCanvasRatio.addClass('locked');
           let w = parseInt(wInput.value());
           let h = parseInt(hInput.value());
           if (h > 0) canvasRatio = w / h;
        } else {
           btnLockCanvasRatio.removeClass('locked');
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
        btnLockGridRatio.html(isGridLocked ? ICON_LOCK : ICON_UNLOCK);
        if (isGridLocked) {
           btnLockGridRatio.addClass('locked');
           let r = parseInt(gridRowsInput.value());
           let c = parseInt(gridColsInput.value());
           if (r > 0) gridRatio = c / r; // cols per row
        } else {
           btnLockGridRatio.removeClass('locked');
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
  // Initially, assume 'none' if Setup tab is active
  interactionMode = 'none';

  // Listen for Tab Changes
  window.addEventListener('tabChanged', (e) => {
     let tab = e.detail.tab;
     if (tab === 'setup') {
         interactionMode = 'none';
         console.log('Mode set to: none (Setup Tab)');
         // Ensure paint mode Visuals are cleared from allowed tiles if they were there (unlikely due to split)
         select('#tileSelector').removeClass('paint-mode');
     } else if (tab === 'edit') {
         // Restore previous tool or default to Rotate
         interactionMode = lastEditTool;
         console.log('Mode restored to:', interactionMode);
         updateEditUI();
     }
  });

  selectAll('.tool-btn').forEach(btn => {
      btn.mousePressed(() => {
          interactionMode = btn.attribute('data-mode');
          lastEditTool = interactionMode;
          console.log('Tool set to:', interactionMode);
          updateEditUI();
      });
  });
  
  // Set initial UI state
  updateEditUI();
  
  // Scope Descriptions
  const SCOPE_DESCRIPTIONS = {
    'single': '<strong style="color: #fff;">Single Tile</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update only the tile you click.</span>',
    'supertile': '<strong style="color: #fff;">Block (2x2)</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update the entire 2x2 group.</span>',
    'global_exact': '<strong style="color: #fff;">Global Match</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update ALL tiles of this type entirely.</span>',
    'global_pos': '<strong style="color: #fff;">Grid Position</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update this specific slot in ALL blocks.</span>',
    'global_pos_sym': '<strong style="color: #fff;">Symmetry (4x)</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update all 4 symmetric slots in ALL blocks.</span>'
  };

  // Set initial tooltip
  select('#scopeDesc').html(SCOPE_DESCRIPTIONS['single']);

  selectAll('.scope-btn').forEach(btn => {
      // Click Handler
      btn.mousePressed(() => {
          selectAll('.scope-btn').forEach(b => b.removeClass('active'));
          btn.addClass('active');
          interactionScope = btn.attribute('data-scope');
          console.log('Scope set to:', interactionScope);
          
          // Update description
          let descDiv = select('#scopeDesc');
          if(descDiv && SCOPE_DESCRIPTIONS[interactionScope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[interactionScope]);
          }
      });

      // Hover Effects for Description
      btn.mouseOver(() => {
           let scope = btn.attribute('data-scope');
           let descDiv = select('#scopeDesc');
           if(descDiv && SCOPE_DESCRIPTIONS[scope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[scope]);
           }
      });
      
      btn.mouseOut(() => {
           // Revert to active scope description
           let descDiv = select('#scopeDesc');
           if(descDiv && SCOPE_DESCRIPTIONS[interactionScope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[interactionScope]);
           }
      });
  });
}

function updateEditUI() {
    let previewContainer = select('#paintTileDisplay'); 
    let scopeContainer = select('#scopeControl');

    // Update animated toggle state
    // Use vanilla JS to ensure attribute update works reliably for CSS
    let toolSwitch = document.querySelector('.tool-switch');
    if (toolSwitch) {
        toolSwitch.setAttribute('data-active', interactionMode);
    }
    
    // Ensure correct active state on buttons (for text color)
    // Clear all first
    selectAll('.tool-btn').forEach(b => b.removeClass('active'));
    
    if (interactionMode === 'mirror') {
        select('#modeMirror').addClass('active');
    } else if (interactionMode === 'edit') {
        select('#modeEdit').addClass('active');
    }

    // Logic-dependent visibility
    if (interactionMode === 'edit') {
        if(previewContainer) previewContainer.style('display', 'flex'); 
        if(scopeContainer) scopeContainer.style('display', 'block');
    } else if (interactionMode === 'mirror') {
        if(previewContainer) previewContainer.style('display', 'none');
        if(scopeContainer) scopeContainer.style('display', 'block');
    } else {
        // None/View
        if(previewContainer) previewContainer.style('display', 'none');
    }
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
    createAllowedTilesList();
    createBrushList(); 
}

function createBrushList() {
    let container = select('#brushList');
    if (!container) return; // Element might not exist if HTML isn't updated
    
    container.html('');
    
    for (let i = 0; i < totalTileTypes; i++) {
        let div = createDiv('');
        div.class('tile-option');
        div.attribute('data-type', i);
        div.style('width', '40px');
        div.style('height', '40px');
        
        // Highlight active brush
        if (i === currentPaintTile) {
            div.addClass('paint-selected');
        }
        
        // Tooltip
        let tooltip = (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) ? `#${i}: ${TILE_NAMES[i]}` : `Tile #${i}`;
        div.attribute('title', tooltip);
        
        div.parent(container);
        
        // Render Thumbnail
        let gfx = createGraphics(40, 40);
        let c = color(220);
        let s = new Subtile(40, 40, i);
        s.color = c;
        s.render(gfx, 20, 20); // Render centered
        
        let img = createImg(gfx.canvas.toDataURL());
        img.style('width', '100%');
        img.style('height', '100%');
        img.style('display', 'block');
        img.parent(div);
        
        gfx.remove();
        
        // Click Handler (Select Brush)
        div.mousePressed(() => {
            currentPaintTile = i;
            
            // UI Update: Remove active class from all brush items
            // Note: We scope this to #brushList to avoid clearing allowed tiles
            let allBrushes = container.elt.querySelectorAll('.tile-option');
            allBrushes.forEach(el => el.classList.remove('paint-selected'));
            div.addClass('paint-selected');
            
            // Update Preview Info
            let name = (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) ? TILE_NAMES[i] : ('#' + i);
            let nameLabel = select('#paintTileName');
            if(nameLabel) nameLabel.html(name);
            
            let previewBox = select('#paintTilePreview');
            if(previewBox) {
               previewBox.html('');
               let previewImg = createImg(img.attribute('src'));
               previewImg.style('width', '100%');
               previewImg.style('height', '100%'); 
               previewImg.parent(previewBox);
            }
        });
    }
}

function createAllowedTilesList() {
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
  // Only select tiles in the allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
  for (let opt of options) {
    opt.addClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function selectNoneTiles() {
  // Only deselect tiles in the allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
  for (let opt of options) {
    opt.removeClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function updateAllowedTypes() {
  allowedTypes = [];
  // Only collect from allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
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
      // i=0,1,2,3. Maps to 0,1,1,0.
      let sourceI = i < centerY ? i : rows - 1 - i;
      let sourceJ = j < centerX ? j : cols - 1 - j;
      
      // Check if this tile IS the source tile
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
        // CRITICAL FIX: Ensure sourceTile exists before accessing property
        if (sourceTile && sourceTile.tiles) {
             // Copy types for each of the 4 independent quadrant tiles
             for(let k=0; k<4; k++) {
                 if (sourceTile.tiles[k] && sourceTile.tiles[k].types) {
                     supertile.tiles[k].types = [...sourceTile.tiles[k].types];
                     // Recreate buffer since we changed types
                     supertile.tiles[k].subtiles = [];
                     if (supertile.tiles[k].buffer) supertile.tiles[k].buffer.remove();
                     supertile.tiles[k].buffer = createGraphics(supertile.tiles[k].w, supertile.tiles[k].h);
                     supertile.tiles[k].create_subtiles();
                     supertile.tiles[k].render_to_buffer();
                 }
             }
        } else {
            // Fallback: This shouldn't happen if loop order is correct, but just in case
            console.warn(`Source tile missing at ${sourceJ},${sourceI} for target ${j},${i}`);
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
    
    // Reset interaction tracker for new gesture
    lastInteractedId = null;
    
    handleTileClick(mouseX, mouseY);
}

function mouseDragged() {
    // Only interact if drag is on canvas
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
    
    // Ignore clicks if mode is none
    if (interactionMode === 'none') return;
    
    handleTileClick(mouseX, mouseY);
}

function mouseReleased() {
    lastInteractedId = null;
}

function handleTileClick(mx, my) {
    // 1. Determine Grid Col/Row
    if (mx < margin || mx > width - margin || my < margin || my > height - margin) return;

    let relativeX = mx - margin;
    let relativeY = my - margin;

    let col = floor(relativeX / tilesWidth);
    let row = floor(relativeY / tilesHeight);

    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    // 2. Get the Supertile
    let index = row * cols + col;
    if (index >= tiles.length) return;
    let supertile = tiles[index];

    // 3. Determine Quadrant within Supertile
    let stLeft = supertile.x - supertile.w/2;
    let stTop = supertile.y - supertile.h/2;
    
    let localX = mx - stLeft;
    let localY = my - stTop;
    
    // Apply Global Mirroring
    if (supertile.mirrorX) {
        localX = supertile.w - localX;
    }
    if (supertile.mirrorY) {
        localY = supertile.h - localY;
    }

    // Determine Logic Quadrant (which tile in the list)
    let qCol = localX > supertile.w/2 ? 1 : 0;
    let qRow = localY > supertile.h/2 ? 1 : 0;
    let visualQuadrant = qRow * 2 + qCol;

    // Determine sub-coordinate within that quadrant
    let quadrantX = localX % (supertile.w/2);
    let quadrantY = localY % (supertile.h/2);
    
    // Within that w/2 by h/2 area, are we in left/top or right/bottom?
    let subCol = quadrantX > (supertile.w/4) ? 1 : 0;
    let subRow = quadrantY > (supertile.h/4) ? 1 : 0;
    
    // Now map back to the BaseTile's data array indices
    let targetSubCol = subCol;
    let targetSubRow = subRow;
    
    // Quadrant 1 (TR): Flipped X locally
    if (visualQuadrant === 1) targetSubCol = 1 - subCol; 
    
    // Quadrant 2 (BL): Flipped Y locally
    if (visualQuadrant === 2) targetSubRow = 1 - subRow; 

    // Quadrant 3 (BR): Flipped X and Y locally
    if (visualQuadrant === 3) {
        targetSubCol = 1 - subCol;
        targetSubRow = 1 - subRow;
    }
    
    let baseTileSubtileIndex = targetSubRow * 2 + targetSubCol;
    
    // Unique ID for this specific subtile location
    // Format: SupertileIndex | VisualQuadrant | SubtileIndex
    let currentTileId = `${index}-${visualQuadrant}-${baseTileSubtileIndex}`;
    
    // If we are dragging over the same tile, ignore
    if (currentTileId === lastInteractedId) return;
    
    // Update tracker
    lastInteractedId = currentTileId;

    // Determine the actual Tile object we are clicking on
    // visualQuadrant 0=TL, 1=TR, 2=BL, 3=BR
    // This matches the this.tiles array in Supertile
    let targetTile = supertile.tiles[visualQuadrant];
    
    // But wait! If we applied global mirror (supertile.mirrorX), 
    // we flipped the coordinate system, so we are calculating the LOGICAL tile we hit.
    // e.g. If mirrorX is true, and we clicked visual-left, we are hitting logical-right (TR).
    // Our 'visualQuadrant' variable now holds the LOGICAL quadrant index.
    
    // SO, targetTile is indeed supertile.tiles[visualQuadrant].
    // And baseTileSubtileIndex is the index within that tile.
    
    let oldType = targetTile.types[baseTileSubtileIndex];
    let newType = oldType;
    
    if (interactionMode === 'mirror') {
        if (keyIsDown(SHIFT)) {
             // Shift + Click: Randomize (Reseed)
             // Prioritize "Allowed Types" if any are selected, else fully random
             if (allowedTypes && allowedTypes.length > 0) {
                 newType = random(allowedTypes);
             } else {
                 newType = floor(random(totalTileTypes));
             }
        } else {
             // Standard Click: Cycle Family
             newType = getNextInFamily(oldType);
        }
    } else if (interactionMode === 'edit') {
        // WYSIWYG Painting: 
        // Identify the net transformation applied to this position and inverse it.
        
        // 1. Local Quadrant Flip (based on logical quadrant index)
        // 0: None, 1: FlipX, 2: FlipY, 3: FlipXY
        let isFlippedX = (visualQuadrant === 1 || visualQuadrant === 3);
        let isFlippedY = (visualQuadrant === 2 || visualQuadrant === 3);

        // 2. Global Mirror Flip
        // If global mirror is active, the coordinate system is flipped.
        // This affects how the tile is rendered on screen.
        // Note: We already adjusted coordinates to find the logical tile, 
        // but now we need to know the VISUAL transform.
        // A global mirror X means the whole rendering is flipped X.
        if (supertile.mirrorX) isFlippedX = !isFlippedX;
        if (supertile.mirrorY) isFlippedY = !isFlippedY;
        
        // 3. Get the inverse tile
        newType = getTransformedTile(currentPaintTile, isFlippedX, isFlippedY);
    }
    
    // console.log("OldType", oldType, "NewType", newType, "Mode", interactionMode);

    if (oldType === newType && interactionMode !== 'edit') return; 
    
    // Helper to update a single tile instance and redraw/recreate its buffer
    const refreshTile = (tileObj) => {
        tileObj.subtiles = [];
        if(tileObj.buffer) tileObj.buffer.remove();
        tileObj.buffer = createGraphics(tileObj.w, tileObj.h);
        tileObj.create_subtiles();
        tileObj.render_to_buffer();
    };

    // Apply Change based on Scope
    if (interactionScope === 'single') {
        // True Single: Only this quadrant, this subtile
        targetTile.types[baseTileSubtileIndex] = newType;
        refreshTile(targetTile);

    } else if (interactionScope === 'supertile') {
        // Current "Single" behavior: Update mirror-equivalent subtiles in all 4 quadrants of THIS supertile
        for(let t of supertile.tiles) {
            t.types[baseTileSubtileIndex] = newType;
            refreshTile(t);
        }

    } else if (interactionScope === 'global_exact') {
        // Global Exact: Update ALL subtiles that match oldType to newType
        for (let s of tiles) {
            for (let t of s.tiles) {
                let changed = false;
                for (let i = 0; i < 4; i++) {
                    if (t.types[i] === oldType) {
                        t.types[i] = newType;
                        changed = true;
                    }
                }
                if (changed) {
                    refreshTile(t);
                }
            }
        }
    } else if (interactionScope === 'global_pos') {
        // Global Equivalent by Position (Single): 
        // Update the subtile at [visualQuadrant][baseTileSubtileIndex] in ALL supertiles.
        for (let s of tiles) {
            // Use the SAME logical indices we found for the current supertile
            // Note: This maintains the exact same "corner" across the grid, even if some supertiles are mirrored.
            // If the user meant "Visual Position", we'd need to re-calculate based on grid coordinates?
            // But usually "Global Pos" implies structural consistency. 
            // visualQuadrant accounts for the CLICKED supertile's mirroring. 
            // We apply it to other supertiles using the same index.
            let t = s.tiles[visualQuadrant]; 
            t.types[baseTileSubtileIndex] = newType;
            refreshTile(t);
        }
    } else if (interactionScope === 'global_pos_sym') {
        // Global Equivalent by Position (Symmetric / Batch):
        // Update the subtile at this index in ALL quadrants of ALL supertiles.
        // Effectively "Global Supertile" scope.
        for (let s of tiles) {
            for (let t of s.tiles) {
                t.types[baseTileSubtileIndex] = newType;
                refreshTile(t);
            }
        }
    }
    
    redraw();
}
