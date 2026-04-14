import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../state/store.js';

const STATION_RADIUS = 12;
const HIT_THRESHOLD = 10;
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

interface PanState {
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
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
  const panRef = useRef<PanState | null>(null);
  const lastLineClickRef = useRef<{ x: number; y: number; lineIds: string[]; idx: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Zoom/pan state — keep both React state (for re-render) and refs (for sync access in handlers)
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const zoomRef = useRef(1.0);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const [isPanning, setIsPanning] = useState(false);

  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  /** Convert screen coordinates to world coordinates */
  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - panXRef.current) / zoomRef.current,
      y: (sy - panYRef.current) / zoomRef.current,
    };
  }

  const {
    mode,
    stations,
    lines,
    runEdges,
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
    addPathfinderWaypoint,
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

  // Wheel zoom (non-passive listener so we can preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.25, Math.min(4.0, zoomRef.current * factor));

      // Keep the world point under the cursor stationary
      const worldX = (mouseX - panXRef.current) / zoomRef.current;
      const worldY = (mouseY - panYRef.current) / zoomRef.current;
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      zoomRef.current = newZoom;
      panXRef.current = newPanX;
      panYRef.current = newPanY;
      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasSize]);

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

    // Draw grid dots offset by pan (screen space — intentionally not scaled)
    ctx.fillStyle = '#1e1e3a';
    const gridSpacing = 40;
    const startX = ((panX % gridSpacing) + gridSpacing) % gridSpacing;
    const startY = ((panY % gridSpacing) + gridSpacing) % gridSpacing;
    for (let gx = startX; gx < canvas.width; gx += gridSpacing) {
      for (let gy = startY; gy < canvas.height; gy += gridSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Apply zoom/pan transform for world-space drawing
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

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

        const segKeyAB = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        const lineIds = segLineMap.get(segKeyAB) ?? [line.id];
        const totalLines = lineIds.length;
        const lineIdx = lineIds.indexOf(line.id);
        const offsetMag = (lineIdx - (totalLines - 1) / 2) * PARALLEL_OFFSET;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const ax2 = a.x + nx * offsetMag;
        const ay2 = a.y + ny * offsetMag;
        const bx2 = b.x + nx * offsetMag;
        const by2 = b.y + ny * offsetMag;

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

        // Travel time label
        ctx.fillStyle = line.color || '#888';
        ctx.font = '13px monospace';
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

      ctx.fillStyle = edgeColor;
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${edge.timeMin}m`, mx, my - 8);
    }
    ctx.setLineDash([]);

    // Pathfinder route arrows
    if (mode === 'pathfinder' && currentRoute.length >= 2) {
      for (let i = 0; i < currentRoute.length - 1; i++) {
        const fromStep = currentRoute[i];
        const toStep = currentRoute[i + 1];
        const from = stations[fromStep.stationId];
        const to = stations[toStep.stationId];
        if (!from || !to) continue;

        const isRun = toStep.lineId === null;
        const lineColor = toStep.lineId ? (lines[toStep.lineId]?.color ?? '#7ec8e3') : '#f0c060';

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.setLineDash(isRun ? [8, 5] : []);

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

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

      if (isTabFocused) {
        ctx.beginPath();
        ctx.arc(st.x, st.y, STATION_RADIUS + 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#f0c060';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSelected || isPathfinderCurrent) {
        ctx.beginPath();
        ctx.arc(st.x, st.y, STATION_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = isPathfinderCurrent ? '#7ec8e3' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

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

      if (mode === 'pathfinder' && stepNums.length > 0) {
        const label = stepNums[stepNums.length - 1].toString();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, st.x, st.y);
        ctx.textBaseline = 'alphabetic';
      }

      // Station name label
      ctx.fillStyle = mode === 'pathfinder' && !isVisited ? '#556' : '#e8e8f0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.name, st.x, st.y - STATION_RADIUS - 6);

      // Agency sub-label
      if (st.agencies && st.agencies.length > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText(st.agencies.join(', '), st.x, st.y + STATION_RADIUS + 16);
      }
    }

    ctx.restore();

    // HUD: zoom level (screen space)
    const hudText = `zoom: ${zoom.toFixed(2)}x`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 90, 22);
    ctx.fillStyle = '#7ec8e3';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hudText, 14, 19);
    ctx.textBaseline = 'alphabetic';

  }, [stations, lines, runEdges, selectedStationIds, selectedLineId, selectedRunEdgeId, canvasSize, mode, currentRoute, pathfinderSelectedStation, tabFocusedStationId, zoom, panX, panY]);

  function getStationAtPoint(worldX: number, worldY: number): string | null {
    for (const st of Object.values(stations)) {
      const dx = st.x - worldX;
      const dy = st.y - worldY;
      if (Math.sqrt(dx * dx + dy * dy) <= STATION_RADIUS + 4) {
        return st.id;
      }
    }
    return null;
  }

  function getLineAtPoint(worldX: number, worldY: number): string | null {
    let bestId: string | null = null;
    let bestDist = HIT_THRESHOLD;
    for (const line of Object.values(lines)) {
      for (let i = 0; i < line.stops.length - 1; i++) {
        const a = stations[line.stops[i]];
        const b = stations[line.stops[i + 1]];
        if (!a || !b) continue;
        const dist = pointToSegmentDist(worldX, worldY, a.x, a.y, b.x, b.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = line.id;
        }
      }
    }
    return bestId;
  }

  function getRunEdgeAtPoint(worldX: number, worldY: number): string | null {
    let bestId: string | null = null;
    let bestDist = HIT_THRESHOLD;
    for (const edge of runEdges) {
      const from = stations[edge.from];
      const to = stations[edge.to];
      if (!from || !to) continue;
      const dist = pointToSegmentDist(worldX, worldY, from.x, from.y, to.x, to.y);
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
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Middle mouse button or Ctrl+left drag = pan
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        e.preventDefault();
        setIsPanning(true);
        panRef.current = {
          startX: screenX,
          startY: screenY,
          startPanX: panXRef.current,
          startPanY: panYRef.current,
        };
        return;
      }

      const { x, y } = screenToWorld(screenX, screenY);

      if (mode === 'pathfinder') {
        const hit = getStationAtPoint(x, y);
        if (!hit) return;
        addPathfinderWaypoint(hit);
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
          setSelectedStationIds(selectedStationIds.filter(id => id !== hit));
        } else {
          setSelectedStationIds([...selectedStationIds, hit]);
        }
      }
    },
    [mode, selectedTool, stations, lines, runEdges, selectedStationIds, addStation, setSelectedStationIds, setSelectedLineId, setSelectedRunEdgeId, addPathfinderWaypoint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (panRef.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const newPanX = panRef.current.startPanX + (screenX - panRef.current.startX);
        const newPanY = panRef.current.startPanY + (screenY - panRef.current.startY);
        panXRef.current = newPanX;
        panYRef.current = newPanY;
        setPanX(newPanX);
        setPanY(newPanY);
        return;
      }

      if (!dragRef.current) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToWorld(screenX, screenY);
      updateStation(dragRef.current.stationId, {
        x: x - dragRef.current.offsetX,
        y: y - dragRef.current.offsetY,
      });
    },
    [updateStation]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToWorld(screenX, screenY);

      if (mode === 'builder' && selectedTool === 'select') {
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
          return;
        }
        const hitStation = getStationAtPoint(x, y);
        if (!hitStation) {
          // Reset zoom/pan
          zoomRef.current = 1.0; panXRef.current = 0; panYRef.current = 0;
          setZoom(1.0); setPanX(0); setPanY(0);
        }
        return;
      }

      // In pathfinder mode, double-click empty space resets zoom too
      const hitStation = getStationAtPoint(x, y);
      if (!hitStation) {
        zoomRef.current = 1.0; panXRef.current = 0; panYRef.current = 0;
        setZoom(1.0); setPanX(0); setPanY(0);
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
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { x, y } = screenToWorld(screenX, screenY);
      const hit = getStationAtPoint(x, y);
      if (hit) {
        setRightClickMenu({ x: e.clientX, y: e.clientY, stationId: hit });
      }
    },
    [mode, stations]
  );

  const canvasCursor = isPanning
    ? 'grabbing'
    : mode === 'pathfinder'
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
        {mode === 'pathfinder' && 'Click stations in order to create waypoints'}
        {mode === 'builder' && selectedTool === 'addStation' && 'Click on canvas to place a station'}
        {mode === 'builder' && selectedTool === 'select' && 'Scroll to zoom • Ctrl+drag or middle-drag to pan • Double-click empty to reset zoom'}
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
    </div>
  );
}

function RightClickMenu({
  x, y, stationId, onClose
}: { x: number; y: number; stationId: string; onClose: () => void }) {
  const { stations, lines, setSelectedLineId, setSelectedStationIds } = useStore();
  const station = stations[stationId];

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
        fontSize: 13,
        zIndex: 1000,
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: '6px 10px', color: '#7ec8e3', borderBottom: '1px solid #333', fontWeight: 700, fontSize: 13 }}>
        {station?.name ?? stationId}
      </div>
      {linesThrough.length === 0 ? (
        <div style={{ padding: '6px 10px', color: '#555' }}>No lines through this station</div>
      ) : (
        <>
          <div style={{ padding: '4px 10px', color: '#888', fontSize: 11 }}>Lines through this station:</div>
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
        style={{ padding: '5px 10px', color: '#666', cursor: 'pointer', borderTop: '1px solid #222', fontSize: 12 }}
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
    fontSize: 12,
    pointerEvents: 'none',
  },
};
