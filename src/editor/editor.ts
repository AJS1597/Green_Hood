import { AssetPaths, SHEETS, SOLID_TILE_HINTS, TILE_COUNT } from '../game/tileset';
import { type Level } from '../game/level';
import { loadLevel, saveLevel } from '../game/levelFile';

/**
 * ============================================================================
 *  LEVEL EDITOR  (open the game with /dev on the end of the URL)
 * ============================================================================
 *
 * A pannable tilemap editor:
 *   - the grid fills the window and is effectively infinite (pan to keep going)
 *   - the palette lists every tile in `sheet.png`
 *   - tools for painting, erasing, collision, and spawn/goal placement
 *   - Save crops the map to the smallest bounding box around everything you
 *     painted, so huge empty areas are never stored
 */

type Tool = 'brush' | 'erase' | 'solid' | 'spawn' | 'goal' | 'pan';

const CELL = 24; // pixels per tile in the editor
const PALETTE_SCALE = 2; // palette tile zoom

const COLOR = {
  background: '#0b1220',
  grid: 'rgba(255,255,255,0.08)',
  gridMajor: 'rgba(255,255,255,0.16)',
  solid: 'rgba(255,64,64,0.35)',
  spawn: 'rgba(64,220,120,0.55)',
  goal: 'rgba(255,210,64,0.55)',
  select: '#ffd23f',
};

export interface Doc {
  /** "col,row" -> tile index. */
  tiles: Map<string, number>;
  /** "col,row" cells that collide. */
  solids: Set<string>;
  spawn: { col: number; row: number };
  goal: { col: number; row: number };
}

const key = (col: number, row: number) => `${col},${row}`;
const parseKey = (k: string): [number, number] => {
  const [c, r] = k.split(',');
  return [Number(c), Number(r)];
};

export function emptyDoc(): Doc {
  return { tiles: new Map(), solids: new Set(), spawn: { col: 1, row: 1 }, goal: { col: 2, row: 1 } };
}

export function docFromLevel(level: Level): Doc {
  const doc = emptyDoc();
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.columns; col++) {
      const tile = level.tiles[row]?.[col] ?? -1;
      if (tile >= 0) doc.tiles.set(key(col, row), tile);
      if (level.solids[row]?.[col]) doc.solids.add(key(col, row));
    }
  }
  doc.spawn = { ...level.spawn };
  doc.goal = { ...level.goal };
  return doc;
}

/** Crop everything painted to its bounding box and build a dense Level. */
export function docToLevel(doc: Doc): Level {
  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;
  const consider = (c: number, r: number) => {
    minC = Math.min(minC, c);
    minR = Math.min(minR, r);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  };

  for (const k of doc.tiles.keys()) consider(...parseKey(k));
  for (const k of doc.solids) consider(...parseKey(k));
  consider(doc.spawn.col, doc.spawn.row);
  consider(doc.goal.col, doc.goal.row);

  if (!Number.isFinite(minC)) {
    minC = 0;
    minR = 0;
    maxC = 0;
    maxR = 0;
  }

  const columns = maxC - minC + 1;
  const rows = maxR - minR + 1;
  const tiles = Array.from({ length: rows }, () => new Array<number>(columns).fill(-1));
  const solids = Array.from({ length: rows }, () => new Array<boolean>(columns).fill(false));

  for (const [k, tile] of doc.tiles) {
    const [c, r] = parseKey(k);
    const row = tiles[r - minR];
    if (row) row[c - minC] = tile;
  }
  for (const k of doc.solids) {
    const [c, r] = parseKey(k);
    const row = solids[r - minR];
    if (row) row[c - minC] = true;
  }

  return {
    tileSize: 16,
    columns,
    rows,
    spawn: { col: doc.spawn.col - minC, row: doc.spawn.row - minR },
    goal: { col: doc.goal.col - minC, row: doc.goal.row - minR },
    tiles,
    solids,
  };
}

/** Bounding box of everything painted (for the Fit button). */
function docBounds(doc: Doc): { minC: number; minR: number; maxC: number; maxR: number } {
  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;
  const consider = (c: number, r: number) => {
    minC = Math.min(minC, c);
    minR = Math.min(minR, r);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  };
  for (const k of doc.tiles.keys()) consider(...parseKey(k));
  for (const k of doc.solids) consider(...parseKey(k));
  consider(doc.spawn.col, doc.spawn.row);
  consider(doc.goal.col, doc.goal.row);
  if (!Number.isFinite(minC)) return { minC: 0, minR: 0, maxC: 0, maxR: 0 };
  return { minC, minR, maxC, maxR };
}

