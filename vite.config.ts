import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const LEVEL_FILE = fileURLToPath(new URL('./public/levels/level1.json', import.meta.url));

/**
 * Dev-only middleware so the `/dev` level editor can write its map straight
 * back to `public/levels/level1.json` when you click Save.
 */
function levelWriter(): Plugin {
  // Connect middleware that writes POSTed JSON back to the level file.
  const hookServers = (server: {
    middlewares: {
      use: (
        route: string,
        handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void,
      ) => void;
    };
  }) => {
    server.middlewares.use('/api/level', (req, res, next) => {
      if (req.method !== 'POST') {
        next();
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        try {
          JSON.parse(body); // reject anything that isn't valid JSON
          fs.mkdirSync(path.dirname(LEVEL_FILE), { recursive: true });
          fs.writeFileSync(LEVEL_FILE, body, 'utf8');
          res.statusCode = 200;
          res.end('saved');
        } catch (error) {
          res.statusCode = 400;
          res.end(String(error));
        }
      });
    });
  };

  return {
    name: 'green-hood-level-writer',
    configureServer(server) {
      hookServers(server as unknown as Parameters<typeof hookServers>[0]);
    },
    configurePreviewServer(server) {
      hookServers(server as unknown as Parameters<typeof hookServers>[0]);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [levelWriter()],
  server: {
    host: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
