import React, { useState, useEffect } from 'react';
import { useStore } from '../state/store.js';
import { ColorPicker, PRESET_COLORS } from './ColorPicker.js';
import type { LineSchedule } from '../engine/types.js';

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

  // Forward schedule
  const [fwdFirst, setFwdFirst] = useState(360);   // 6:00
  const [fwdLast, setFwdLast] = useState(1380);    // 23:00
  const [fwdHeadway, setFwdHeadway] = useState<number | null>(null);

  // Reverse schedule (mirrors forward by default)
  const [revFirst, setRevFirst] = useState(360);
  const [revLast, setRevLast] = useState(1380);
  const [revHeadway, setRevHeadway] = useState<number | null>(null);

  // selectedStationIds already preserves insertion order (see GraphCanvas handleMouseDown)
  const selectedStations = selectedStationIds.map(id => stations[id]).filter(Boolean);

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

  // When bidirectional is first checked, copy forward values into reverse
  function handleBidirectionalChange(checked: boolean) {
    setBidirectional(checked);
    if (checked) {
      setRevFirst(fwdFirst);
      setRevLast(fwdLast);
      setRevHeadway(fwdHeadway);
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
      setFwdFirst(nextTime);
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
      setRevFirst(nextTime);
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
    let t = fwdFirst;
    for (let i = 0; i < idx; i++) {
      t += travelTimes[i] ?? 5;
    }
    return formatTime(t);
  }

  // Compute cumulative departure time at each stop index for display (reverse)
  // reverseIdx 0 = last stop, reverseIdx 1 = second-to-last, etc.
  function revDepTimeAtStop(reverseIdx: number): string {
    let t = revFirst;
    for (let i = 0; i < reverseIdx; i++) {
      t += reverseSegmentAt(i);
    }
    return formatTime(t);
  }

  function handleCreate() {
    if (selectedStationIds.length < 2) return;
    if (!lineName.trim()) return;

    const forwardSchedule: LineSchedule = {
      firstDeparture: fwdFirst,
      lastDeparture: fwdLast,
      headwayMin: Math.max(1, fwdHeadway ?? 10),
    };

    const reverseSchedule: LineSchedule | undefined = bidirectional
      ? { firstDeparture: revFirst, lastDeparture: revLast, headwayMin: Math.max(1, revHeadway ?? fwdHeadway ?? 10) }
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
    setFwdHeadway(null);
    setRevHeadway(null);
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
            value={formatTime(fwdFirst)}
            onChange={e => setFwdFirst(parseTime(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Last dep</span>
          <input
            type="time"
            style={styles.timeInput}
            value={formatTime(fwdLast)}
            onChange={e => setFwdLast(parseTime(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span style={styles.schedLabel}>Headway</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              inputMode="numeric"
              style={styles.smallInput}
              value={fwdHeadway ?? ''}
              placeholder=""
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setFwdHeadway(raw === '' ? null : Math.max(1, parseInt(raw, 10)));
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
              value={formatTime(revFirst)}
              onChange={e => setRevFirst(parseTime(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Last dep</span>
            <input
              type="time"
              style={styles.timeInput}
              value={formatTime(revLast)}
              onChange={e => setRevLast(parseTime(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span style={styles.schedLabel}>Headway</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                style={styles.smallInput}
                value={revHeadway ?? ''}
                placeholder=""
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setRevHeadway(raw === '' ? null : Math.max(1, parseInt(raw, 10)));
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
  stopTime: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#7ec8e3',
    minWidth: 44,
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
