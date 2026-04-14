import { create } from 'zustand';
import type { Station, TransitLine, RunEdge, Transfer, RouteStep } from '../engine/types.js';
import { generateTransfers, getConnectionsBetween, computeStepTiming } from '../engine/graph.js';
import type { Connection } from '../engine/graph.js';

export type ToolMode = 'select' | 'addStation' | 'addLine' | 'addRunEdge';
export type AppMode = 'builder' | 'pathfinder';

export interface SavedRoute {
  name: string;
  steps: RouteStep[];
  totalMin: number;
  startTime: number;
}

export interface AppState {
  mode: AppMode;
  stations: Record<string, Station>;
  lines: Record<string, TransitLine>;
  runEdges: RunEdge[];
  transfers: Transfer[];
  selectedTool: ToolMode;
  selectedStationIds: string[];
  selectedLineId: string | null;
  selectedRunEdgeId: string | null;

  // Pathfinder state
  currentRoute: RouteStep[];
  routeStartTime: number;
  savedRoutes: SavedRoute[];
  pathfinderSelectedStation: string | null;

  // Tab navigation
  tabFocusedStationId: string | null;

  addStation(name: string, x: number, y: number, agency?: string): void;
  updateStation(id: string, updates: Partial<Station>): void;
  removeStation(id: string): void;
  addLine(line: Omit<TransitLine, 'id'>): void;
  removeLine(id: string): void;
  updateLine(id: string, updates: Partial<Omit<TransitLine, 'id'>>): void;
  addRunEdge(edge: Omit<RunEdge, 'id'>): void;
  removeRunEdge(id: string): void;
  updateRunEdge(id: string, updates: Partial<Omit<RunEdge, 'id'>>): void;
  updateTransfer(stationId: string, fromLineId: string, toLineId: string, transferMin: number): void;
  regenerateTransfers(): void;
  setMode(mode: AppMode): void;
  setSelectedTool(tool: ToolMode): void;
  setSelectedStationIds(ids: string[]): void;
  setSelectedLineId(id: string | null): void;
  setSelectedRunEdgeId(id: string | null): void;
  saveToJSON(): string;
  loadFromJSON(json: string): void;

  // Pathfinder actions
  setRouteStartTime(time: number): void;
  setPathfinderSelectedStation(stationId: string | null): void;
  setTabFocusedStationId(stationId: string | null): void;
  addRouteStep(
    stationId: string,
    connectionChoice: { type: 'line'; lineId: string; fromIdx: number; toIdx: number; direction: 'forward' | 'reverse' } | { type: 'run'; edge: RunEdge }
  ): void;
  undoLastStep(): void;
  clearRoute(): void;
  saveCurrentRoute(name: string): void;
  deleteSavedRoute(index: number): void;
}

