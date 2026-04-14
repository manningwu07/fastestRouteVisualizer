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

export interface GraphState {
  stations: Record<string, Station>;
  lines: Record<string, TransitLine>;
  runEdges: RunEdge[];
  transfers: Transfer[];
}

export interface SavedGraph {
  id: string;
  name: string;
  data: GraphState;
  lastModified: number;
}

const GRAPHS_STORAGE_KEY = 'transit_saved_graphs';
const ACTIVE_GRAPH_STORAGE_KEY = 'transit_active_graph_id';
const MAX_BUILDER_UNDO_STEPS = 30;

export interface AppState {
  mode: AppMode;
  stations: Record<string, Station>;
  lines: Record<string, TransitLine>;
  runEdges: RunEdge[];
  transfers: Transfer[];
  builderUndoStack: GraphState[];
  selectedTool: ToolMode;
  selectedStationIds: string[];
  selectedLineId: string | null;
  selectedRunEdgeId: string | null;

  // Multi-graph state
  savedGraphs: SavedGraph[];
  activeGraphId: string;

  // Toast
  toastMessage: string | null;

  // Pathfinder state
  currentRoute: RouteStep[];
  routeStartTime: number;
  savedRoutes: SavedRoute[];
  pathfinderSelectedStation: string | null;

  // Tab navigation
  tabFocusedStationId: string | null;

  addStation(name: string, x: number, y: number, agencies?: string[]): void;
  updateStation(id: string, updates: Partial<Station>): void;
  removeStation(id: string): void;
  removeStations(ids: string[]): void;
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

  // Multi-graph actions
  createNewGraph(name?: string): void;
  switchGraph(id: string): void;
  renameGraph(id: string, name: string): void;
  deleteGraph(id: string): void;
  saveCurrentGraph(): void;
  loadGraphsFromStorage(): void;
  exportGraph(id: string): void;
  importGraph(json: string): void;

  // Toast actions
  showToast(message: string): void;

  // Pathfinder actions
  setRouteStartTime(time: number): void;
  setPathfinderSelectedStation(stationId: string | null): void;
  setTabFocusedStationId(stationId: string | null): void;
  pushBuilderUndoSnapshot(): void;
  undoBuilderDelete(): void;
  addRouteStep(
    stationId: string,
    connectionChoice: { type: 'line'; lineId: string; fromIdx: number; toIdx: number; direction: 'forward' | 'reverse' } | { type: 'run'; edge: RunEdge }
  ): void;
  undoLastStep(): void;
  clearRoute(): void;
  saveCurrentRoute(name: string): void;
  deleteSavedRoute(index: number): void;
}

function emptyGraphState(): GraphState {
  return { stations: {}, lines: {}, runEdges: [], transfers: [] };
}