export async function startEditor(): Promise<void> {
  const sheet = await loadSheetImage();
  const ui = buildDom();

  let doc: Doc;
  try {
    doc = docFromLevel(await loadLevel());
  } catch {
    doc = emptyDoc();
  }

  let selectedTile = 8;
  let tool: Tool = 'brush';
  let painting = false;
  let panning = false;
  let lastPointer = { x: 0, y: 0 };
  const view = { x: 0, y: 0 }; // top-left of the viewport, in world pixels

  // ---------------------------------------------------------------- palette
  const palette = ui.paletteCanvas;
  palette.width = SHEETS.tiles.columns * SHEETS.tiles.spriteWidth * PALETTE_SCALE;
  palette.height = SHEETS.tiles.rows * SHEETS.tiles.spriteHeight * PALETTE_SCALE;
  const paletteCtx = palette.getContext('2d');
  if (!paletteCtx) throw new Error('no 2d context');

  const drawPalette = () => {
    const s = SHEETS.tiles.spriteWidth * PALETTE_SCALE;
    paletteCtx.imageSmoothingEnabled = false;
    paletteCtx.clearRect(0, 0, palette.width, palette.height);
    for (let i = 0; i < TILE_COUNT; i++) {
      const col = i % SHEETS.tiles.columns;
      const row = Math.floor(i / SHEETS.tiles.columns);
      paletteCtx.drawImage(sheet, col * 16, row * 16, 16, 16, col * s, row * s, s, s);
      if (SOLID_TILE_HINTS.has(i)) {
        paletteCtx.strokeStyle = 'rgba(255,64,64,0.6)';
        paletteCtx.lineWidth = 1;
        paletteCtx.strokeRect(col * s + 0.5, row * s + 0.5, s - 1, s - 1);
      }
    }
    const sc = selectedTile % SHEETS.tiles.columns;
    const sr = Math.floor(selectedTile / SHEETS.tiles.columns);
    paletteCtx.strokeStyle = COLOR.select;
    paletteCtx.lineWidth = 2;
    paletteCtx.strokeRect(sc * s - 1, sr * s - 1, s + 2, s + 2);
  };

  palette.addEventListener('pointerdown', (event) => {
    const rect = palette.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (palette.width / rect.width);
    const y = (event.clientY - rect.top) * (palette.height / rect.height);
    const col = Math.floor(x / (SHEETS.tiles.spriteWidth * PALETTE_SCALE));
    const row = Math.floor(y / (SHEETS.tiles.spriteHeight * PALETTE_SCALE));
    const index = row * SHEETS.tiles.columns + col;
    if (index >= 0 && index < TILE_COUNT) {
      selectedTile = index;
      if (tool === 'pan') tool = 'brush';
      drawPalette();
      syncTools();
      setStatus(`Selected tile ${index}`);
    }
  });

  // -------------------------------------------------------------------- map
  const map = ui.mapCanvas;
  const mapCtx = map.getContext('2d');
  if (!mapCtx) throw new Error('no 2d context');

  const sizeCanvas = () => {
    const wrap = map.parentElement;
    map.width = Math.max(1, wrap?.clientWidth ?? window.innerWidth);
    map.height = Math.max(1, wrap?.clientHeight ?? window.innerHeight);
  };

  const drawMap = () => {
    mapCtx.imageSmoothingEnabled = false;
    mapCtx.fillStyle = COLOR.background;
    mapCtx.fillRect(0, 0, map.width, map.height);

    const col0 = Math.floor(view.x / CELL);
    const row0 = Math.floor(view.y / CELL);
    const cols = Math.ceil(map.width / CELL) + 1;
    const rows = Math.ceil(map.height / CELL) + 1;

    // Tiles + collision overlay.
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const col = col0 + i;
        const row = row0 + j;
        const sx = col * CELL - view.x;
        const sy = row * CELL - view.y;
        const tile = doc.tiles.get(key(col, row));
        if (tile !== undefined) {
          const tcol = tile % SHEETS.tiles.columns;
          const trow = Math.floor(tile / SHEETS.tiles.columns);
          mapCtx.drawImage(sheet, tcol * 16, trow * 16, 16, 16, sx, sy, CELL, CELL);
        }
        if (doc.solids.has(key(col, row))) {
          mapCtx.fillStyle = COLOR.solid;
          mapCtx.fillRect(sx, sy, CELL, CELL);
        }
      }
    }

    // Grid.
    mapCtx.lineWidth = 1;
    const startX = Math.floor(view.x / CELL) * CELL - view.x;
    for (let x = startX; x <= map.width; x += CELL) {
      const worldCol = Math.round((x + view.x) / CELL);
      mapCtx.strokeStyle = worldCol % 8 === 0 ? COLOR.gridMajor : COLOR.grid;
      mapCtx.beginPath();
      mapCtx.moveTo(x + 0.5, 0);
      mapCtx.lineTo(x + 0.5, map.height);
      mapCtx.stroke();
    }
    const startY = Math.floor(view.y / CELL) * CELL - view.y;
    for (let y = startY; y <= map.height; y += CELL) {
      const worldRow = Math.round((y + view.y) / CELL);
      mapCtx.strokeStyle = worldRow % 8 === 0 ? COLOR.gridMajor : COLOR.grid;
      mapCtx.beginPath();
      mapCtx.moveTo(0, y + 0.5);
      mapCtx.lineTo(map.width, y + 0.5);
      mapCtx.stroke();
    }

    // Spawn + goal markers.
    mapCtx.fillStyle = COLOR.spawn;
    mapCtx.fillRect(doc.spawn.col * CELL - view.x, doc.spawn.row * CELL - view.y, CELL, CELL);
    mapCtx.fillStyle = COLOR.goal;
    mapCtx.fillRect(doc.goal.col * CELL - view.x, doc.goal.row * CELL - view.y, CELL, CELL);
  };

  const tileFromEvent = (event: PointerEvent): { col: number; row: number } => {
    const rect = map.getBoundingClientRect();
    const px = (event.clientX - rect.left) * (map.width / rect.width);
    const py = (event.clientY - rect.top) * (map.height / rect.height);
    return {
      col: Math.floor((view.x + px) / CELL),
      row: Math.floor((view.y + py) / CELL),
    };
  };

  const apply = (col: number, row: number) => {
    switch (tool) {
      case 'brush': {
        const k = key(col, row);
        doc.tiles.set(k, selectedTile);
        if (SOLID_TILE_HINTS.has(selectedTile)) doc.solids.add(k);
        else doc.solids.delete(k);
        break;
      }
      case 'erase': {
        const k = key(col, row);
        doc.tiles.delete(k);
        doc.solids.delete(k);
        break;
      }
      case 'solid': {
        const k = key(col, row);
        if (doc.solids.has(k)) doc.solids.delete(k);
        else doc.solids.add(k);
        break;
      }
      case 'spawn':
        doc.spawn = { col, row };
        break;
      case 'goal':
        doc.goal = { col, row };
        break;
      case 'pan':
        break;
    }
    drawMap();
  };

  const clampView = () => {
    view.x = Math.max(0, view.x);
    view.y = Math.max(0, view.y);
  };

  const centerOnContent = () => {
    const b = docBounds(doc);
    view.x = Math.max(0, b.minC * CELL - CELL * 2);
    view.y = Math.max(0, b.minR * CELL - CELL * 2);
    drawMap();
  };

  map.addEventListener('pointerdown', (event) => {
    map.setPointerCapture(event.pointerId);
    lastPointer = { x: event.clientX, y: event.clientY };
    const wantsPan = tool === 'pan' || event.button === 1;
    if (wantsPan) {
      panning = true;
      return;
    }
    painting = true;
    const cell = tileFromEvent(event);
    apply(cell.col, cell.row);
  });

  map.addEventListener('pointermove', (event) => {
    const cell = tileFromEvent(event);
    setStatus(`col ${cell.col}, row ${cell.row}`);

    if (panning) {
      view.x -= event.clientX - lastPointer.x;
      view.y -= event.clientY - lastPointer.y;
      lastPointer = { x: event.clientX, y: event.clientY };
      clampView();
      drawMap();
      return;
    }
    if (painting) apply(cell.col, cell.row);
  });

  const endPointer = (event: PointerEvent) => {
    painting = false;
    panning = false;
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
  };
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);

  map.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const dx = event.shiftKey ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      view.x += dx;
      view.y += dy;
      clampView();
      drawMap();
    },
    { passive: false },
  );

  // ------------------------------------------------------------------ tools
  function syncTools() {
    for (const button of ui.toolButtons) {
      button.classList.toggle('active', button.dataset.tool === tool);
    }
  }
  for (const button of ui.toolButtons) {
    button.addEventListener('click', () => {
      tool = (button.dataset.tool as Tool) ?? 'brush';
      syncTools();
      setStatus(`Tool: ${tool}`);
    });
  }

  ui.saveButton.addEventListener('click', async () => {
    const level = docToLevel(doc);
    setStatus('Saving…');
    const ok = await saveLevel(level);
    if (ok) {
      setStatus(`Saved ${level.columns}×${level.rows} tiles (cropped) to level1.json`);
    } else {
      downloadJson(level);
      setStatus('Dev server not reachable — downloaded level1.json instead');
    }
  });

  ui.reloadButton.addEventListener('click', async () => {
    try {
      doc = docFromLevel(await loadLevel());
      centerOnContent();
      setStatus('Reloaded from disk');
    } catch {
      setStatus('Reload failed');
    }
  });

  ui.clearButton.addEventListener('click', () => {
    doc = emptyDoc();
    view.x = 0;
    view.y = 0;
    drawMap();
    setStatus('Cleared');
  });

  ui.fitButton.addEventListener('click', () => {
    centerOnContent();
    setStatus('Centred on content');
  });

  const onResize = () => {
    sizeCanvas();
    drawMap();
  };
  window.addEventListener('resize', onResize);

  sizeCanvas();
  drawPalette();
  drawMap();
  syncTools();
  centerOnContent();
  setStatus('Pan with the wheel or middle-drag. Save crops to the painted bounds.');
}

