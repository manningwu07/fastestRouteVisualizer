import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';
import { ColorPicker } from './ColorPicker.js';
import type { LineSchedule } from '../engine/types.js';

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

  const [color, setColor] = useState('#e74c3c');
  const [agency, setAgency] = useState('');
  const [travelTimes, setTravelTimes] = useState<number[]>([]);

  // Forward schedule
  const [fwdFirst, setFwdFirst] = useState(360);
  const [fwdLast, setFwdLast] = useState(1380);
  const [fwdHeadway, setFwdHeadway] = useState(10);

  // Reverse schedule
  const [revFirst, setRevFirst] = useState(360);
  const [revLast, setRevLast] = useState(1380);
  const [revHeadway, setRevHeadway] = useState(10);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveStop, setConfirmRemoveStop] = useState<string | null>(null);

  // Sync local state when selected line changes
  useEffect(() => {
    if (line) {
      setColor(line.color);
      setAgency(line.agency);
      setTravelTimes([...line.travelTimes]);
      setFwdFirst(line.forwardSchedule.firstDeparture);
      setFwdLast(line.forwardSchedule.lastDeparture);
      setFwdHeadway(line.forwardSchedule.headwayMin);
      if (line.reverseSchedule) {
        setRevFirst(line.reverseSchedule.firstDeparture);
        setRevLast(line.reverseSchedule.lastDeparture);
        setRevHeadway(line.reverseSchedule.headwayMin);
      } else {
        // Default reverse to same as forward when no reverseSchedule
        setRevFirst(line.forwardSchedule.firstDeparture);
        setRevLast(line.forwardSchedule.lastDeparture);
        setRevHeadway(line.forwardSchedule.headwayMin);
      }
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

  function saveAll(overrides?: { color?: string }) {
    if (!selectedLineId) return;
    const forwardSchedule: LineSchedule = {
      firstDeparture: fwdFirst,
      lastDeparture: fwdLast,
      headwayMin: fwdHeadway,
    };
    const reverseSchedule: LineSchedule | undefined = line.bidirectional
      ? { firstDeparture: revFirst, lastDeparture: revLast, headwayMin: revHeadway }
      : undefined;

    updateLine(selectedLineId, {
      color: overrides?.color ?? color,
      agency: agency.trim() || 'Default',
      travelTimes: travelTimes.map(t => Math.max(1, t)),
      forwardSchedule,
      reverseSchedule,
    });
  }

  function handleRemoveStop(stopId: string) {
    if (!selectedLineId) return;
    const newStops = line.stops.filter(s => s !== stopId);
    if (newStops.length < 2) {
      setConfirmRemoveStop(stopId);
      return;
    }
    const idx = line.stops.indexOf(stopId);
    const newTimes = [...line.travelTimes];
    if (idx === 0) {
      newTimes.splice(0, 1);
    } else if (idx === line.stops.length - 1) {
      newTimes.splice(newTimes.length - 1, 1);
    } else {
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

  // Compute absolute departure time at stop index for display
  function depTimeAtStop(idx: number): string {
    let t = fwdFirst;
    for (let i = 0; i < idx; i++) {
      t += travelTimes[i] ?? 0;
    }
    return formatTime(t);
  }

  function revDepTimeAtStop(reverseIdx: number): string {
    let t = revFirst;
    for (let i = 0; i < reverseIdx; i++) {
      t += travelTimes[travelTimes.length - 1 - i] ?? 0;
    }
    return formatTime(t);
  }

  const reversedStops = [...line.stops].reverse();

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={{ ...styles.header, color: line.color }}>Edit Line</div>
        <button style={styles.closeBtn} onClick={() => setSelectedLineId(null)} title="Close (Esc)">
          ✕
        </button>
      </div>

      <label style={styles.label}>Color</label>
      <ColorPicker value={color} onChange={(c) => { setColor(c); saveAll({ color: c }); }} />

      <label style={styles.label}>Agency</label>
      <input
        style={styles.input}
        value={agency}
        onChange={e => setAgency(e.target.value)}
        onBlur={saveAll}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="Metro, Bus Co…"
      />

      {/* Forward stops & travel times */}
      <div style={styles.schedSection}>
        <div style={styles.schedSectionHeader}>
          <span style={{ color: line.color }}>▶</span> Forward — Stops & Travel Times
        </div>
        <div style={styles.stopList}>
          {line.stops.map((stopId, i) => {
            const st = stations[stopId];
            const nextSt = i < line.stops.length - 1 ? stations[line.stops[i + 1]] : null;
            return (
              <React.Fragment key={stopId}>
                <div style={styles.stopRow}>
                  <span style={{ ...styles.stopDot, background: line.color }} />
                  <span style={styles.stopName}>{st?.name ?? stopId}</span>
                  <span style={styles.stopTime}>{depTimeAtStop(i)}</span>
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
                      type="text"
                      inputMode="numeric"
                      style={styles.smallInput}
                      value={travelTimes[i] ?? 5}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const v = parseInt(raw) || 1;
                        setTravelTimes(prev => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        });
                      }}
                      onBlur={saveAll}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                    <span style={styles.unit}>min</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={styles.schedGrid}>
          <span style={styles.schedLabel}>First dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(fwdFirst)}
            onChange={e => setFwdFirst(parseTime(e.target.value))}
            onBlur={saveAll}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Last dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(fwdLast)}
            onChange={e => setFwdLast(parseTime(e.target.value))}
            onBlur={saveAll}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Headway</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              inputMode="numeric"
              style={styles.smallInput}
              value={fwdHeadway}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setFwdHeadway(parseInt(raw) || 1);
              }}
              onBlur={saveAll}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.unit}>min</span>
          </div>
        </div>
      </div>

      {/* Reverse schedule (only when bidirectional) */}
      {line.bidirectional && (
        <div style={styles.schedSection}>
          <div style={styles.schedSectionHeader}>
            <span style={{ color: line.color }}>◀</span> Reverse Schedule
          </div>
          <div style={styles.stopList}>
            {reversedStops.map((stopId, i) => {
              const st = stations[stopId];
              return (
                <div key={stopId} style={styles.stopRow}>
                  <span style={{ ...styles.stopDot, background: line.color }} />
                  <span style={styles.stopName}>{st?.name ?? stopId}</span>
                  <span style={styles.stopTime}>{revDepTimeAtStop(i)}</span>
                  {i < reversedStops.length - 1 && (
                    <div style={styles.travelSegment}>
                      <span style={styles.readonlyTime}>
                        {travelTimes[travelTimes.length - 1 - i] ?? 5}
                      </span>
                      <span style={styles.unit}>min</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={styles.schedGrid}>
            <span style={styles.schedLabel}>First dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(revFirst)}
              onChange={e => setRevFirst(parseTime(e.target.value))}
              onBlur={saveAll}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Last dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(revLast)}
              onChange={e => setRevLast(parseTime(e.target.value))}
              onBlur={saveAll}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Headway</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                style={styles.smallInput}
                value={revHeadway}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setRevHeadway(parseInt(raw) || 1);
                }}
                onBlur={saveAll}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span style={styles.unit}>min</span>
            </div>
          </div>
        </div>
      )}

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
  readonlyTime: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '2px 6px',
    minWidth: 28,
    textAlign: 'right' as const,
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
  schedSection: {
    background: '#111124',
    borderRadius: 4,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
  },
  schedSectionHeader: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#aaa',
    fontWeight: 700,
    marginBottom: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  stopList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 6,
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
  stopTime: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#7ec8e3',
    minWidth: 44,
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
  schedGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '4px 8px',
    alignItems: 'center',
  },
  schedLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#777',
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
