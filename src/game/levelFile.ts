import { type Level, levelFromData, levelToData } from './level';

/** Static file served from public/. The game and the editor both load this. */
export const LEVEL_URL = 'levels/level1.json';

/** Dev-only endpoint (see the Vite plugin in vite.config.ts) that writes the file. */
export const LEVEL_API = '/api/level';

/** Load the level from the saved JSON file. */
export async function loadLevel(): Promise<Level> {
  const response = await fetch(LEVEL_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${LEVEL_URL} (${response.status})`);
  }
  return levelFromData((await response.json()) as Partial<ReturnType<typeof levelToData>>);
}

/**
 * Save the level. In `pnpm dev` this writes straight to
 * `public/levels/level1.json`. Returns false if the endpoint is unavailable
 * (e.g. a production preview), so the caller can fall back to a download.
 */
export async function saveLevel(level: Level): Promise<boolean> {
  try {
    const response = await fetch(LEVEL_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(levelToData(level), null, 2),
    });
    return response.ok;
  } catch {
    return false;
  }
}