/** Load the tilesheet as a plain <img> for canvas drawing. */
function loadSheetImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${AssetPaths.tiles}`));
    image.src = AssetPaths.tiles;
  });
}

function setStatus(text: string): void {
  const el = document.getElementById('ed-status');
  if (el) el.textContent = text;
}

function downloadJson(level: Level): void {
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'level1.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

interface EditorDom {
  mapCanvas: HTMLCanvasElement;
  paletteCanvas: HTMLCanvasElement;
  toolButtons: HTMLButtonElement[];
  saveButton: HTMLButtonElement;
  reloadButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  fitButton: HTMLButtonElement;
}

/** Build the editor DOM from scratch so the game page stays untouched. */
function buildDom(): EditorDom {
  document.body.classList.add('editor-mode');
  const root = document.createElement('div');
  root.id = 'editor';
  root.innerHTML = `
    <header class="ed-header">
      <h1>Green Hood — Level Editor</h1>
      <div class="ed-actions">
        <button id="ed-save">Save</button>
        <button id="ed-reload">Reload</button>
        <button id="ed-fit">Fit</button>
        <button id="ed-clear">Clear</button>
      </div>
    </header>
    <div class="ed-body">
      <aside class="ed-side">
        <h2>Palette</h2>
        <canvas id="ed-palette"></canvas>
        <h2>Tools</h2>
        <div class="ed-tools">
          <button data-tool="brush">Paint</button>
          <button data-tool="erase">Erase</button>
          <button data-tool="solid">Solid</button>
          <button data-tool="spawn">Spawn</button>
          <button data-tool="goal">Goal</button>
          <button data-tool="pan">Pan</button>
        </div>
        <p class="ed-hint">Red outline = tile collides by default.<br>
          The grid is infinite — pan with the wheel or middle-drag.<br>
          Save crops the map to what you painted.</p>
      </aside>
      <main class="ed-canvas-wrap">
        <canvas id="ed-map"></canvas>
      </main>
    </div>
    <footer class="ed-footer"><span id="ed-status"></span></footer>
  `;
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    body.editor-mode { margin: 0; background: #060a12; color: #e6edf3;
      font: 14px/1.4 system-ui, sans-serif; overflow: hidden; }
    body.editor-mode #shell { display: none; }
    #editor { display: flex; flex-direction: column; height: 100vh; }
    .ed-header { display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; background: #111a2b; border-bottom: 1px solid #23324d; }
    .ed-header h1 { font-size: 16px; margin: 0; }
    .ed-body { flex: 1; display: flex; min-height: 0; }
    .ed-side { width: 300px; padding: 12px; overflow: auto; background: #0d1626;
      border-right: 1px solid #23324d; flex: none; }
    .ed-side h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
      color: #8aa0c0; margin: 12px 0 6px; }
    #ed-palette { width: 100%; image-rendering: pixelated; border: 1px solid #23324d;
      cursor: pointer; background: #0b1220; }
    .ed-tools { display: flex; flex-wrap: wrap; gap: 6px; }
    button { background: #1b2a44; color: #e6edf3; border: 1px solid #2f4a6e;
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font: inherit; }
    button:hover { background: #24395c; }
    button.active { background: #2f9e4f; border-color: #3fc46a; }
    .ed-hint { color: #8aa0c0; font-size: 12px; }
    .ed-canvas-wrap { flex: 1; min-width: 0; position: relative; overflow: hidden; }
    #ed-map { position: absolute; inset: 0; width: 100%; height: 100%;
      image-rendering: pixelated; cursor: crosshair; touch-action: none; }
    .ed-footer { padding: 6px 16px; background: #111a2b; border-top: 1px solid #23324d;
      color: #8aa0c0; font-size: 12px; min-height: 18px; }
  `;
  document.head.appendChild(style);

  return {
    mapCanvas: root.querySelector<HTMLCanvasElement>('#ed-map')!,
    paletteCanvas: root.querySelector<HTMLCanvasElement>('#ed-palette')!,
    toolButtons: Array.from(root.querySelectorAll<HTMLButtonElement>('.ed-tools button')),
    saveButton: root.querySelector<HTMLButtonElement>('#ed-save')!,
    reloadButton: root.querySelector<HTMLButtonElement>('#ed-reload')!,
    clearButton: root.querySelector<HTMLButtonElement>('#ed-clear')!,
    fitButton: root.querySelector<HTMLButtonElement>('#ed-fit')!,
  };
}
