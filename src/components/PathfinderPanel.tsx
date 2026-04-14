import React, { useState } from 'react';
import { useStore } from '../state/store.js';

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toAMPM(minutes: number): string {
  const totalMins = Math.floor(minutes);
  const h24 = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(24 * 60 - 1, h * 60 + m));
}

export function PathfinderPanel() {
  const {
    stations,
    lines,
    currentRoute,
    pathfinderWaypoints,
    pathfinderSearchStartMin,
    pathfinderSearchEndMin,
    routeStartTime,
    pathfinderSelectedStation,
    clearRoute,
    saveCurrentRoute,
    setPathfinderSearchWindow,
    addPathfinderWaypoint,
    removePathfinderWaypoint,
    clearPathfinderWaypoints,
    solvePathfinderWaypoints,
    showToast,
  } = useStore();

  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  function handleSave() {
    if (!saveNameInput.trim()) return;
    saveCurrentRoute(saveNameInput.trim());
    setSaveNameInput('');
    setShowSaveInput(false);
  }

  async function handleCopySheets() {
    if (currentRoute.length === 0) {
      showToast('No solved route to copy');
      return;
    }
    const names = currentRoute.map(step => stations[step.stationId]?.name ?? step.stationId);
    const times = currentRoute.map((step, i) => toAMPM(i === 0 ? routeStartTime : step.arriveAt));
    const tsv = `${names.join('\t')}\n${times.join('\t')}`;

    try {
      await navigator.clipboard.writeText(tsv);
      showToast('Copied!');
    } catch {
      showToast('Copy failed');
    }
  }

  const hasRoute = currentRoute.length > 0;
  const lastStep = hasRoute ? currentRoute[currentRoute.length - 1] : null;
  const totalMin = hasRoute && lastStep ? lastStep.cumulativeMin - routeStartTime : 0;

  function handleSearchStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPathfinderSearchWindow(parseHHMM(e.target.value), pathfinderSearchEndMin);
  }

  function handleSearchEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPathfinderSearchWindow(pathfinderSearchStartMin, parseHHMM(e.target.value));
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Pathfinder</div>

      {/* Calculated start time */}
      {hasRoute && (
        <div style={styles.section}>
          <div style={styles.label}>Start Time (Calculated)</div>
          <div style={styles.readOnlyValue}>{toHHMM(routeStartTime)}</div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.label}>Waypoint Order</div>
        <div style={styles.hint}>Click stations on the canvas, or add from the list below, in the exact order you want to visit them.</div>
        <div style={styles.waypointList}>
          {pathfinderWaypoints.length === 0 && <div style={styles.empty}>No waypoints yet.</div>}
          {pathfinderWaypoints.map((stationId, i) => (
            <div key={`${stationId}-${i}`} style={styles.waypointRow}>
              <span style={styles.stepNum}>{i + 1}</span>
              <span style={styles.stepStation}>{stations[stationId]?.name ?? stationId}</span>
              <button style={styles.removeBtn} onClick={() => removePathfinderWaypoint(i)}>x</button>
            </div>
          ))}
        </div>
        <div style={styles.stationList}>
          {Object.values(stations).map(st => (
            <button
              key={st.id}
              style={styles.stationBtn}
              onClick={() => addPathfinderWaypoint(st.id)}
            >
              {st.name}
            </button>
          ))}
        </div>
        {Object.keys(stations).length === 0 && (
          <div style={styles.empty}>No stations yet. Build your graph first.</div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Start Time Search Window</div>
        <div style={styles.timeRangeRow}>
          <input
            type="time"
            value={toHHMM(pathfinderSearchStartMin)}
            onChange={handleSearchStartChange}
            style={styles.timeInput}
          />
          <span style={styles.timeRangeDash}>to</span>
          <input
            type="time"
            value={toHHMM(pathfinderSearchEndMin)}
            onChange={handleSearchEndChange}
            style={styles.timeInput}
          />
        </div>
        <div style={styles.hint}>Solver only brute-forces start times inside this window.</div>
      </div>

      <div style={styles.controls}>
        <button style={styles.btnPrimary} onClick={solvePathfinderWaypoints}>
          Solve Fastest Route
        </button>
        <button style={styles.btnDanger} onClick={clearPathfinderWaypoints}>
          Clear Waypoints
        </button>
      </div>

      {/* Current route */}
      {hasRoute && (
        <div style={styles.section}>
          <div style={styles.label}>Current Route</div>
          <div style={styles.routeList}>
            {currentRoute.map((step, i) => {
              const st = stations[step.stationId];
              const line = step.lineId ? lines[step.lineId] : null;
              const isLast = i === currentRoute.length - 1;
              return (
                <div key={i} style={{ ...styles.routeStep, ...(isLast ? styles.routeStepLast : {}) }}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <span style={styles.stepStation}>{st?.name ?? step.stationId}</span>
                  {line && (
                    <span style={{ ...styles.stepLine, color: line.color }}>
                      {line.id.slice(0, 6)}
                    </span>
                  )}
                  <span style={styles.stepTime}>{toHHMM(step.arriveAt)}</span>
                </div>
              );
            })}
          </div>
          {totalMin > 0 && (
            <div style={styles.totalTime}>
              Total: <span style={{ color: '#7ec8e3' }}>{totalMin}m</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {hasRoute && (
        <div style={styles.controls}>
          <button style={styles.btnDanger} onClick={clearRoute}>
            Clear Route
          </button>
          <button style={styles.btnSecondary} onClick={handleCopySheets}>
            Copy Sheets Rows
          </button>
        </div>
      )}

      {/* Save route */}
      {hasRoute && currentRoute.length >= 2 && (
        <div style={styles.section}>
          {!showSaveInput ? (
            <button style={styles.btnPrimary} onClick={() => setShowSaveInput(true)}>
              Save Route
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
              <input
                type="text"
                placeholder="Route name..."
                value={saveNameInput}
                onChange={e => setSaveNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                style={styles.textInput}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={styles.btnPrimary} onClick={handleSave}>Save</button>
                <button style={styles.btnSecondary} onClick={() => setShowSaveInput(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pathfinder hint */}
      <div style={styles.hint}>
        Solver brute-forces start times across the day and picks the minimum total travel time for your waypoint order.
        {pathfinderSelectedStation && (
          <span> Current: <span style={{ color: '#7ec8e3' }}>{stations[pathfinderSelectedStation]?.name}</span></span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontFamily: 'monospace',
  },
  header: {
    fontWeight: 700,
    color: '#7ec8e3',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 6,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hint: {
    fontSize: 10,
    color: '#556',
    lineHeight: 1.5,
  },
  readOnlyValue: {
    background: '#1e1e38',
    border: '1px solid #445',
    color: '#7ec8e3',
    borderRadius: 4,
    padding: '6px 8px',
    fontFamily: 'monospace',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  textInput: {
    background: '#1e1e38',
    border: '1px solid #445',
    color: '#e8e8f0',
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: 'monospace',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  timeRangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  timeRangeDash: {
    color: '#667',
    fontSize: 11,
    width: 18,
    textAlign: 'center' as const,
  },
  timeInput: {
    background: '#1e1e38',
    border: '1px solid #445',
    color: '#e8e8f0',
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
    boxSizing: 'border-box' as const,
  },
  stationList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
  },
  stationBtn: {
    padding: '3px 8px',
    background: '#2a2a4a',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  empty: {
    color: '#445',
    fontSize: 11,
    fontStyle: 'italic',
  },
  routeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  waypointList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 140,
    overflowY: 'auto' as const,
    marginTop: 2,
  },
  waypointRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 6px',
    background: '#1a1a30',
    borderRadius: 3,
    fontSize: 11,
  },
  routeStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 6px',
    background: '#1a1a30',
    borderRadius: 3,
    fontSize: 11,
  },
  routeStepLast: {
    background: '#1e2a3a',
    border: '1px solid #3a5f7a',
  },
  stepNum: {
    color: '#556',
    minWidth: 16,
    textAlign: 'right' as const,
  },
  stepStation: {
    color: '#e8e8f0',
    flex: 1,
  },
  stepLine: {
    fontSize: 10,
    padding: '1px 4px',
    background: '#0d0d1a',
    borderRadius: 2,
  },
  stepTime: {
    color: '#7ec8e3',
    fontSize: 10,
  },
  totalTime: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
    textAlign: 'right' as const,
  },
  controls: {
    display: 'flex',
    gap: 6,
  },
  btnPrimary: {
    padding: '5px 10px',
    background: '#2a4a6a',
    color: '#7ec8e3',
    border: '1px solid #3a7a9a',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  btnSecondary: {
    padding: '5px 10px',
    background: '#2a2a3a',
    color: '#aaa',
    border: '1px solid #445',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  btnDanger: {
    padding: '5px 10px',
    background: '#3a1a1a',
    color: '#e86060',
    border: '1px solid #553',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  removeBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    border: '1px solid #553',
    background: '#3a1a1a',
    color: '#e86060',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 1,
    padding: 0,
  },
};
