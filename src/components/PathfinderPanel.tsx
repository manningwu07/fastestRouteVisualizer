import React, { useState } from 'react';
import { useStore } from '../state/store.js';

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function PathfinderPanel() {
  const {
    stations,
    lines,
    currentRoute,
    routeStartTime,
    pathfinderSelectedStation,
    setRouteStartTime,
    undoLastStep,
    clearRoute,
    saveCurrentRoute,
    addRouteStep,
  } = useStore();

  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const startHours = Math.floor(routeStartTime / 60);
  const startMinutes = routeStartTime % 60;

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // "HH:MM"
    const [h, m] = val.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      setRouteStartTime(h * 60 + m);
    }
  }

  function handleStartAtStation(stationId: string) {
    // Setting start: add first "zero step" at this station
    addRouteStep(stationId, { type: 'run', edge: { id: '', from: stationId, to: stationId, timeMin: 0, bidirectional: false } });
  }

  function handleSave() {
    if (!saveNameInput.trim()) return;
    saveCurrentRoute(saveNameInput.trim());
    setSaveNameInput('');
    setShowSaveInput(false);
  }

  const hasRoute = currentRoute.length > 0;
  const lastStep = hasRoute ? currentRoute[currentRoute.length - 1] : null;
  const totalMin = hasRoute && lastStep ? lastStep.cumulativeMin - routeStartTime : 0;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Pathfinder</div>

      {/* Start time */}
      <div style={styles.section}>
        <div style={styles.label}>Start Time</div>
        <input
          type="time"
          value={`${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`}
          onChange={handleTimeChange}
          style={styles.timeInput}
        />
      </div>

      {/* Start station selector */}
      {!hasRoute && (
        <div style={styles.section}>
          <div style={styles.label}>Start Station</div>
          <div style={styles.hint}>Click a station on the canvas to start, or pick below:</div>
          <div style={styles.stationList}>
            {Object.values(stations).map(st => (
              <button
                key={st.id}
                style={styles.stationBtn}
                onClick={() => handleStartAtStation(st.id)}
              >
                {st.name}
              </button>
            ))}
          </div>
          {Object.keys(stations).length === 0 && (
            <div style={styles.empty}>No stations yet. Build your graph first.</div>
          )}
        </div>
      )}

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
          <button style={styles.btnSecondary} onClick={undoLastStep}>
            Undo Step
          </button>
          <button style={styles.btnDanger} onClick={clearRoute}>
            Clear
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
      {hasRoute && (
        <div style={styles.hint}>
          Click a reachable station on the canvas to add a step.
          {pathfinderSelectedStation && (
            <span> Current: <span style={{ color: '#7ec8e3' }}>{stations[pathfinderSelectedStation]?.name}</span></span>
          )}
        </div>
      )}
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
  timeInput: {
    background: '#1e1e38',
    border: '1px solid #445',
    color: '#e8e8f0',
    borderRadius: 4,
    padding: '4px 8px',
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
};
