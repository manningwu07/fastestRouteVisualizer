# Fastest Route Visualizer

Interactive transit graph builder and route planner built with React, TypeScript, Vite, and Zustand.

You can:
- Create stations on a canvas
- Create lines with schedules (first/last departure + headway)
- Add run edges for direct transfer links
- Auto-generate and edit transfer penalties between lines
- Step through routes in Pathfinder mode and compare saved routes
- Save/load graph data as JSON

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand
- Vitest

## Getting Started

### Prerequisites

- Bun

### Install

```bash
bun install
```

### Run Dev Server

```bash
bun run dev
```

Vite is configured with `root: src`, so the app source lives in `src/`.

### Build

```bash
bun run build
```

### Test

```bash
bun run test
```

### Test (Watch)

```bash
bun run test:watch
```

## How To Use

### Builder Mode

1. Add stations on the canvas.
2. Use `+ Line` to create a transit line by selecting stations in order.
3. Set line timing:
   - `firstDeparture`
   - `lastDeparture`
   - `headwayMin`
4. Use `+ Run Edge` for direct point-to-point connections.
5. Edit transfer times in the transfer table.

### Pathfinder Mode

1. Set a route start time.
2. Pick a start station.
3. Click reachable stations to extend a route.
4. Inspect timing details and total travel time.
5. Save routes and compare alternatives.

## Keyboard Shortcuts

The app includes a shortcuts panel and supports custom keybinding overrides in local storage.

Default examples:
- `1` / `2`: switch mode (Builder / Pathfinder)
- `S`, `N`, `L`, `R`: builder tool selection
- `Ctrl+S`: save graph JSON
- `Ctrl+O`: load graph JSON
- `?`: toggle shortcuts panel

## Save Format

Graph export/import uses JSON with these top-level keys:
- `stations`
- `lines`
- `runEdges`
- `transfers`

## Project Structure

```text
src/
  app.tsx
  styles.css
  components/
  engine/
    graph.ts
    scheduler.ts
    types.ts
    __tests__/
  hooks/
  state/
```

## Notes

- Build artifacts are generated under `src/dist/` and are ignored by git.
- The large minified bundle files in `src/dist/assets/` are generated output, not source files.
