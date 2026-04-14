import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../state/store.js';
import { getConnectionsBetween } from '../engine/graph.js';
import type { Connection } from '../engine/graph.js';
import { ConnectionPicker } from './ConnectionPicker.js';

const STATION_RADIUS = 12;
const HIT_THRESHOLD = 8;
const PARALLEL_OFFSET = 5; // px between parallel lines

/**
 * For each segment (sorted stationId pair), build a map to a list of line IDs
 * that use that segment. We use this to compute visual offsets.
 */
function buildSegmentLineMap(lines: Record<string, import('../engine/types.js').TransitLine>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of Object.values(lines)) {
    for (let i = 0; i < line.stops.length - 1; i++) {
      const a = line.stops[i];
      const b = line.stops[i + 1];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(line.id);
    }
  }
  return map;
}

interface DragState {
  stationId: string;
  offsetX: number;
  offsetY: number;
}

/** Returns the distance from point (px,py) to segment (ax,ay)-(bx,by). */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pickerState, setPickerState] = useState<{
    toStationId: string;
    connections: Connection[];
  } | null>(null);

  const {
    mode,
    stations,
    lines,
    runEdges,
    transfers,
    selectedTool,
    selectedStationIds,
    selectedLineId,
    selectedRunEdgeId,
    currentRoute,
    pathfinderSelectedStation,
    tabFocusedStationId,
    addStation,
    updateStation,
    setSelectedStationIds,
    setSelectedLineId,
    setSelectedRunEdgeId,
    addRouteStep,
    setPathfinderSelectedStation,
  } = useStore();

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasSize({
          width: e.contentRect.width,
          height: e.contentRect.height,
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid dots
    ctx.fillStyle = '#1e1e3a';
    for (let x = 0; x < canvas.width; x += 40) {
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Build segment line map for parallel rendering
    const segLineMap = buildSegmentLineMap(lines);

    // Draw transit lines
    for (const line of Object.values(lines)) {
      if (line.stops.length < 2) continue;
      const isSelected = line.id === selectedLineId;

      ctx.strokeStyle = line.color || '#888';
      ctx.lineCap = 'round';
      ctx.setLineDash([]);

      for (let i = 0; i < line.stops.length - 1; i++) {
        const a = stations[line.stops[i]];
        const b = stations[line.stops[i + 1]];
        if (!a || !b) continue;

        // Compute parallel offset
        const segKeyAB = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        const lineIds = segLineMap.get(segKeyAB) ?? [line.id];
        const totalLines = lineIds.length;
        const lineIdx = lineIds.indexOf(line.id);
        // Center offsets so lines are symmetric around the original path
        const offsetMag = (lineIdx - (totalLines - 1) / 2) * PARALLEL_OFFSET;

        // Perpendicular direction
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const ax2 = a.x + nx * offsetMag;
        const ay2 = a.y + ny * offsetMag;
        const bx2 = b.x + nx * offsetMag;
        const by2 = b.y + ny * offsetMag;

        // Glow for selected
        if (isSelected) {
          ctx.lineWidth = 10;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.moveTo(ax2, ay2);
          ctx.lineTo(bx2, by2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.lineWidth = isSelected ? 6 : 4;
        ctx.beginPath();
        ctx.moveTo(ax2, ay2);
        ctx.lineTo(bx2, by2);
        ctx.stroke();

        // Travel time label on the offset midpoint
        ctx.fillStyle = line.color || '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        const mx = (ax2 + bx2) / 2;
        const my = (ay2 + by2) / 2 - 6;
        ctx.fillText(`${line.travelTimes[i]}m`, mx, my);
      }
    }

    // Draw run edges
    for (const edge of runEdges) {
      const from = stations[edge.from];
      const to = stations[edge.to];
      if (!from || !to) continue;
      const isSelected = edge.id === selectedRunEdgeId;
      const edgeColor = '#f0c060';

      // Glow for selected
      if (isSelected) {
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Arrow tip
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = edgeColor;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - 8 * Math.cos(angle - 0.4), my - 8 * Math.sin(angle - 0.4));
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - 8 * Math.cos(angle + 0.4), my - 8 * Math.sin(angle + 0.4));
      ctx.stroke();
      ctx.setLineDash([6, 4]);

      // Label
      ctx.fillStyle = edgeColor;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${edge.timeMin}m`, mx, my - 8);
    }
    ctx.setLineDash([]);

    // Pathfinder: draw route arrows
    if (mode === 'pathfinder' && currentRoute.length >= 2) {
      for (let i = 0; i < currentRoute.length - 1; i++) {
        const step = currentRoute[i];
        const nextStep = currentRoute[i + 1];
        const from = stations[step.stationId];
        const to = stations[nextStep.stationId];
        if (!from || !to) continue;

        const isRun = step.lineId === null;
        const lineColor = step.lineId ? (lines[step.lineId]?.color ?? '#7ec8e3') : '#f0c060';

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        if (isRun) {
          ctx.setLineDash([8, 5]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow tip near destination
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const tipX = to.x - (STATION_RADIUS + 6) * Math.cos(angle);
        const tipY = to.y - (STATION_RADIUS + 6) * Math.sin(angle);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 10 * Math.cos(angle - 0.4), tipY - 10 * Math.sin(angle - 0.4));
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 10 * Math.cos(angle + 0.4), tipY - 10 * Math.sin(angle + 0.4));
        ctx.stroke();
      }
    }

    // Build pathfinder visited set
    const visitedStepNums: Record<string, number[]> = {};
    if (mode === 'pathfinder') {
      currentRoute.forEach((step, i) => {
        if (!visitedStepNums[step.stationId]) visitedStepNums[step.stationId] = [];
        visitedStepNums[step.stationId].push(i + 1);
      });
    }

    // Draw stations
    for (const st of Object.values(stations)) {
      const isSelected = selectedStationIds.includes(st.id);
      const isPathfinderCurrent = mode === 'pathfinder' && pathfinderSelectedStation === st.id;
      const isVisited = mode === 'pathfinder' && visitedStepNums[st.id] !== undefined;
      const stepNums = visitedStepNums[st.id] ?? [];

      const isTabFocused = tabFocusedStationId === st.id;

      // Tab-focus ring (outermost, dashed)
      if (isTabFocused) {
        ctx.beginPath();
        ctx.arc(st.x, st.y, STATION_RADIUS + 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#f0c060';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Outer ring for selected / pathfinder current
      if (isSelected || isPathfinderCurrent) {
        ctx.beginPath();
        ctx.arc(st.x, st.y, STATION_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = isPathfinderCurrent ? '#7ec8e3' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Station circle
      ctx.beginPath();
      ctx.arc(st.x, st.y, STATION_RADIUS, 0, Math.PI * 2);
      let fillColor = isSelected ? '#7ec8e3' : '#2a4a6a';
      if (mode === 'pathfinder') {
        if (isPathfinderCurrent) fillColor = '#3a8aaa';
        else if (isVisited) fillColor = '#2a5a3a';
        else fillColor = '#1a2a3a';
      }
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : isPathfinderCurrent ? '#7ec8e3' : isVisited ? '#5ec870' : '#7ec8e3';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Step number badge in pathfinder
      if (mode === 'pathfinder' && stepNums.length > 0) {
        const label = stepNums[stepNums.length - 1].toString();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, st.x, st.y);
        ctx.textBaseline = 'alphabetic';
      }

      // Name label
      ctx.fillStyle = mode === 'pathfinder' && !isVisited ? '#556' : '#e8e8f0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.name, st.x, st.y - STATION_RADIUS - 6);

      // Agency sub-label
      if (st.agency) {
        ctx.fillStyle = '#888';
        ctx.font = '9px monospace';
        ctx.fillText(st.agency, st.x, st.y + STATION_RADIUS + 14);
      }
    }
  }, [stations, lines, runEdges, selectedStationIds, selectedLineId, selectedRunEdgeId, canvasSize, mode, currentRoute, pathfinderSelectedStation, tabFocusedStationId]);

  function getStationAtPoint(x: number, y: number): string | null {
    for (const st of Object.values(stations)) {
      const dx = st.x - x;
      const dy = st.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= STATION_RADIUS + 4) {
        return st.id;
      }
    }
    return null;
  }

  /** Returns the id of the closest transit line segment within HIT_THRESHOLD, or null. */
  function getLineAtPoint(x: number, y: number): string | null {
    let bestId: string | null = null;
    let bestDist = HIT_THRESHOLD;
    for (const line of Object.values(lines)) {
      for (let i = 0; i < line.stops.length - 1; i++) {
        const a = stations[line.stops[i]];
        const b = stations[line.stops[i + 1]];
        if (!a || !b) continue;
        const dist = pointToSegmentDist(x, y, a.x, a.y, b.x, b.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = line.id;
        }
      }
    }
    return bestId;
  }

  /** Returns the id of the closest run edge within HIT_THRESHOLD, or null. */
  function getRunEdgeAtPoint(x: number, y: number): string | null {
    let bestId: string | null = null;
    let bestDist = HIT_THRESHOLD;
    for (const edge of runEdges) {
      const from = stations[edge.from];
      const to = stations[edge.to];
      if (!from || !to) continue;
      const dist = pointToSegmentDist(x, y, from.x, from.y, to.x, to.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = edge.id;
      }
    }
    return bestId;
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Pathfinder mode click handling
      if (mode === 'pathfinder') {
        const hit = getStationAtPoint(x, y);
        if (!hit) return;

        // If no route yet, start here
        if (currentRoute.length === 0) {
          addRouteStep(hit, { type: 'run', edge: { id: '', from: hit, to: hit, timeMin: 0, bidirectional: false } });
          return;
        }

        const lastStep = currentRoute[currentRoute.length - 1];
        const fromStationId = lastStep.stationId;

        // Don't navigate to same station
        if (hit === fromStationId) return;

        const graphState = { stations, lines, runEdges, transfers };
        const connections = getConnectionsBetween(graphState, fromStationId, hit);

        if (connections.length === 0) return; // no connection
        if (connections.length === 1) {
          addRouteStep(hit, connections[0].type === 'line'
            ? { type: 'line', lineId: connections[0].lineId, fromIdx: connections[0].fromIdx, toIdx: connections[0].toIdx }
            : { type: 'run', edge: connections[0].edge }
          );
        } else {
          setPickerState({ toStationId: hit, connections });
        }
        return;
      }

      if (selectedTool === 'addStation') {
        const name = `S${Object.keys(stations).length + 1}`;
        addStation(name, x, y);
        return;
      }

      if (selectedTool === 'select') {
        const hitStation = getStationAtPoint(x, y);
        if (hitStation) {
          setSelectedStationIds([hitStation]);
          setSelectedLineId(null);
          setSelectedRunEdgeId(null);
          const st = stations[hitStation];
          dragRef.current = { stationId: hitStation, offsetX: x - st.x, offsetY: y - st.y };
        } else {
          // Check for line or run edge hit
          const hitLine = getLineAtPoint(x, y);
          if (hitLine) {
            setSelectedLineId(hitLine);
            setSelectedStationIds([]);
          } else {
            const hitEdge = getRunEdgeAtPoint(x, y);
            if (hitEdge) {
              setSelectedRunEdgeId(hitEdge);
              setSelectedStationIds([]);
            } else {
              setSelectedStationIds([]);
              setSelectedLineId(null);
              setSelectedRunEdgeId(null);
            }
          }
        }
        return;
      }

      if (selectedTool === 'addLine' || selectedTool === 'addRunEdge') {
        const hit = getStationAtPoint(x, y);
        if (!hit) return;
        if (selectedStationIds.includes(hit)) {
          // deselect
          setSelectedStationIds(selectedStationIds.filter(id => id !== hit));
        } else {
          setSelectedStationIds([...selectedStationIds, hit]);
        }
      }
    },
    [mode, selectedTool, stations, lines, runEdges, transfers, selectedStationIds, currentRoute, addStation, setSelectedStationIds, setSelectedLineId, setSelectedRunEdgeId, addRouteStep]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragRef.current) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateStation(dragRef.current.stationId, {
        x: x - dragRef.current.offsetX,
        y: y - dragRef.current.offsetY,
      });
    },
    [updateStation]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== 'builder' || selectedTool !== 'select') return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Prefer line hit on double-click (ignore station)
      const hitLine = getLineAtPoint(x, y);
      if (hitLine) {
        setSelectedLineId(hitLine);
        setSelectedStationIds([]);
        return;
      }
      const hitEdge = getRunEdgeAtPoint(x, y);
      if (hitEdge) {
        setSelectedRunEdgeId(hitEdge);
        setSelectedStationIds([]);
      }
    },
    [mode, selectedTool, stations, lines, runEdges, setSelectedLineId, setSelectedRunEdgeId, setSelectedStationIds]
  );

  const [rightClickMenu, setRightClickMenu] = useState<{
    x: number; y: number; stationId: string;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (mode !== 'builder') return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = getStationAtPoint(x, y);
      if (hit) {
        setRightClickMenu({ x: e.clientX, y: e.clientY, stationId: hit });
      }
    },
    [mode, stations]
  );

  const canvasCursor = mode === 'pathfinder'
    ? 'pointer'
    : selectedTool === 'addStation'
    ? 'crosshair'
    : selectedTool === 'select'
    ? 'default'
    : 'pointer';

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ cursor: canvasCursor, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      <div style={styles.hint}>
        {mode === 'pathfinder' && currentRoute.length === 0 && 'Click a station to start your route'}
        {mode === 'pathfinder' && currentRoute.length > 0 && 'Click a connected station to add to route'}
        {mode === 'builder' && selectedTool === 'addStation' && 'Click on canvas to place a station'}
        {mode === 'builder' && selectedTool === 'select' && 'Click or double-click a line/edge to edit it'}
        {mode === 'builder' && selectedTool === 'addLine' && 'Click stations in order to build a line (2+ required), then configure in the panel'}
        {mode === 'builder' && selectedTool === 'addRunEdge' && 'Click exactly 2 stations to create a run edge'}
      </div>
      {rightClickMenu && (
        <RightClickMenu
          x={rightClickMenu.x}
          y={rightClickMenu.y}
          stationId={rightClickMenu.stationId}
          onClose={() => setRightClickMenu(null)}
        />
      )}
      {pickerState && (
        <ConnectionPicker
          toStationId={pickerState.toStationId}
          connections={pickerState.connections}
          onPick={(conn) => {
            const choice = conn.type === 'line'
              ? { type: 'line' as const, lineId: conn.lineId, fromIdx: conn.fromIdx, toIdx: conn.toIdx }
              : { type: 'run' as const, edge: conn.edge };
            addRouteStep(pickerState.toStationId, choice);
            setPickerState(null);
          }}
          onCancel={() => setPickerState(null)}
        />
      )}
    </div>
  );
}

function RightClickMenu({
  x, y, stationId, onClose
}: { x: number; y: number; stationId: string; onClose: () => void }) {
  const { stations, lines, setSelectedLineId, setSelectedStationIds } = useStore();
  const station = stations[stationId];

  // Find lines that pass through this station
  const linesThrough = Object.values(lines).filter(l => l.stops.includes(stationId));

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); });
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: 12,
        zIndex: 1000,
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: '6px 10px', color: '#7ec8e3', borderBottom: '1px solid #333', fontWeight: 700, fontSize: 11 }}>
        {station?.name ?? stationId}
      </div>
      {linesThrough.length === 0 ? (
        <div style={{ padding: '6px 10px', color: '#555' }}>No lines through this station</div>
      ) : (
        <>
          <div style={{ padding: '4px 10px', color: '#888', fontSize: 10 }}>Lines through this station:</div>
          {linesThrough.map(line => (
            <div
              key={line.id}
              style={{
                padding: '5px 10px',
                color: line.color,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onClick={() => {
                setSelectedLineId(line.id);
                setSelectedStationIds([]);
                onClose();
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: line.color, flexShrink: 0, display: 'inline-block' }} />
              {line.agency} ({line.stops.length} stops)
            </div>
          ))}
        </>
      )}
      <div
        style={{ padding: '5px 10px', color: '#666', cursor: 'pointer', borderTop: '1px solid #222', fontSize: 11 }}
        onClick={onClose}
      >
        Close
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    background: '#0d0d1a',
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 11,
    pointerEvents: 'none',
  },
};
