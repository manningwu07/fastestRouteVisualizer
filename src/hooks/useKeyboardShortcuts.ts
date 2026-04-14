import { useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';
import { matchesBinding, getKeybindings } from '../state/keybindings.js';
import { getConnectionsBetween } from '../engine/graph.js';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

export function useKeyboardShortcuts(opts: {
  onToggleShortcuts: () => void;
  onLoadGraph: () => void;
}) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in input elements
      if (isTypingTarget(e.target)) return;

      const s = storeRef.current;
      const o = optsRef.current;

      // --- General shortcuts (always available) ---

      if (matchesBinding('toggle_shortcuts', e)) {
        e.preventDefault();
        o.onToggleShortcuts();
        return;
      }

      if (matchesBinding('export_graph', e)) {
        e.preventDefault();
        const { activeGraphId, exportGraph } = s;
        exportGraph(activeGraphId);
        return;
      }

      if (matchesBinding('save_graph', e)) {
        e.preventDefault();
        s.saveCurrentGraph();
        s.showToast('Saved!');
        return;
      }

      if (matchesBinding('load_graph', e)) {
        e.preventDefault();
        o.onLoadGraph();
        return;
      }

      if (matchesBinding('mode_builder', e)) {
        e.preventDefault();
        s.setMode('builder');
        return;
      }

      if (matchesBinding('mode_pathfinder', e)) {
        e.preventDefault();
        s.setMode('pathfinder');
        return;
      }

      if (matchesBinding('deselect', e)) {
        e.preventDefault();
        if (s.mode === 'builder') {
          s.setSelectedStationIds([]);
          s.setSelectedLineId(null);
          s.setSelectedRunEdgeId(null);
          s.setTabFocusedStationId(null);
        } else {
          s.setTabFocusedStationId(null);
        }
        return;
      }

      // --- Builder mode shortcuts ---
      if (s.mode === 'builder') {
        if (matchesBinding('tool_select', e)) {
          e.preventDefault();
          s.setSelectedTool('select');
          return;
        }
        if (matchesBinding('tool_add_station', e)) {
          e.preventDefault();
          s.setSelectedTool('addStation');
          return;
        }
        if (matchesBinding('tool_add_line', e)) {
          e.preventDefault();
          s.setSelectedTool('addLine');
          return;
        }
        if (matchesBinding('tool_add_run_edge', e)) {
          e.preventDefault();
          s.setSelectedTool('addRunEdge');
          return;
        }

        if (matchesBinding('builder_undo_delete', e)) {
          e.preventDefault();
          s.undoBuilderDelete();
          return;
        }

        if (matchesBinding('delete_selected', e) || e.key === 'Backspace' && !isTypingTarget(e.target)) {
          if (s.selectedStationIds.length > 0) {
            e.preventDefault();
            s.removeStations(s.selectedStationIds);
            s.setSelectedStationIds([]);
            return;
          }
          if (s.selectedLineId) {
            e.preventDefault();
            s.removeLine(s.selectedLineId);
            return;
          }
          if (s.selectedRunEdgeId) {
            e.preventDefault();
            s.removeRunEdge(s.selectedRunEdgeId);
            return;
          }
        }

        // Tab cycle through stations
        if (matchesBinding('cycle_stations_forward', e) || matchesBinding('cycle_stations_backward', e)) {
          e.preventDefault();
          const stationList = Object.values(s.stations);
          if (stationList.length === 0) return;

          const backward = matchesBinding('cycle_stations_backward', e);
          const currentTabId = s.tabFocusedStationId;

          let idx = stationList.findIndex(st => st.id === currentTabId);
          if (idx === -1) {
            idx = backward ? stationList.length - 1 : 0;
          } else {
            idx = backward
              ? (idx - 1 + stationList.length) % stationList.length
              : (idx + 1) % stationList.length;
          }
          const target = stationList[idx];
          s.setTabFocusedStationId(target.id);
          s.setSelectedStationIds([target.id]);
          s.setSelectedLineId(null);
          s.setSelectedRunEdgeId(null);
          return;
        }

        if (matchesBinding('edit_selected', e)) {
          e.preventDefault();
          // 'e' to edit: if tab-focused station, select it and the panel will show
          if (s.tabFocusedStationId) {
            s.setSelectedStationIds([s.tabFocusedStationId]);
            s.setSelectedTool('select');
          }
          return;
        }
      }

      // --- Pathfinder mode shortcuts ---
      if (s.mode === 'pathfinder') {
        if (matchesBinding('pf_undo', e)) {
          e.preventDefault();
          s.undoLastStep();
          return;
        }
        if (matchesBinding('pf_clear', e)) {
          e.preventDefault();
          s.clearRoute();
          return;
        }
        if (matchesBinding('pf_save', e)) {
          e.preventDefault();
          if (s.currentRoute.length >= 2) {
            const name = prompt('Name this route:');
            if (name) s.saveCurrentRoute(name);
          }
          return;
        }

        // Tab cycle through reachable stations (or all if no route started)
        if (matchesBinding('pf_cycle_forward', e) || matchesBinding('pf_cycle_backward', e)) {
          e.preventDefault();
          const backward = matchesBinding('pf_cycle_backward', e);

          let candidates: string[];
          if (s.currentRoute.length === 0) {
            candidates = Object.keys(s.stations);
          } else {
            const lastStep = s.currentRoute[s.currentRoute.length - 1];
            const graphState = { stations: s.stations, lines: s.lines, runEdges: s.runEdges, transfers: s.transfers };
            // Get all stations reachable from current position
            candidates = Object.keys(s.stations).filter(id => {
              if (id === lastStep.stationId) return false;
              const conns = getConnectionsBetween(graphState, lastStep.stationId, id);
              return conns.length > 0;
            });
          }

          if (candidates.length === 0) return;

          const currentTabId = s.tabFocusedStationId;
          let idx = candidates.indexOf(currentTabId ?? '');
          if (idx === -1) {
            idx = backward ? candidates.length - 1 : 0;
          } else {
            idx = backward
              ? (idx - 1 + candidates.length) % candidates.length
              : (idx + 1) % candidates.length;
          }
          s.setTabFocusedStationId(candidates[idx]);
          return;
        }

        if (matchesBinding('pf_confirm', e)) {
          e.preventDefault();
          const tabId = s.tabFocusedStationId;
          if (!tabId) return;

          if (s.currentRoute.length === 0) {
            s.addRouteStep(tabId, { type: 'run', edge: { id: '', from: tabId, to: tabId, timeMin: 0, bidirectional: false } });
            s.setTabFocusedStationId(null);
            return;
          }

          const lastStep = s.currentRoute[s.currentRoute.length - 1];
          if (tabId === lastStep.stationId) return;
          const graphState = { stations: s.stations, lines: s.lines, runEdges: s.runEdges, transfers: s.transfers };
          const connections = getConnectionsBetween(graphState, lastStep.stationId, tabId);
          if (connections.length === 0) return;
          // Use first connection automatically on Enter
          const conn = connections[0];
          s.addRouteStep(tabId, conn.type === 'line'
            ? { type: 'line', lineId: conn.lineId, fromIdx: conn.fromIdx, toIdx: conn.toIdx, direction: conn.direction }
            : { type: 'run', edge: conn.edge }
          );
          s.setTabFocusedStationId(null);
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
