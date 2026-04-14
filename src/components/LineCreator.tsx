import React, { useState, useEffect } from 'react';
import { useStore } from '../state/store.js';

export function LineCreator() {
  const { stations, selectedStationIds, lines, addLine, setSelectedTool, setSelectedStationIds } = useStore();

  const [lineName, setLineName] = useState('');
  const [color, setColor] = useState('#e74c3c');
  const [agency, setAgency] = useState('');
  const [travelTimes, setTravelTimes] = useState<number[]>([]);
  const [firstDep, setFirstDep] = useState(360); // 6:00
  const [lastDep, setLastDep] = useState(1380); // 23:00
  const [headway, setHeadway] = useState(10);
  const [bidirectional, setBidirectional] = useState(true);

  const selectedStations = selectedStationIds.map(id => stations[id]).filter(Boolean);

  useEffect(() => {
    // Adjust travel times array when selection changes
    const needed = Math.max(0, selectedStationIds.length - 1);
    setTravelTimes(prev => {
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        return [...prev, ...Array(needed - prev.length).fill(5)];
      }
      return prev.slice(0, needed);
    });
  }, [selectedStationIds]);

  function formatTime(mins: number) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function parseTime(val: string): number {
    const [h, m] = val.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function handleCreate() {
    if (selectedStationIds.length < 2) return;
    if (!lineName.trim()) return;

    addLine({
      color,
      agency: agency.trim() || 'Default',
      stops: [...selectedStationIds],
      travelTimes: travelTimes.map(t => Math.max(1, t)),
      firstDeparture: firstDep,
      lastDeparture: lastDep,
      headwayMin: headway,
      bidirectional,
    });

    // Reset
    setLineName('');
    setColor('#e74c3c');
    setAgency('');
    setTravelTimes([]);
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>Line Creator</div>

      <label style={styles.label}>Line Name</label>
      <input
        style={styles.input}
        value={lineName}
        onChange={e => setLineName(e.target.value)}
        placeholder="Red Line, Bus 42…"
      />

      <label style={styles.label}>Color</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>{color}</span>
      </div>

      <label style={styles.label}>Agency</label>
      <input
        style={styles.input}
        value={agency}
        onChange={e => setAgency(e.target.value)}
        placeholder="Metro, Bus Co…"
      />

      <label style={styles.label}>Stops (in order)</label>
      <div style={styles.stopList}>
        {selectedStations.map((st, i) => (
          <div key={st.id} style={styles.stopRow}>
            <span style={{ ...styles.stopDot, background: color }} />
            <span style={styles.stopName}>{st.name}</span>
            {i < selectedStations.length - 1 && (
              <div style={styles.travelRow}>
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
                />
                <span style={styles.unit}>min</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <label style={styles.label}>Schedule</label>
      <div style={styles.schedRow}>
        <span style={styles.schedLabel}>First dep</span>
        <input
          type="time"
          style={styles.timeInput}
          value={formatTime(firstDep)}
          onChange={e => setFirstDep(parseTime(e.target.value))}
        />
      </div>
      <div style={styles.schedRow}>
        <span style={styles.schedLabel}>Last dep</span>
        <input
          type="time"
          style={styles.timeInput}
          value={formatTime(lastDep)}
          onChange={e => setLastDep(parseTime(e.target.value))}
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
        />
        <span style={styles.unit}>min</span>
      </div>

      <label style={styles.label}>Direction</label>
      <div style={styles.checkRow}>
        <input
          type="checkbox"
          id="bidirectional-toggle"
          checked={bidirectional}
          onChange={e => setBidirectional(e.target.checked)}
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
    flexWrap: 'wrap',
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
  },
  travelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
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
};
