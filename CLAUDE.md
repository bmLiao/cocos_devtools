# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`cccdev` is a Chrome extension for Cocos Creator browser-preview debugging plus site-wide sticky notes (Snippet). Left-click on the action icon does nothing; the right-click menu toggles sticky notes, opens/closes DevTools, and picks window mode (PiP vs popup). Choosing DevTools injects a MAIN-world launcher into the current tab (same idea as `exsimple.js`): if `window.cc` exists, it opens a chrome-less window (or Document PiP), assigns `devWin.cc = window.cc`, and mounts the Preact DevTools UI fullscreen. The popup closes when the preview page unloads or refreshes. If that origin had DevTools open, the service worker re-injects after the next load and opens again once the engine is ready.

The UI lives in `packages/cccdev-template-3x/` and is built as an IIFE via Vite. Extension static files (`manifest.json`, `background.js`, icons, `snippet/`) are copied into repo-root `dist/` at build time. Load `dist/` as an unpacked extension.

## Commands

```bash
# Install template dependencies (required before first build)
cd packages/cccdev-template-3x && bun install

# Generate icons, build UI IIFE, copy MV3 files → dist/
bun run build

# Type-check CLI code (root tsconfig, excludes packages/)
bun run type-check

# Lint / format
bun run lint          # oxlint
bun run lint:fix      # oxlint --fix
bun run fmt           # oxfmt
bun run fmt:check     # oxfmt --check
```

After build: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Architecture

### Two-part structure

1. **Chrome extension** (`packages/cccdev-template-3x/extension/` + built `dist/`) — MV3 service worker handles action context menus (sticky notes + DevTools toggle + window mode), per-origin auto-open, and `chrome.scripting.executeScript({ world: 'MAIN' })` to launch the popup from the game page. Sticky notes use `content_scripts` under `extension/snippet/`.

2. **DevTools UI** (`packages/cccdev-template-3x/src/`) — private Preact app built as IIFE via Vite. Output: `dist/assets/{index.js,style.css}`.

### Why MAIN world + window.open

An extension page cannot hold a live reference to the tab's `cc` object. The launcher must run in the page's main world, open a child window (opener origin), and assign `devWin.cc = window.cc` before evaluating the IIFE.

### Devtools UI (`packages/cccdev-template-3x/src/`)

- **State**: `@preact/signals` — top-level exported signals in `store.ts`. No Redux/Context.
- **Engine bridge**: `engine.ts` reads `window.cc` (injected) or `window.opener.cc`. Scene traversal, node inspect, debug draw.
- **Components**: `App.tsx` (always-on fullscreen `#cc-devtools`) → `TreePanel` + `PropPanel` → `ComponentPanel` → `PropItem`. `ProfilerPanel` floats independently (header `P` button).
- **Models**: `NodeModel.ts` and `ComponentModels.ts` for cc.Node, UITransform, Label, Sprite.
- **Styling**: Single `style.css`. Panel is `position: fixed; inset: 0` (fills the popup).

### Key patterns

- No in-page toggle; `#cc-devtools` is always visible inside the popup
- Tree data rebuilt every frame via `requestAnimationFrame` loop
- Property inputs are uncontrolled with ref-based external sync (only when not focused)
- Preview `pagehide`/`beforeunload` closes the popup window; a remembered origin auto-opens after engine init
- Closing via the action menu or the popup X clears that origin's auto-open flag

## Conventions

- Formatter: oxfmt with single quotes (`.oxfmtrc.json`)
- Linter: oxlint
- Template package has its own `tsconfig.json` extending root, adding `jsx: react-jsx` + `jsxImportSource: preact`
- Root tsconfig excludes `packages/` — CLI leftovers and template type-check independently
