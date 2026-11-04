# Green Hood

A green-hooded archer prototype built with **Excalibur.js**, TypeScript, Vite and pnpm. Everything is client-side; there is no backend.

This scaffold mirrors the development stack of [NatTuck/drunk-panda](https://github.com/NatTuck/drunk-panda): Excalibur.js 0.32, TypeScript in strict mode, Vite with Vitest, and pnpm as the package manager.

## Run it

```bash
pnpm install
pnpm dev
```

Then open the printed local URL.

```bash
pnpm test       # headless movement / shooting / collision tests
pnpm typecheck
pnpm build      # static production build in dist/
pnpm preview
```

## Controls

| Action | Keyboard | Mouse |
| --- | --- | --- |
| Move | `A` / `D` or arrows | — |
| Jump | `Space`, `W` or `Up` | — |
| Shoot | `J` | Click |
| Reset the room | `R` | — |

## What's here

A single room with an archer on a strip of ground and three targets. Fire arrows to score ten points per target. `R` resets arrows, targets and score.

## Architecture

```
src/
  game/
    config.ts       all gameplay tunables
    archer.ts       pure movement + shooting state (no Excalibur imports)
    GameScene.ts    Excalibur scene, rendering and input
  main.ts           engine bootstrap
tests/              headless unit tests
```

### Key decisions

- **Pure logic, engine-free.** `archer.ts` contains the movement and shooting rules with no Excalibur imports, so the feel features can be replayed in Vitest.
- **HTML HUD over Excalibur ScreenElements.** Text stays crisp at any resolution.
- **Client-only.** No server, no accounts.

## Debugging

The engine and scene are exposed on `window.__hood` for quick console poking:

```js
__hood.scene.resetRoom();
```

## Next

1. Proper arrow arcs and wind drag.
2. Moving targets and a timer.
3. Sprite art and sound.
