import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';
import { ColorPicker } from './ColorPicker.js';
import { NumericInput } from './NumericInput.js';
import type { LineSchedule, ScheduleWindow } from '../engine/types.js';

const DEFAULT_WINDOW: ScheduleWindow = {
  firstDeparture: 360,
  lastDeparture: 1380,
  headwayMin: 10,
};
const MAX_WINDOWS = 8;
const INSERT_AT_START = '__insert_start__';
const INSERT_AT_END = '__insert_end__';

function sanitizeWindows(windows: ScheduleWindow[] | undefined): ScheduleWindow[] {
  if (!windows || windows.length === 0) return [{ ...DEFAULT_WINDOW }];
  return windows.map(w => ({
    firstDeparture: w.firstDeparture,
    lastDeparture: w.lastDeparture,
    headwayMin: Math.max(1, w.headwayMin),
  }));
}

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

  const [fwdWindows, setFwdWindows] = useState<ScheduleWindow[]>([{ ...DEFAULT_WINDOW }]);
  const [revWindows, setRevWindows] = useState<ScheduleWindow[]>([{ ...DEFAULT_WINDOW }]);
  const [fwdWindowIdx, setFwdWindowIdx] = useState(0);
  const [revWindowIdx, setRevWindowIdx] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveStop, setConfirmRemoveStop] = useState<string | null>(null);
  const [newStopId, setNewStopId] = useState('');
  const [insertAfterStopId, setInsertAfterStopId] = useState(INSERT_AT_END);

  const activeFwdWindow = fwdWindows[fwdWindowIdx] ?? fwdWindows[0] ?? DEFAULT_WINDOW;
  const activeRevWindow = revWindows[revWindowIdx] ?? revWindows[0] ?? DEFAULT_WINDOW;

  // Sync local state when selected line changes
  useEffect(() => {
    if (line) {
      setColor(line.color);
      setAgency(line.agency);
      setTravelTimes([...line.travelTimes]);
      setFwdWindows(sanitizeWindows(line.forwardSchedule.windows));
      setRevWindows(sanitizeWindows((line.reverseSchedule ?? line.forwardSchedule).windows));
      setFwdWindowIdx(0);
      setRevWindowIdx(0);
      setConfirmDelete(false);
      setConfirmRemoveStop(null);
      setNewStopId('');
      setInsertAfterStopId(INSERT_AT_END);
    }
  }, [selectedLineId, line]);

  useEffect(() => {
    if (fwdWindowIdx >= fwdWindows.length) setFwdWindowIdx(Math.max(0, fwdWindows.length - 1));
  }, [fwdWindowIdx, fwdWindows.length]);

  useEffect(() => {
    if (revWindowIdx >= revWindows.length) setRevWindowIdx(Math.max(0, revWindows.length - 1));
  }, [revWindowIdx, revWindows.length]);

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

  function updateFwdWindow(updates: Partial<ScheduleWindow>) {
    setFwdWindows(prev => prev.map((w, i) => (i === fwdWindowIdx ? { ...w, ...updates } : w)));
  }

  function updateRevWindow(updates: Partial<ScheduleWindow>) {
    setRevWindows(prev => prev.map((w, i) => (i === revWindowIdx ? { ...w, ...updates } : w)));
  }

  function addFwdWindow() {
    setFwdWindows(prev => {
      if (prev.length >= MAX_WINDOWS) return prev;
      const base = prev[fwdWindowIdx] ?? DEFAULT_WINDOW;
      return [...prev, { ...base }];
    });
    setFwdWindowIdx(fwdWindows.length);
  }

  function removeFwdWindow(idx: number) {
    setFwdWindows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
    setFwdWindowIdx(prev => (idx < prev ? prev - 1 : prev));
  }

  function addRevWindow() {
    setRevWindows(prev => {
      if (prev.length >= MAX_WINDOWS) return prev;
      const base = prev[revWindowIdx] ?? DEFAULT_WINDOW;
      return [...prev, { ...base }];
    });
    setRevWindowIdx(revWindows.length);
  }

  function removeRevWindow(idx: number) {
    setRevWindows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
    setRevWindowIdx(prev => (idx < prev ? prev - 1 : prev));
  }

  function saveAll(overrides?: { color?: string }) {
    if (!selectedLineId) return;
    const forwardSchedule: LineSchedule = {
      windows: fwdWindows.map(w => ({
        firstDeparture: w.firstDeparture,
        lastDeparture: w.lastDeparture,
        headwayMin: Math.max(1, w.headwayMin),
      })),
    };
    const reverseSchedule: LineSchedule | undefined = line.bidirectional
      ? {
          windows: revWindows.map((w, idx) => ({
            firstDeparture: w.firstDeparture,
            lastDeparture: w.lastDeparture,
            headwayMin: Math.max(1, w.headwayMin || fwdWindows[idx]?.headwayMin || 10),
          })),
        }
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

  function handleForwardStopTimeChange(idx: number, timeValue: string) {
    const nextTime = parseTime(timeValue);

    if (idx === 0) {
      updateFwdWindow({ firstDeparture: nextTime });
      return;
    }

    const prevTime = parseTime(depTimeAtStop(idx - 1));
    const segmentMin = Math.max(1, nextTime - prevTime);
    setTravelTimes(prev => {
      const next = [...prev];
      next[idx - 1] = segmentMin;
      return next;
    });
  }

  function handleReverseStopTimeChange(reverseIdx: number, timeValue: string) {
    const nextTime = parseTime(timeValue);

    if (reverseIdx === 0) {
      updateRevWindow({ firstDeparture: nextTime });
      return;
    }

    const prevTime = parseTime(revDepTimeAtStop(reverseIdx - 1));
    const segmentMin = Math.max(1, nextTime - prevTime);
    const forwardSegmentIdx = travelTimes.length - reverseIdx;

    setTravelTimes(prev => {
      const next = [...prev];
      next[forwardSegmentIdx] = segmentMin;
      return next;
    });
  }

  function handleAddStop() {
    if (!selectedLineId || !newStopId) return;
    if (line.stops.includes(newStopId)) return;

    const nextStops = [...line.stops];
    const nextTimes = [...line.travelTimes];

    if (insertAfterStopId === INSERT_AT_START) {
      nextStops.unshift(newStopId);
      nextTimes.unshift(5);
    } else if (insertAfterStopId === INSERT_AT_END) {
      nextStops.push(newStopId);
      nextTimes.push(5);
    } else {
      const anchorIdx = line.stops.indexOf(insertAfterStopId);
      if (anchorIdx < 0 || anchorIdx >= line.stops.length - 1) {
        nextStops.push(newStopId);
        nextTimes.push(5);
      } else {
        nextStops.splice(anchorIdx + 1, 0, newStopId);
        const existingSegment = Math.max(1, nextTimes[anchorIdx] ?? 5);
        const firstLeg = Math.max(1, Math.floor(existingSegment / 2));
        const secondLeg = Math.max(1, existingSegment - firstLeg);
        nextTimes.splice(anchorIdx, 1, firstLeg, secondLeg);
      }
    }

    updateLine(selectedLineId, { stops: nextStops, travelTimes: nextTimes });
    setTravelTimes(nextTimes);
    setNewStopId('');
    setInsertAfterStopId(INSERT_AT_END);
  }

  // Compute absolute departure time at stop index for display
  function depTimeAtStop(idx: number): string {
    let t = activeFwdWindow.firstDeparture;
    for (let i = 0; i < idx; i++) {
      t += travelTimes[i] ?? 0;
    }
    return formatTime(t);
  }

  function revDepTimeAtStop(reverseIdx: number): string {
    let t = activeRevWindow.firstDeparture;
    for (let i = 0; i < reverseIdx; i++) {
      t += travelTimes[travelTimes.length - 1 - i] ?? 0;
    }
    return formatTime(t);
  }

  const reversedStops = [...line.stops].reverse();
  const candidateStations = Object.values(stations)
    .filter(st => !line.stops.includes(st.id))
    .sort((a, b) => a.name.localeCompare(b.name));

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

      <div style={styles.addNodeBox}>
        <div style={styles.addNodeTitle}>Add Node</div>
        <div style={styles.addNodeRow}>
          <select
            style={styles.selectInput}
            value={newStopId}
            onChange={e => setNewStopId(e.target.value)}
          >
            <option value="">Select station…</option>
            {candidateStations.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          <select
            style={styles.selectInput}
            value={insertAfterStopId}
            onChange={e => setInsertAfterStopId(e.target.value)}
          >
            <option value={INSERT_AT_START}>At start</option>
            {line.stops.map(stopId => (
              <option key={stopId} value={stopId}>
                After {stations[stopId]?.name ?? stopId}
              </option>
            ))}
            <option value={INSERT_AT_END}>At end</option>
          </select>
          <button
            style={styles.addNodeBtn}
            onClick={handleAddStop}
            disabled={!newStopId}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Forward stops & travel times */}
      <div style={styles.schedSection}>
        <div style={styles.schedSectionHeader}>
          <span style={{ color: line.color }}>▶</span> Forward - Stops & Travel Times
        </div>
        <div style={styles.windowTabsRow}>
          {fwdWindows.map((_, i) => (
            <button
              key={`fwd-window-${i}`}
              style={{ ...styles.windowTabBtn, ...(i === fwdWindowIdx ? styles.windowTabBtnActive : {}) }}
              onClick={() => setFwdWindowIdx(i)}
            >
              W{i + 1}
            </button>
          ))}
          <button style={styles.smallActionBtn} onClick={addFwdWindow} disabled={fwdWindows.length >= MAX_WINDOWS}>+ Window</button>
          <button style={styles.smallDangerBtn} onClick={() => removeFwdWindow(fwdWindowIdx)} disabled={fwdWindows.length <= 1}>- Window</button>
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
                  <input
                    type="time"
                    style={{ ...styles.timeInput, ...styles.stopTimeInput }}
                    value={depTimeAtStop(i)}
                    onChange={e => handleForwardStopTimeChange(i, e.target.value)}
                    onBlur={saveAll}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
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
                    <NumericInput
                      value={travelTimes[i] ?? 5}
                      onChange={v => {
                        setTravelTimes(prev => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        });
                      }}
                      onSubmit={saveAll}
                      onBlur={saveAll}
                      min={1}
                      style={styles.smallInput}
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
            value={formatTime(activeFwdWindow.firstDeparture)}
            onChange={e => updateFwdWindow({ firstDeparture: parseTime(e.target.value) })}
            onBlur={saveAll}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Last dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(activeFwdWindow.lastDeparture)}
            onChange={e => updateFwdWindow({ lastDeparture: parseTime(e.target.value) })}
            onBlur={saveAll}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Headway</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              inputMode="numeric"
              style={styles.smallInput}
              value={activeFwdWindow.headwayMin}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                updateFwdWindow({ headwayMin: parseInt(raw) || 1 });
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
          <div style={styles.windowTabsRow}>
            {revWindows.map((_, i) => (
              <button
                key={`rev-window-${i}`}
                style={{ ...styles.windowTabBtn, ...(i === revWindowIdx ? styles.windowTabBtnActive : {}) }}
                onClick={() => setRevWindowIdx(i)}
              >
                W{i + 1}
              </button>
            ))}
            <button style={styles.smallActionBtn} onClick={addRevWindow} disabled={revWindows.length >= MAX_WINDOWS}>+ Window</button>
            <button style={styles.smallDangerBtn} onClick={() => removeRevWindow(revWindowIdx)} disabled={revWindows.length <= 1}>- Window</button>
          </div>
          <div style={styles.stopList}>
            {reversedStops.map((stopId, i) => {
              const st = stations[stopId];
              return (
                <div key={stopId} style={styles.stopRow}>
                  <span style={{ ...styles.stopDot, background: line.color }} />
                  <span style={styles.stopName}>{st?.name ?? stopId}</span>
                  <input
                    type="time"
                    style={{ ...styles.timeInput, ...styles.stopTimeInput }}
                    value={revDepTimeAtStop(i)}
                    onChange={e => handleReverseStopTimeChange(i, e.target.value)}
                    onBlur={saveAll}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
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
              value={formatTime(activeRevWindow.firstDeparture)}
              onChange={e => updateRevWindow({ firstDeparture: parseTime(e.target.value) })}
              onBlur={saveAll}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Last dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(activeRevWindow.lastDeparture)}
              onChange={e => updateRevWindow({ lastDeparture: parseTime(e.target.value) })}
              onBlur={saveAll}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Headway</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                style={styles.smallInput}
                value={activeRevWindow.headwayMin}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  updateRevWindow({ headwayMin: parseInt(raw) || 1 });
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
  selectInput: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
    minWidth: 0,
    flex: 1,
  },
  addNodeBox: {
    marginTop: 6,
    background: '#101022',
    border: '1px solid #262648',
    borderRadius: 4,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  addNodeTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#8e8eb8',
    fontWeight: 700,
  },
  addNodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  addNodeBtn: {
    border: '1px solid #3a5f7a',
    borderRadius: 3,
    background: '#1e2a3a',
    color: '#7ec8e3',
    padding: '4px 10px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
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
  windowTabsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap' as const,
    marginBottom: 2,
  },
  windowTabBtn: {
    border: '1px solid #335',
    borderRadius: 3,
    background: '#1a1a2e',
    color: '#999',
    padding: '2px 8px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
  },
  windowTabBtnActive: {
    color: '#7ec8e3',
    borderColor: '#3a5f7a',
    background: '#1e2a3a',
  },
  smallActionBtn: {
    border: '1px solid #3a5f7a',
    borderRadius: 3,
    background: '#1e2a3a',
    color: '#7ec8e3',
    padding: '2px 8px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
  },
  smallDangerBtn: {
    border: '1px solid #6a3030',
    borderRadius: 3,
    background: '#2a1a1a',
    color: '#e8a0a0',
    padding: '2px 8px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
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