function persistGraphs(savedGraphs: SavedGraph[], activeGraphId: string): void {
  try {
    localStorage.setItem(GRAPHS_STORAGE_KEY, JSON.stringify(savedGraphs));
    localStorage.setItem(ACTIVE_GRAPH_STORAGE_KEY, activeGraphId);
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export const useStore = create<AppState>((set, get) => ({
  mode: 'builder',
  stations: {},
  lines: {},
  runEdges: [],
  transfers: [],
  builderUndoStack: [],
  selectedTool: 'select',
  selectedStationIds: [],
  selectedLineId: null,
  selectedRunEdgeId: null,

  // Multi-graph defaults (will be overwritten by loadGraphsFromStorage)
  savedGraphs: [],
  activeGraphId: '',

  // Toast
  toastMessage: null,

  // Pathfinder defaults
  currentRoute: [],
  routeStartTime: 480,
  savedRoutes: [],
  pathfinderSelectedStation: null,
  tabFocusedStationId: null,

  addStation(name, x, y, agencies) {
    const id = crypto.randomUUID();
    const station: Station = { id, name, x, y, agencies: agencies ?? [] };
    set(state => ({ stations: { ...state.stations, [id]: station } }));
    get().saveCurrentGraph();
  },

  updateStation(id, updates) {
    set(state => ({
      stations: {
        ...state.stations,
        [id]: { ...state.stations[id], ...updates },
      },
    }));
    get().saveCurrentGraph();
  },

  pushBuilderUndoSnapshot() {
    const { stations, lines, runEdges, transfers } = get();
    const snapshot: GraphState = {
      stations: structuredClone(stations),
      lines: structuredClone(lines),
      runEdges: structuredClone(runEdges),
      transfers: structuredClone(transfers),
    };
    set(state => ({
      builderUndoStack: [...state.builderUndoStack, snapshot].slice(-MAX_BUILDER_UNDO_STEPS),
    }));
  },

  removeStation(id) {
    get().removeStations([id]);
  },

  removeStations(ids) {
    const uniqueIds = Array.from(new Set(ids)).filter(stationId => !!get().stations[stationId]);
    if (uniqueIds.length === 0) return;

    get().pushBuilderUndoSnapshot();

    set(state => {
      const idsToRemove = new Set(uniqueIds);
      const stations = { ...state.stations };
      for (const stationId of idsToRemove) {
        delete stations[stationId];
      }

      const runEdges = state.runEdges.filter(e => !idsToRemove.has(e.from) && !idsToRemove.has(e.to));
      const lines: Record<string, TransitLine> = {};
      for (const [lid, line] of Object.entries(state.lines)) {
        const stops = line.stops.filter(stationId => !idsToRemove.has(stationId));
        if (stops.length >= 2) {
          const travelTimes: number[] = [];
          for (let i = 0; i < line.stops.length - 1; i++) {
            if (!idsToRemove.has(line.stops[i]) && !idsToRemove.has(line.stops[i + 1])) {
              travelTimes.push(line.travelTimes[i]);
            }
          }
          lines[lid] = { ...line, stops, travelTimes };
        }
      }

      const selectedRunEdgeId = state.selectedRunEdgeId && runEdges.some(e => e.id === state.selectedRunEdgeId)
        ? state.selectedRunEdgeId
        : null;

      return {
        stations,
        runEdges,
        lines,
        selectedStationIds: state.selectedStationIds.filter(stationId => !idsToRemove.has(stationId)),
        selectedLineId: state.selectedLineId && lines[state.selectedLineId] ? state.selectedLineId : null,
        selectedRunEdgeId,
        tabFocusedStationId: state.tabFocusedStationId && stations[state.tabFocusedStationId] ? state.tabFocusedStationId : null,
      };
    });
    get().regenerateTransfers();
    get().saveCurrentGraph();
  },

  addLine(line) {
    const id = crypto.randomUUID();
    const bidirectional = line.bidirectional !== undefined ? line.bidirectional : true;
    set(state => ({
      lines: { ...state.lines, [id]: { ...line, bidirectional, id } },
    }));
    get().regenerateTransfers();
    get().saveCurrentGraph();
  },

  removeLine(id) {
    if (!get().lines[id]) return;
    get().pushBuilderUndoSnapshot();
    set(state => {
      const lines = { ...state.lines };
      delete lines[id];
      return { lines, selectedLineId: state.selectedLineId === id ? null : state.selectedLineId };
    });
    get().regenerateTransfers();
    get().saveCurrentGraph();
  },

  updateLine(id, updates) {
    set(state => ({
      lines: {
        ...state.lines,
        [id]: { ...state.lines[id], ...updates },
      },
    }));
    get().regenerateTransfers();
    get().saveCurrentGraph();
  },

  addRunEdge(edge) {
    const id = crypto.randomUUID();
    set(state => ({ runEdges: [...state.runEdges, { ...edge, id }] }));
    get().saveCurrentGraph();
  },

  removeRunEdge(id) {
    if (!get().runEdges.some(e => e.id === id)) return;
    get().pushBuilderUndoSnapshot();
    set(state => ({
      runEdges: state.runEdges.filter(e => e.id !== id),
      selectedRunEdgeId: state.selectedRunEdgeId === id ? null : state.selectedRunEdgeId,
    }));
    get().saveCurrentGraph();
  },

  updateRunEdge(id, updates) {
    set(state => ({
      runEdges: state.runEdges.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
    get().saveCurrentGraph();
  },

  updateTransfer(stationId, fromLineId, toLineId, transferMin) {
    set(state => ({
      transfers: state.transfers.map(t =>
        t.stationId === stationId && t.fromLineId === fromLineId && t.toLineId === toLineId
          ? { ...t, transferMin }
          : t
      ),
    }));
    get().saveCurrentGraph();
  },

  regenerateTransfers() {
    const { stations, lines, runEdges, transfers } = get();
    const fresh = generateTransfers({ stations, lines, runEdges, transfers });
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
        builderUndoStack: [],
        selectedStationIds: [],
      });
      get().saveCurrentGraph();
    } catch (e) {
      console.error('Failed to load JSON:', e);
    }
  },

  // ---- Multi-graph ----

  createNewGraph(name) {
    const { savedGraphs } = get();
    // Auto-name: "Graph 1", "Graph 2", …
    const resolvedName = name?.trim() ||
      (() => {
        let n = savedGraphs.length + 1;
        const existingNames = new Set(savedGraphs.map(g => g.name));
        while (existingNames.has(`Graph ${n}`)) n++;
        return `Graph ${n}`;
      })();

    const id = crypto.randomUUID();
    const newGraph: SavedGraph = {
      id,
      name: resolvedName,
      data: emptyGraphState(),
      lastModified: Date.now(),
    };

    // First save current graph state into its slot
    const { stations, lines, runEdges, transfers, activeGraphId } = get();
    const updatedGraphs = savedGraphs.map(g =>
      g.id === activeGraphId
        ? { ...g, data: { stations, lines, runEdges, transfers }, lastModified: Date.now() }
        : g
    );
    const nextGraphs = [...updatedGraphs, newGraph];

    set({
      savedGraphs: nextGraphs,
      activeGraphId: id,
      stations: {},
      lines: {},
      runEdges: [],
      transfers: [],
      builderUndoStack: [],
      selectedStationIds: [],
      selectedLineId: null,
      selectedRunEdgeId: null,
    });
    persistGraphs(nextGraphs, id);
  },

  switchGraph(id) {
    const { savedGraphs, activeGraphId, stations, lines, runEdges, transfers } = get();
    if (id === activeGraphId) return;

    // Save current graph
    const updatedGraphs = savedGraphs.map(g =>
      g.id === activeGraphId
        ? { ...g, data: { stations, lines, runEdges, transfers }, lastModified: Date.now() }
        : g
    );

    const target = updatedGraphs.find(g => g.id === id);
    if (!target) return;

    set({
      savedGraphs: updatedGraphs,
      activeGraphId: id,
      stations: target.data.stations,
      lines: target.data.lines,
      runEdges: target.data.runEdges,
      transfers: target.data.transfers,
      builderUndoStack: [],
      selectedStationIds: [],
      selectedLineId: null,
      selectedRunEdgeId: null,
    });
    persistGraphs(updatedGraphs, id);
  },

  renameGraph(id, name) {
    const { savedGraphs } = get();
    const updated = savedGraphs.map(g =>
      g.id === id ? { ...g, name: name.trim() || g.name, lastModified: Date.now() } : g
    );
    set({ savedGraphs: updated });
    persistGraphs(updated, get().activeGraphId);
  },

  deleteGraph(id) {
    const { savedGraphs, activeGraphId, stations, lines, runEdges, transfers } = get();
    if (savedGraphs.length <= 1) return; // can't delete last graph

    const remaining = savedGraphs.filter(g => g.id !== id);

    if (id === activeGraphId) {
      // Switch to the first remaining graph
      const next = remaining[0];
      set({
        savedGraphs: remaining,
        activeGraphId: next.id,
        stations: next.data.stations,
        lines: next.data.lines,
        runEdges: next.data.runEdges,
        transfers: next.data.transfers,
        builderUndoStack: [],
        selectedStationIds: [],
        selectedLineId: null,
        selectedRunEdgeId: null,
      });
      persistGraphs(remaining, next.id);
    } else {
      // Save current before persisting
      const updatedRemaining = remaining.map(g =>
        g.id === activeGraphId
          ? { ...g, data: { stations, lines, runEdges, transfers }, lastModified: Date.now() }
          : g
      );
      set({ savedGraphs: updatedRemaining });
      persistGraphs(updatedRemaining, activeGraphId);
    }
  },

  saveCurrentGraph() {
    const { savedGraphs, activeGraphId, stations, lines, runEdges, transfers } = get();
    if (!activeGraphId) return;
    const updated = savedGraphs.map(g =>
      g.id === activeGraphId
        ? { ...g, data: { stations, lines, runEdges, transfers }, lastModified: Date.now() }
        : g
    );
    set({ savedGraphs: updated });
    persistGraphs(updated, activeGraphId);
  },

  loadGraphsFromStorage() {
    try {
      const raw = localStorage.getItem(GRAPHS_STORAGE_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_GRAPH_STORAGE_KEY);

      if (raw) {
        const graphs: SavedGraph[] = JSON.parse(raw);
        if (graphs.length > 0) {
          const activeId = (savedActiveId && graphs.find(g => g.id === savedActiveId))
            ? savedActiveId
            : graphs[0].id;
          const active = graphs.find(g => g.id === activeId)!;
          set({
            savedGraphs: graphs,
            activeGraphId: activeId,
            stations: active.data.stations,
            lines: active.data.lines,
            runEdges: active.data.runEdges,
            transfers: active.data.transfers,
            builderUndoStack: [],
          });
          return;
        }
      }
    } catch {
      // ignore parse errors
    }

    // Nothing in storage — create default graph
    const id = crypto.randomUUID();
    const defaultGraph: SavedGraph = {
      id,
      name: 'Untitled',
      data: emptyGraphState(),
      lastModified: Date.now(),
    };
    set({
      savedGraphs: [defaultGraph],
      activeGraphId: id,
      stations: {},
      lines: {},
      runEdges: [],
      transfers: [],
      builderUndoStack: [],
    });
    persistGraphs([defaultGraph], id);
  },

  exportGraph(id) {
    const { savedGraphs, activeGraphId, stations, lines, runEdges, transfers } = get();
    let graph = savedGraphs.find(g => g.id === id);
    if (!graph) return;

    // If exporting active graph, use current live state
    if (id === activeGraphId) {
      graph = { ...graph, data: { stations, lines, runEdges, transfers } };
    }

    const json = JSON.stringify(graph.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    get().showToast('Graph exported');
  },

  importGraph(json) {
    try {
      const data = JSON.parse(json);
      const graphData: GraphState = {
        stations: data.stations ?? {},
        lines: data.lines ?? {},
        runEdges: data.runEdges ?? [],
        transfers: data.transfers ?? [],
      };

      const { savedGraphs } = get();
      let n = savedGraphs.length + 1;
      const existingNames = new Set(savedGraphs.map(g => g.name));
      while (existingNames.has(`Imported Graph ${n}`)) n++;

      const id = crypto.randomUUID();
      const newGraph: SavedGraph = {
        id,
        name: `Imported Graph ${n}`,
        data: graphData,
        lastModified: Date.now(),
      };

      // Save current graph first
      const { activeGraphId, stations, lines, runEdges, transfers } = get();
      const updatedGraphs = savedGraphs.map(g =>
        g.id === activeGraphId
          ? { ...g, data: { stations, lines, runEdges, transfers }, lastModified: Date.now() }
          : g
      );
      const nextGraphs = [...updatedGraphs, newGraph];

      set({
        savedGraphs: nextGraphs,
        activeGraphId: id,
        stations: graphData.stations,
        lines: graphData.lines,
        runEdges: graphData.runEdges,
        transfers: graphData.transfers,
        builderUndoStack: [],
        selectedStationIds: [],
        selectedLineId: null,
        selectedRunEdgeId: null,
      });
      persistGraphs(nextGraphs, id);
      get().showToast('Graph imported');
    } catch (e) {
      console.error('Failed to import graph:', e);
    }
  },

  // ---- Toast ----

  showToast(message) {
    set({ toastMessage: message });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 2000);
  },

  // ---- Pathfinder ----

  setRouteStartTime(time) {
    set({ routeStartTime: time });
  },

  setPathfinderSelectedStation(stationId) {
    set({ pathfinderSelectedStation: stationId });
  },

  setTabFocusedStationId(stationId) {
    set({ tabFocusedStationId: stationId });
  },

  undoBuilderDelete() {
    const { builderUndoStack } = get();
    if (builderUndoStack.length === 0) return;

    const snapshot = builderUndoStack[builderUndoStack.length - 1];
    set(state => ({
      stations: snapshot.stations,
      lines: snapshot.lines,
      runEdges: snapshot.runEdges,
      transfers: snapshot.transfers,
      selectedStationIds: [],
      selectedLineId: null,
      selectedRunEdgeId: null,
      tabFocusedStationId: null,
      builderUndoStack: state.builderUndoStack.slice(0, -1),
    }));
    get().saveCurrentGraph();
  },

  addRouteStep(stationId, connectionChoice) {
    const { currentRoute, routeStartTime, stations, lines, runEdges, transfers } = get();
    const graphState = { stations, lines, runEdges, transfers };

    let currentTime: number;
    let fromStationId: string;
    let previousLineId: string | null;

    if (currentRoute.length === 0) {
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
