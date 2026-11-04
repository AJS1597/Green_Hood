import { AssetPaths, SHEETS, SOLID_TILE_HINTS, TILE_COUNT } from '../game/tileset';
import { type Level, createEmptyLevel } from '../game/level';
import { loadLevel, saveLevel } from '../game/levelFile';

/**
 * ============================================================================
 *  LEVEL EDITOR  (open the game with /dev on the end of the URL)
 * ============================================================================
 *
 * A small, self-contained tilemap editor:
 *   - the palette lists every tile in `sheet.png`
 *   - pick a tile, then click/drag on the grid to paint
 *   - tools for erasing, toggling collision, and placing spawn/goal
 *   - Save writes straight to public/levels/level1.json through the dev server
 */

type Tool = 'brush' | 'erase' | 'solid' | 'spawn' | 'goal';

const CELL = 20; // pixels per tile on the editor grid
const PALETTE_SCALE = 2; // palette tile zoom

const COLOR = {
  background: '#0b1220',
  grid: 'rgba(255,255,255,0.08)',
  solid: 'rgba(255,64,64,0.35)',
  spawn: 'rgba(64,220,120,0.55)',
  goal: 'rgba(255,210,64,0.55)',
  select: '#ffd23f',
};

export async function startEditor(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const columns = Number(params.get('cols')) || 60;
  const rows = Number(params.get('rows')) || 22;

  let level: Level;
  try {
    level = await loadLevel();
  } catch {
    level = createEmptyLevel(columns, rows);
  }

  const sheet = await loadSheetImage();
  const ui = buildDom();

  let selectedTile = 8;
  let tool: Tool = 'brush';
  let painting = false;

  // ---------------------------------------------------------------- palette
  const palette = ui.paletteCanvas;
  palette.width = SHEETS.tiles.columns * SHEETS.tiles.spriteWidth * PALETTE_SCALE;
  palette.height = SHEETS.tiles.rows * SHEETS.tiles.spriteHeight * PALETTE_SCALE;
  const paletteCtx = palette.getContext('2d');
  if (!paletteCtx) throw new Error('no 2d context');

  const drawPalette = () => {
    paletteCtx.imageSmoothingEnabled = false;
    paletteCtx.clearRect(0, 0, palette.width, palette.height);
    const s = SHEETS.tiles.spriteWidth * PALETTE_SCALE;
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
    // Highlight the selected tile.
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
      tool = 'brush';
      drawPalette();
      syncTools();
      setStatus(`Selected tile ${index}`);
    }
  });

  // -------------------------------------------------------------------- map
  const map = ui.mapCanvas;
  const cell = CELL;
  map.width = level.columns * cell;
  map.height = level.rows * cell;
  const mapCtx = map.getContext('2d');
  if (!mapCtx) throw new Error('no 2d context');

  const drawMap = () => {
    mapCtx.imageSmoothingEnabled = false;
    mapCtx.fillStyle = COLOR.background;
    mapCtx.fillRect(0, 0, map.width, map.height);

    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.columns; col++) {
        const index = level.tiles[row]?.[col] ?? -1;
        if (index < 0) continue;
        const sx = (index % SHEETS.tiles.columns) * 16;
        const sy = Math.floor(index / SHEETS.tiles.columns) * 16;
        mapCtx.drawImage(sheet, sx, sy, 16, 16, col * cell, row * cell, cell, cell);
      }
    }

    // Collision overlay + grid.
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.columns; col++) {
        if (level.solids[row]?.[col]) {
          mapCtx.fillStyle = COLOR.solid;
          mapCtx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }
    mapCtx.strokeStyle = COLOR.grid;
    mapCtx.lineWidth = 1;
    for (let col = 0; col <= level.columns; col++) {
      mapCtx.beginPath();
      mapCtx.moveTo(col * cell + 0.5, 0);
      mapCtx.lineTo(col * cell + 0.5, map.height);
      mapCtx.stroke();
    }
    for (let row = 0; row <= level.rows; row++) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, row * cell + 0.5);
      mapCtx.lineTo(map.width, row * cell + 0.5);
      mapCtx.stroke();
    }

    // Spawn + goal markers.
    mapCtx.fillStyle = COLOR.spawn;
    mapCtx.fillRect(level.spawn.col * cell, level.spawn.row * cell, cell, cell);
    mapCtx.fillStyle = COLOR.goal;
    mapCtx.fillRect(level.goal.col * cell, level.goal.row * cell, cell, cell);
  };

  const cellFromEvent = (event: PointerEvent): { col: number; row: number } | null => {
    const rect = map.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (map.width / rect.width);
    const y = (event.clientY - rect.top) * (map.height / rect.height);
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    if (col < 0 || row < 0 || col >= level.columns || row >= level.rows) return null;
    return { col, row };
  };

  const apply = (col: number, row: number) => {
    const tileRow = level.tiles[row];
    const solidRow = level.solids[row];
    if (!tileRow || !solidRow) return;

    switch (tool) {
      case 'brush':
        tileRow[col] = selectedTile;
        solidRow[col] = SOLID_TILE_HINTS.has(selectedTile);
        break;
      case 'erase':
        tileRow[col] = -1;
        solidRow[col] = false;
        break;
      case 'solid':
        solidRow[col] = !solidRow[col];
        break;
      case 'spawn':
        level.spawn = { col, row };
        break;
      case 'goal':
        level.goal = { col, row };
        break;
    }
    drawMap();
  };

  map.addEventListener('pointerdown', (event) => {
    painting = true;
    map.setPointerCapture(event.pointerId);
    const cellPos = cellFromEvent(event);
    if (cellPos) apply(cellPos.col, cellPos.row);
  });
  map.addEventListener('pointermove', (event) => {
    const cellPos = cellFromEvent(event);
    if (cellPos) {
      setStatus(`col ${cellPos.col}, row ${cellPos.row}  ·  tile ${level.tiles[cellPos.row]?.[cellPos.col] ?? -1}`);
    } else {
      setStatus('');
    }
    if (painting && cellPos) apply(cellPos.col, cellPos.row);
  });
  map.addEventListener('pointerup', (event) => {
    painting = false;
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
  });
  map.addEventListener('pointerleave', () => {
    painting = false;
  });

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
    setStatus('Saving…');
    const ok = await saveLevel(level);
    if (ok) {
      setStatus(`Saved to public/levels/level1.json at ${new Date().toLocaleTimeString()}`);
    } else {
      downloadJson(level);
      setStatus('Dev server not reachable — downloaded level1.json instead');
    }
  });

  ui.reloadButton.addEventListener('click', async () => {
    try {
      level = await loadLevel();
      redrawAll();
      setStatus('Reloaded from disk');
    } catch {
      setStatus('Reload failed');
    }
  });

  ui.clearButton.addEventListener('click', () => {
    level = createEmptyLevel(level.columns, level.rows);
    redrawAll();
    setStatus('Cleared');
  });

  function redrawAll() {
    map.width = level.columns * cell;
    map.height = level.rows * cell;
    drawMap();
  }

  drawPalette();
  drawMap();
  syncTools();
  setStatus('Ready');
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
        </div>
        <p class="ed-hint">Red outline = tile collides by default.<br>
          Paint first, then Save.</p>
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
      font: 14px/1.4 system-ui, sans-serif; }
    body.editor-mode #shell { display: none; }
    #editor { display: flex; flex-direction: column; height: 100vh; }
    .ed-header { display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; background: #111a2b; border-bottom: 1px solid #23324d; }
    .ed-header h1 { font-size: 16px; margin: 0; }
    .ed-body { flex: 1; display: flex; min-height: 0; }
    .ed-side { width: 300px; padding: 12px; overflow: auto; background: #0d1626;
      border-right: 1px solid #23324d; }
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
    .ed-canvas-wrap { flex: 1; overflow: auto; padding: 12px; }
    #ed-map { image-rendering: pixelated; cursor: crosshair; border: 1px solid #23324d; }
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
  };
}
