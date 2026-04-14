import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';

export function LineEditor() {
  const {
    stations,
    lines,
    selectedLineId,
    setSelectedLineId,
    updateLine,
    removeLine,
  } = useStore();

  const line = selectedLineId ? lines[selectedLineId] : null;

  const [lineName, setLineName] = useState('');
  const [color, setColor] = useState('#e74c3c');
  const [agency, setAgency] = useState('');
  const [travelTimes, setTravelTimes] = useState<number[]>([]);
  const [firstDep, setFirstDep] = useState(360);
  const [lastDep, setLastDep] = useState(1380);
  const [headway, setHeadway] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveStop, setConfirmRemoveStop] = useState<string | null>(null);

  // Sync local state when selected line changes
  useEffect(() => {
    if (line) {
      setLineName(line.agency && line.color ? (line as any).name ?? '' : '');
      setColor(line.color);
      setAgency(line.agency);
      setTravelTimes([...line.travelTimes]);
      setFirstDep(line.firstDeparture);
      setLastDep(line.lastDeparture);
      setHeadway(line.headwayMin);
      setConfirmDelete(false);
      setConfirmRemoveStop(null);
    }
  }, [selectedLineId]);

  // Keyboard: Escape closes editor
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedLineId(null);
  }, [setSelectedLineId]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!line) return null;

  function formatTime(mins: number) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function parseTime(val: string): number {
    const [h, m] = val.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function saveAll() {
    if (!selectedLineId) return;
    updateLine(selectedLineId, {
      color,
      agency: agency.trim() || 'Default',
      travelTimes: travelTimes.map(t => Math.max(1, t)),
      firstDeparture: firstDep,
      lastDeparture: lastDep,
      headwayMin: headway,
    });
  }

  function handleRemoveStop(stopId: string) {
    if (!selectedLineId) return;
    const newStops = line.stops.filter(s => s !== stopId);
    if (newStops.length < 2) {
      // removing this stop would make the line invalid — ask confirmation
      setConfirmRemoveStop(stopId);
      return;
    }
    // Rebuild travel times
    const idx = line.stops.indexOf(stopId);
    const newTimes = [...line.travelTimes];
    if (idx === 0) {
      newTimes.splice(0, 1);
    } else if (idx === line.stops.length - 1) {
      newTimes.splice(newTimes.length - 1, 1);
    } else {
      // merge the two segments: keep the first one, remove the second
      newTimes.splice(idx, 1);
    }
    updateLine(selectedLineId, { stops: newStops, travelTimes: newTimes });
    setTravelTimes(newTimes);
    setConfirmRemoveStop(null);
  }

  function handleDeleteLine() {
    if (!selectedLineId) return;
    removeLine(selectedLineId);
    setSelectedLineId(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={{ ...styles.header, color: line.color }}>Edit Line</div>
        <button style={styles.closeBtn} onClick={() => setSelectedLineId(null)} title="Close (Esc)">
          ✕
        </button>
      </div>

      <label style={styles.label}>Color</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={saveAll}
          style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>{color}</span>
      </div>

      <label style={styles.label}>Agency</label>
      <input
        style={styles.input}
        value={agency}
        onChange={e => setAgency(e.target.value)}
        onBlur={saveAll}
        placeholder="Metro, Bus Co…"
      />

      <label style={styles.label}>Stops & Travel Times</label>
      <div style={styles.stopList}>
        {line.stops.map((stopId, i) => {
          const st = stations[stopId];
          const nextSt = i < line.stops.length - 1 ? stations[line.stops[i + 1]] : null;
          return (
            <React.Fragment key={stopId}>
              <div style={styles.stopRow}>
                <span style={{ ...styles.stopDot, background: line.color }} />
                <span style={styles.stopName}>{st?.name ?? stopId}</span>
                <button
                  style={styles.removeStopBtn}
                  onClick={() => handleRemoveStop(stopId)}
                  title="Remove stop"
                >
                  ×
                </button>
              </div>
              {confirmRemoveStop === stopId && (
                <div style={styles.confirmBox}>
                  <span style={{ color: '#e8a0a0', fontSize: 11, fontFamily: 'monospace' }}>
                    Removing this stop will delete the line (only 1 stop left). Delete line?
                  </span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button style={styles.confirmDeleteBtn} onClick={handleDeleteLine}>Delete Line</button>
                    <button style={styles.cancelBtn} onClick={() => setConfirmRemoveStop(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {nextSt && (
                <div style={styles.travelSegment}>
                  <span style={styles.travelLabel}>{st?.name ?? stopId} → {nextSt.name}:</span>
                  <input
                    type="number"
                    min={1}
                    style={styles.smallInput}
                    value={travelTimes[i] ?? 5}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 1;
                      setTravelTimes(prev => {
                        const next = [...prev];
                        next[i] = v;
                        return next;
                      });
                    }}
                    onBlur={saveAll}
                  />
                  <span style={styles.unit}>min</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <label style={styles.label}>Schedule</label>
      <div style={styles.schedRow}>
        <span style={styles.schedLabel}>First dep</span>
        <input
          type="time"
          style={styles.timeInput}
          value={formatTime(firstDep)}
          onChange={e => setFirstDep(parseTime(e.target.value))}
          onBlur={saveAll}
        />
      </div>
      <div style={styles.schedRow}>
        <span style={styles.schedLabel}>Last dep</span>
        <input
          type="time"
          style={styles.timeInput}
          value={formatTime(lastDep)}
          onChange={e => setLastDep(parseTime(e.target.value))}
          onBlur={saveAll}
        />
      </div>
      <div style={styles.schedRow}>
        <span style={styles.schedLabel}>Headway</span>
        <input
          type="number"
          min={1}
          style={styles.smallInput}
          value={headway}
          onChange={e => setHeadway(parseInt(e.target.value) || 1)}
          onBlur={saveAll}
        />
        <span style={styles.unit}>min</span>
      </div>

      <div style={styles.buttonRow}>
        <button style={styles.doneBtn} onClick={() => setSelectedLineId(null)}>
          Done
        </button>
        {!confirmDelete ? (
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            Delete Line
          </button>
        ) : (
          <div style={styles.confirmBox}>
            <span style={{ color: '#e8a0a0', fontSize: 11, fontFamily: 'monospace' }}>
              Delete this line?
            </span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button style={styles.confirmDeleteBtn} onClick={handleDeleteLine}>Yes, Delete</button>
              <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    flex: 1,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: 14,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 14,
    padding: '0 4px',
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
  },
  smallInput: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '2px 6px',
    width: 52,
    outline: 'none',
  },
  timeInput: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '2px 6px',
    outline: 'none',
  },
  unit: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
  stopList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: '#111124',
    borderRadius: 4,
    padding: '6px',
  },
  stopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  stopName: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8c8e0',
    flex: 1,
  },
  removeStopBtn: {
    background: 'none',
    border: 'none',
    color: '#a04040',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 14,
    padding: '0 2px',
    lineHeight: 1,
  },
  travelSegment: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 14,
    marginBottom: 4,
  },
  travelLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#666',
    flex: 1,
  },
  schedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  schedLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#777',
    width: 64,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  doneBtn: {
    padding: '6px 16px',
    background: '#1a3a2a',
    color: '#7ec8a8',
    border: '1px solid #3a6a4a',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  deleteBtn: {
    padding: '6px 16px',
    background: '#3a1a1a',
    color: '#e8a0a0',
    border: '1px solid #6a3030',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  confirmBox: {
    background: '#1a1a2e',
    border: '1px solid #6a3030',
    borderRadius: 4,
    padding: '6px 8px',
  },
  confirmDeleteBtn: {
    padding: '4px 10px',
    background: '#5a1a1a',
    color: '#e8a0a0',
    border: '1px solid #8a3030',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  cancelBtn: {
    padding: '4px 10px',
    background: '#2a2a3a',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  },
};
