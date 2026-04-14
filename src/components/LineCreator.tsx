import React, { useState, useEffect } from 'react';
import { useStore } from '../state/store.js';
import { ColorPicker, PRESET_COLORS } from './ColorPicker.js';
import type { LineSchedule, ScheduleWindow } from '../engine/types.js';

const DEFAULT_WINDOW: ScheduleWindow = {
  firstDeparture: 360,
  lastDeparture: 1380,
  headwayMin: 10,
};
const MAX_WINDOWS = 8;

function copyWindows(windows: ScheduleWindow[]): ScheduleWindow[] {
  return windows.map(w => ({ ...w }));
}

export function LineCreator() {
  const { stations, selectedStationIds, lines, addLine, setSelectedTool, setSelectedStationIds } = useStore();

  // Auto-assign the next unused preset color
  function getNextColor(): string {
    const usedColors = new Set(Object.values(lines).map(l => l.color.toLowerCase()));
    const next = PRESET_COLORS.find(c => !usedColors.has(c.hex.toLowerCase()));
    return next ? next.hex : PRESET_COLORS[0].hex;
  }

  const [lineName, setLineName] = useState('');
  const [color, setColor] = useState(() => getNextColor());
  const [agency, setAgency] = useState('');
  const [travelTimes, setTravelTimes] = useState<Array<number | null>>([]);
  const [reverseTravelTimes, setReverseTravelTimes] = useState<Array<number | null>>([]);
  const [syncReverseOffsets, setSyncReverseOffsets] = useState(true);
  const [bidirectional, setBidirectional] = useState(true);

  const [fwdWindows, setFwdWindows] = useState<ScheduleWindow[]>([{ ...DEFAULT_WINDOW }]);
  const [revWindows, setRevWindows] = useState<ScheduleWindow[]>([{ ...DEFAULT_WINDOW }]);
  const [fwdWindowIdx, setFwdWindowIdx] = useState(0);
  const [revWindowIdx, setRevWindowIdx] = useState(0);

  // selectedStationIds already preserves insertion order (see GraphCanvas handleMouseDown)
  const selectedStations = selectedStationIds.map(id => stations[id]).filter(Boolean);

  const activeFwdWindow = fwdWindows[fwdWindowIdx] ?? fwdWindows[0] ?? DEFAULT_WINDOW;
  const activeRevWindow = revWindows[revWindowIdx] ?? revWindows[0] ?? DEFAULT_WINDOW;

  useEffect(() => {
    // Adjust travel times array when selection changes
    const needed = Math.max(0, selectedStationIds.length - 1);
    setTravelTimes(prev => {
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        return [...prev, ...Array(needed - prev.length).fill(null)];
      }
      return prev.slice(0, needed);
    });
    setReverseTravelTimes(prev => {
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        return [...prev, ...Array(needed - prev.length).fill(null)];
      }
      return prev.slice(0, needed);
    });
  }, [selectedStationIds]);

  // Keep selected tab indices valid when window arrays change
  useEffect(() => {
    if (fwdWindowIdx >= fwdWindows.length) setFwdWindowIdx(Math.max(0, fwdWindows.length - 1));
  }, [fwdWindowIdx, fwdWindows.length]);

  useEffect(() => {
    if (revWindowIdx >= revWindows.length) setRevWindowIdx(Math.max(0, revWindows.length - 1));
  }, [revWindowIdx, revWindows.length]);

  // When bidirectional is checked, copy forward windows into reverse windows
  function handleBidirectionalChange(checked: boolean) {
    setBidirectional(checked);
    if (checked) {
      const copied = copyWindows(fwdWindows.length > 0 ? fwdWindows : [{ ...DEFAULT_WINDOW }]);
      setRevWindows(copied);
      setRevWindowIdx(Math.min(revWindowIdx, copied.length - 1));
    }
  }

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

  function reverseSegmentAt(reverseIdx: number): number {
    const forwardSegmentIdx = travelTimes.length - 1 - reverseIdx;
    if (syncReverseOffsets) {
      return travelTimes[forwardSegmentIdx] ?? 5;
    }
    return reverseTravelTimes[forwardSegmentIdx] ?? travelTimes[forwardSegmentIdx] ?? 5;
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

    if (syncReverseOffsets) {
      setTravelTimes(prev => {
        const next = [...prev];
        next[forwardSegmentIdx] = segmentMin;
        return next;
      });
      return;
    }

    setReverseTravelTimes(prev => {
      const next = [...prev];
      next[forwardSegmentIdx] = segmentMin;
      return next;
    });
  }

  // Compute cumulative departure time at each stop index for display (forward)
  function depTimeAtStop(idx: number): string {
    let t = activeFwdWindow.firstDeparture;
    for (let i = 0; i < idx; i++) {
      t += travelTimes[i] ?? 5;
    }
    return formatTime(t);
  }

  // Compute cumulative departure time at each stop index for display (reverse)
  // reverseIdx 0 = last stop, reverseIdx 1 = second-to-last, etc.
  function revDepTimeAtStop(reverseIdx: number): string {
    let t = activeRevWindow.firstDeparture;
    for (let i = 0; i < reverseIdx; i++) {
      t += reverseSegmentAt(i);
    }
    return formatTime(t);
  }

  function handleCreate() {
    if (selectedStationIds.length < 2) return;
    if (!lineName.trim()) return;

    const forwardSchedule: LineSchedule = {
      windows: fwdWindows.map(w => ({
        firstDeparture: w.firstDeparture,
        lastDeparture: w.lastDeparture,
        headwayMin: Math.max(1, w.headwayMin),
      })),
    };

    const reverseSchedule: LineSchedule | undefined = bidirectional
      ? {
          windows: revWindows.map((w, idx) => ({
            firstDeparture: w.firstDeparture,
            lastDeparture: w.lastDeparture,
            headwayMin: Math.max(1, w.headwayMin || fwdWindows[idx]?.headwayMin || 10),
          })),
        }
      : undefined;

    addLine({
      color,
      agency: agency.trim() || 'Default',
      stops: [...selectedStationIds],
      travelTimes: travelTimes.map(t => Math.max(1, t ?? 5)),
      reverseTravelTimes: bidirectional && !syncReverseOffsets
        ? reverseTravelTimes.map((t, idx) => Math.max(1, t ?? travelTimes[idx] ?? 5))
        : undefined,
      forwardSchedule,
      reverseSchedule,
      bidirectional,
    });

    // Reset
    setLineName('');
    setColor(getNextColor());
    setAgency('');
    setTravelTimes([]);
    setReverseTravelTimes([]);
    setSyncReverseOffsets(true);
    setFwdWindows([{ ...DEFAULT_WINDOW }]);
    setRevWindows([{ ...DEFAULT_WINDOW }]);
    setFwdWindowIdx(0);
    setRevWindowIdx(0);
    setBidirectional(true);
    setSelectedStationIds([]);
    setSelectedTool('select');
  }

  if (selectedStationIds.length < 2) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Line Creator</div>
        <div style={styles.hint}>Select 2 or more stations on the canvas to build a line.</div>
      </div>
    );
  }

  const reversedStations = [...selectedStations].reverse();

  return (
    <div style={styles.container}>
      <div style={styles.header}>Line Creator</div>

      <label style={styles.label}>Line Name</label>
      <input
        style={styles.input}
        value={lineName}
        onChange={e => setLineName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="Red Line, Bus 42…"
      />

      <label style={styles.label}>Color</label>
      <ColorPicker value={color} onChange={setColor} />

      <label style={styles.label}>Agency</label>
      <input
        style={styles.input}
        value={agency}
        onChange={e => setAgency(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="Metro, Bus Co…"
      />

      <label style={styles.label}>Direction</label>
      <div style={styles.checkRow}>
        <input
          type="checkbox"
          id="bidirectional-toggle"
          checked={bidirectional}
          onChange={e => handleBidirectionalChange(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <div>
          <label
            htmlFor="bidirectional-toggle"
            style={{ ...styles.checkLabel, cursor: 'pointer' }}
          >
            Runs both directions
          </label>
          <div style={styles.checkSub}>
            {bidirectional ? 'Trains run A→B and B→A' : 'One-way only (e.g. loop segment)'}
          </div>
        </div>
      </div>

      {/* Forward schedule + stops */}
      <div style={styles.schedSection}>
        <div style={styles.schedSectionHeader}>
          <span style={{ color: color }}>▶</span> Forward
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
          {selectedStations.map((st, i) => (
            <div key={st.id} style={styles.stopRow}>
              <span style={{ ...styles.stopDot, background: color }} />
              <span style={styles.stopName}>{st.name}</span>
              <input
                type="time"
                style={{ ...styles.timeInput, ...styles.stopTimeInput }}
                value={depTimeAtStop(i)}
                onChange={e => handleForwardStopTimeChange(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              {i < selectedStations.length - 1 && (
                <div style={styles.travelRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    style={styles.smallInput}
                    value={travelTimes[i] ?? ''}
                    placeholder=""
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setTravelTimes(prev => {
                        const next = [...prev];
                        next[i] = raw === '' ? null : Math.max(1, parseInt(raw, 10));
                        return next;
                      });
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                  <span style={styles.unit}>min</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.schedGrid}>
          <span style={styles.schedLabel}>First dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(activeFwdWindow.firstDeparture)}
            onChange={e => updateFwdWindow({ firstDeparture: parseTime(e.target.value) })}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Last dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(activeFwdWindow.lastDeparture)}
            onChange={e => updateFwdWindow({ lastDeparture: parseTime(e.target.value) })}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Headway</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              inputMode="numeric"
              style={styles.smallInput}
              value={activeFwdWindow.headwayMin}
              placeholder=""
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                updateFwdWindow({ headwayMin: Math.max(1, parseInt(raw || '1', 10)) });
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.unit}>min</span>
          </div>
        </div>
      </div>

      {/* Reverse schedule (only when bidirectional) */}
      {bidirectional && (
        <div style={styles.schedSection}>
          <div style={styles.schedSectionHeader}>
            <span style={{ color: color }}>◀</span> Reverse
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
          <label style={styles.syncRow}>
            <input
              type="checkbox"
              checked={syncReverseOffsets}
              onChange={e => setSyncReverseOffsets(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={styles.syncLabel}>Sync reverse offsets with forward</span>
          </label>
          <div style={styles.stopList}>
            {reversedStations.map((st, i) => (
              <div key={st.id} style={styles.stopRow}>
                <span style={{ ...styles.stopDot, background: color }} />
                <span style={styles.stopName}>{st.name}</span>
                <input
                  type="time"
                  style={{ ...styles.timeInput, ...styles.stopTimeInput }}
                  value={revDepTimeAtStop(i)}
                  onChange={e => handleReverseStopTimeChange(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />
                {i < reversedStations.length - 1 && (
                  <div style={styles.travelRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      style={styles.smallInput}
                      value={
                        syncReverseOffsets
                          ? travelTimes[travelTimes.length - 1 - i] ?? ''
                          : reverseTravelTimes[travelTimes.length - 1 - i] ?? ''
                      }
                      placeholder=""
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const parsed = raw === '' ? null : Math.max(1, parseInt(raw, 10));
                        const forwardSegmentIdx = travelTimes.length - 1 - i;

                        if (syncReverseOffsets) {
                          setTravelTimes(prev => {
                            const next = [...prev];
                            next[forwardSegmentIdx] = parsed;
                            return next;
                          });
                          return;
                        }

                        setReverseTravelTimes(prev => {
                          const next = [...prev];
                          next[forwardSegmentIdx] = parsed;
                          return next;
                        });
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                    <span style={styles.unit}>min</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={styles.schedGrid}>
            <span style={styles.schedLabel}>First dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(activeRevWindow.firstDeparture)}
              onChange={e => updateRevWindow({ firstDeparture: parseTime(e.target.value) })}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Last dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(activeRevWindow.lastDeparture)}
              onChange={e => updateRevWindow({ lastDeparture: parseTime(e.target.value) })}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Headway</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                style={styles.smallInput}
                value={activeRevWindow.headwayMin}
                placeholder=""
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  updateRevWindow({ headwayMin: Math.max(1, parseInt(raw || '1', 10)) });
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span style={styles.unit}>min</span>
            </div>
          </div>
        </div>
      )}

      <button
        style={{ ...styles.btn, opacity: lineName.trim() ? 1 : 0.5 }}
        onClick={handleCreate}
        disabled={!lineName.trim()}
      >
        Create Line
      </button>
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
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#7ec8e3',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  hint: {
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 1.5,
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
    flexWrap: 'wrap' as const,
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
    minWidth: 60,
    flex: 1,
  },
  stopTimeInput: {
    minWidth: 96,
    padding: '2px 6px',
  },
  travelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
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
  btn: {
    marginTop: 8,
    padding: '6px 16px',
    background: '#2a5a3a',
    color: '#a8e8b8',
    border: '1px solid #4a8a5a',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    alignSelf: 'flex-start',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: '#111124',
    borderRadius: 4,
    padding: '6px 8px',
  },
  checkLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8c8e0',
    display: 'block',
  },
  checkSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  syncRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  syncLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#888',
  },
};
