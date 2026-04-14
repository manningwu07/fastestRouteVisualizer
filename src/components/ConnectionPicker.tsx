import React from 'react';
import type { Connection } from '../engine/graph.js';
import type { RunEdge } from '../engine/types.js';
import { useStore } from '../state/store.js';
import { getStationOffsetReverse } from '../engine/scheduler.js';

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface ConnectionPickerProps {
  toStationId: string;
  connections: Connection[];
  onPick: (connection: Connection) => void;
  onCancel: () => void;
}

export function ConnectionPicker({ toStationId, connections, onPick, onCancel }: ConnectionPickerProps) {
  const { lines, stations, currentRoute, routeStartTime } = useStore();

  const toStation = stations[toStationId];
  const lastStep = currentRoute.length > 0 ? currentRoute[currentRoute.length - 1] : null;
  const currentTime = lastStep ? lastStep.cumulativeMin : routeStartTime;

  function getDeparture(conn: Connection): number | null {
    if (conn.type === 'run') return currentTime;
    const line = lines[conn.lineId];
    if (!line) return null;

    let offset: number;
    let schedule;
    if (conn.direction === 'reverse') {
      offset = getStationOffsetReverse(line, conn.fromIdx);
      schedule = line.reverseSchedule ?? line.forwardSchedule;
    } else {
      offset = (() => {
        let o = 0;
        for (let i = 0; i < conn.fromIdx; i++) o += line.travelTimes[i];
        return o;
      })();
      schedule = line.forwardSchedule;
    }

    const firstAtStation = schedule.firstDeparture + offset;
    const lastAtStation = schedule.lastDeparture + offset;
    if (currentTime > lastAtStation) return null;
    if (currentTime <= firstAtStation) return firstAtStation;
    const elapsed = currentTime - firstAtStation;
    const cycles = Math.ceil(elapsed / schedule.headwayMin);
    const dep = firstAtStation + cycles * schedule.headwayMin;
    return dep > lastAtStation ? null : dep;
  }

  function getTravelTime(conn: Connection): number {
    if (conn.type === 'run') return conn.edge.timeMin;
    const line = lines[conn.lineId];
    if (!line) return 0;
    let t = 0;
    if (conn.direction === 'reverse') {
      // fromIdx > toIdx; sum segments between toIdx and fromIdx
      for (let i = conn.toIdx; i < conn.fromIdx; i++) t += line.travelTimes[i];
    } else {
      for (let i = conn.fromIdx; i < conn.toIdx; i++) t += line.travelTimes[i];
    }
    return t;
  }

  function getDirectionLabel(conn: Connection): string {
    if (conn.type === 'run') return '';
    const line = lines[conn.lineId];
    if (!line) return '';
    if (conn.direction === 'reverse') {
      // Traveling toward the first stop
      const terminalId = line.stops[0];
      const terminalName = stations[terminalId]?.name ?? terminalId;
      return `← toward ${terminalName}`;
    } else {
      // Traveling toward the last stop
      const terminalId = line.stops[line.stops.length - 1];
      const terminalName = stations[terminalId]?.name ?? terminalId;
      return `→ toward ${terminalName}`;
    }
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.picker} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          Choose connection to <span style={{ color: '#7ec8e3' }}>{toStation?.name ?? toStationId}</span>
        </div>
        {connections.map((conn, i) => {
          const dep = getDeparture(conn);
          const travelTime = getTravelTime(conn);
          const arrival = dep !== null ? dep + travelTime : null;
          const waitTime = dep !== null ? dep - currentTime : null;

          let label: string;
          let color: string;

          if (conn.type === 'line') {
            const line = lines[conn.lineId];
            label = line ? line.id.slice(0, 8) + (line.agency ? ` (${line.agency})` : '') : conn.lineId;
            color = line?.color ?? '#888';
          } else {
            label = 'Run';
            color = '#f0c060';
          }

          const directionLabel = getDirectionLabel(conn);

          return (
            <button
              key={i}
              style={{ ...styles.option, borderLeftColor: color }}
              onClick={() => onPick(conn)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color, fontWeight: 700, fontSize: 13 }}>
                  {conn.type === 'line' ? (lines[conn.lineId]?.id?.slice(0, 8) ?? conn.lineId) : 'Run'}
                  {conn.type === 'line' && lines[conn.lineId] && (
                    <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 6 }}>
                      {lines[conn.lineId].agency}
                    </span>
                  )}
                  {directionLabel && (
                    <span style={{ color: '#87c8e0', fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
                      {directionLabel}
                    </span>
                  )}
                </span>
                {dep !== null ? (
                  <span style={{ color: '#aaa', fontSize: 11 }}>Dep {toHHMM(dep)}</span>
                ) : (
                  <span style={{ color: '#e06060', fontSize: 11 }}>No more trains</span>
                )}
              </div>
              <div style={styles.optionDetails}>
                {waitTime !== null && (
                  <span>Wait: <span style={{ color: '#e8c87a' }}>{waitTime}m</span></span>
                )}
                <span>Travel: <span style={{ color: '#87e8a0' }}>{travelTime}m</span></span>
                {arrival !== null && (
                  <span>Arrive: <span style={{ color: '#7ec8e3' }}>{toHHMM(arrival)}</span></span>
                )}
              </div>
            </button>
          );
        })}
        <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  picker: {
    background: '#1a1a2e',
    border: '1px solid #334',
    borderRadius: 8,
    padding: 16,
    minWidth: 320,
    maxWidth: 480,
    maxHeight: '80vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: 'monospace',
  },
  header: {
    fontSize: 14,
    color: '#e8e8f0',
    marginBottom: 4,
    fontWeight: 700,
  },
  option: {
    background: '#12122a',
    border: '1px solid #334',
    borderLeft: '4px solid #888',
    borderRadius: 4,
    padding: '8px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    transition: 'background 0.15s',
  },
  optionDetails: {
    display: 'flex',
    gap: 12,
    fontSize: 11,
    color: '#aaa',
  },
  cancelBtn: {
    marginTop: 4,
    padding: '6px 12px',
    background: '#2a1a1a',
    color: '#e8a0a0',
    border: '1px solid #554',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    alignSelf: 'flex-end',
  },
};