export const useStore = create<AppState>((set, get) => ({
  mode: 'builder',
  stations: {},
  lines: {},
  runEdges: [],
  transfers: [],
  selectedTool: 'select',
  selectedStationIds: [],
  selectedLineId: null,
  selectedRunEdgeId: null,

  // Pathfinder defaults
  currentRoute: [],
  routeStartTime: 480,
  savedRoutes: [],
  pathfinderSelectedStation: null,
  tabFocusedStationId: null,

  addStation(name, x, y, agency) {
    const id = crypto.randomUUID();
    const station: Station = { id, name, x, y, agency };
    set(state => ({ stations: { ...state.stations, [id]: station } }));
  },

  updateStation(id, updates) {
    set(state => ({
      stations: {
        ...state.stations,
        [id]: { ...state.stations[id], ...updates },
      },
    }));
  },

  removeStation(id) {
    set(state => {
      const stations = { ...state.stations };
      delete stations[id];
      const runEdges = state.runEdges.filter(e => e.from !== id && e.to !== id);
      const lines: Record<string, TransitLine> = {};
      for (const [lid, line] of Object.entries(state.lines)) {
        const stops = line.stops.filter(s => s !== id);
        if (stops.length >= 2) {
          // recalculate travelTimes to match new stops array
          const travelTimes: number[] = [];
          let newIdx = 0;
          for (let i = 0; i < line.stops.length - 1; i++) {
            if (line.stops[i] !== id && line.stops[i + 1] !== id) {
              travelTimes.push(line.travelTimes[i]);
              newIdx++;
            }
          }
          lines[lid] = { ...line, stops, travelTimes };
        }
      }
      return { stations, runEdges, lines };
    });
    get().regenerateTransfers();
  },

  addLine(line) {
    const id = crypto.randomUUID();
    const bidirectional = line.bidirectional !== undefined ? line.bidirectional : true;
    set(state => ({
      lines: { ...state.lines, [id]: { ...line, bidirectional, id } },
    }));
    get().regenerateTransfers();
  },

  removeLine(id) {
    set(state => {
      const lines = { ...state.lines };
      delete lines[id];
      return { lines, selectedLineId: state.selectedLineId === id ? null : state.selectedLineId };
    });
    get().regenerateTransfers();
  },

  updateLine(id, updates) {
    set(state => ({
      lines: {
        ...state.lines,
        [id]: { ...state.lines[id], ...updates },
      },
    }));
    get().regenerateTransfers();
  },

  addRunEdge(edge) {
    const id = crypto.randomUUID();
    set(state => ({ runEdges: [...state.runEdges, { ...edge, id }] }));
  },

  removeRunEdge(id) {
    set(state => ({
      runEdges: state.runEdges.filter(e => e.id !== id),
      selectedRunEdgeId: state.selectedRunEdgeId === id ? null : state.selectedRunEdgeId,
    }));
  },

  updateRunEdge(id, updates) {
    set(state => ({
      runEdges: state.runEdges.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  },

  updateTransfer(stationId, fromLineId, toLineId, transferMin) {
    set(state => ({
      transfers: state.transfers.map(t =>
        t.stationId === stationId && t.fromLineId === fromLineId && t.toLineId === toLineId
          ? { ...t, transferMin }
          : t
      ),
    }));
  },

  regenerateTransfers() {
    const { stations, lines, runEdges, transfers } = get();
    const fresh = generateTransfers({ stations, lines, runEdges, transfers });
    // Preserve any user-edited values
    const editedMap = new Map(
      transfers.map(t => [`${t.stationId}|${t.fromLineId}|${t.toLineId}`, t.transferMin])
    );
    const merged = fresh.map(t => {
      const key = `${t.stationId}|${t.fromLineId}|${t.toLineId}`;
      return editedMap.has(key) ? { ...t, transferMin: editedMap.get(key)! } : t;
    });
    set({ transfers: merged });
  },

  setMode(mode) {
    set({ mode });
  },

  setSelectedTool(tool) {
    set({ selectedTool: tool, selectedStationIds: [] });
  },

  setSelectedStationIds(ids) {
    set({ selectedStationIds: ids });
  },

  setSelectedLineId(id) {
    set({ selectedLineId: id, selectedRunEdgeId: null });
  },

  setSelectedRunEdgeId(id) {
    set({ selectedRunEdgeId: id, selectedLineId: null });
  },

  saveToJSON() {
    const { stations, lines, runEdges, transfers } = get();
    return JSON.stringify({ stations, lines, runEdges, transfers }, null, 2);
  },

  loadFromJSON(json) {
    try {
      const data = JSON.parse(json);
      set({
        stations: data.stations ?? {},
        lines: data.lines ?? {},
        runEdges: data.runEdges ?? [],
        transfers: data.transfers ?? [],
        selectedStationIds: [],
      });
    } catch (e) {
      console.error('Failed to load JSON:', e);
    }
  },

  setRouteStartTime(time) {
    set({ routeStartTime: time });
  },

  setPathfinderSelectedStation(stationId) {
    set({ pathfinderSelectedStation: stationId });
  },

  setTabFocusedStationId(stationId) {
    set({ tabFocusedStationId: stationId });
  },

  addRouteStep(stationId, connectionChoice) {
    const { currentRoute, routeStartTime, stations, lines, runEdges, transfers } = get();
    const graphState = { stations, lines, runEdges, transfers };

    // Determine currentTime and fromStationId
    let currentTime: number;
    let fromStationId: string;
    let previousLineId: string | null;

    if (currentRoute.length === 0) {
      // First step: stationId is the start, but addRouteStep needs a fromStation already set
      // The starting station step is added as a zero-duration entry
      const startStep: RouteStep = {
        stationId,
        lineId: null,
        arriveAt: routeStartTime,
        waitTime: 0,
        departAt: routeStartTime,
        travelTime: 0,
        cumulativeMin: routeStartTime,
      };
      set({ currentRoute: [startStep], pathfinderSelectedStation: stationId });
      return;
    }

    const lastStep = currentRoute[currentRoute.length - 1];
    fromStationId = lastStep.stationId;
    currentTime = lastStep.cumulativeMin;
    previousLineId = lastStep.lineId;

    // Build the Connection from connectionChoice
    let connection: Connection;
    if (connectionChoice.type === 'line') {
      connection = {
        type: 'line',
        lineId: connectionChoice.lineId,
        fromIdx: connectionChoice.fromIdx,
        toIdx: connectionChoice.toIdx,
        direction: connectionChoice.direction,
      };
    } else {
      connection = { type: 'run', edge: connectionChoice.edge };
    }

    const step = computeStepTiming(
      graphState,
      currentTime,
      fromStationId,
      stationId,
      connection,
      previousLineId
    );

    set(state => ({
      currentRoute: [...state.currentRoute, step],
      pathfinderSelectedStation: stationId,
    }));
  },

  undoLastStep() {
    const { currentRoute } = get();
    if (currentRoute.length === 0) return;
    const newRoute = currentRoute.slice(0, -1);
    const lastStation = newRoute.length > 0 ? newRoute[newRoute.length - 1].stationId : null;
    set({ currentRoute: newRoute, pathfinderSelectedStation: lastStation });
  },

  clearRoute() {
    set({ currentRoute: [], pathfinderSelectedStation: null });
  },

  saveCurrentRoute(name) {
    const { currentRoute, routeStartTime } = get();
    if (currentRoute.length === 0) return;
    const lastStep = currentRoute[currentRoute.length - 1];
    const totalMin = lastStep.cumulativeMin - routeStartTime;
    const saved: SavedRoute = { name, steps: [...currentRoute], totalMin, startTime: routeStartTime };
    set(state => ({ savedRoutes: [...state.savedRoutes, saved] }));
  },

  deleteSavedRoute(index) {
    set(state => ({
      savedRoutes: state.savedRoutes.filter((_, i) => i !== index),
    }));
  },
}));
