import React, { useState } from 'react';
import { useStore } from '../state/store.js';

export function RunEdgeCreator() {
  const { stations, selectedStationIds, addRunEdge, setSelectedTool, setSelectedStationIds } = useStore();

  const [timeMin, setTimeMin] = useState(5);
  const [bidirectional, setBidirectional] = useState(true);

  const stA = selectedStationIds[0] ? stations[selectedStationIds[0]] : null;
  const stB = selectedStationIds[1] ? stations[selectedStationIds[1]] : null;

  function handleCreate() {
    if (!stA || !stB) return;
    addRunEdge({
      from: stA.id,
      to: stB.id,
      timeMin: Math.max(1, timeMin),
      bidirectional,
    });
    setSelectedStationIds([]);
    setSelectedTool('select');
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Run Edge Creator</div>

      {selectedStationIds.length < 2 ? (
        <div style={styles.hint}>Click exactly 2 stations on the canvas to create a run edge.</div>
      ) : (
        <>
          <div style={styles.pair}>
            <span style={styles.stationTag}>{stA?.name ?? '?'}</span>
            <span style={styles.arrow}>{bidirectional ? '⇄' : '→'}</span>
            <span style={styles.stationTag}>{stB?.name ?? '?'}</span>
          </div>

          <label style={styles.label}>Travel Time (min)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={1}
              style={styles.input}
              value={timeMin}
              onChange={e => setTimeMin(parseInt(e.target.value) || 1)}
            />
            <span style={styles.unit}>min</span>
          </div>

          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={bidirectional}
              onChange={e => setBidirectional(e.target.checked)}
            />
            <span style={styles.checkLabel}>Bidirectional</span>
          </label>

          <button style={styles.btn} onClick={handleCreate}>
            Create Run Edge
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#f0c060',
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
  pair: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#111124',
    borderRadius: 4,
    padding: '6px 10px',
  },
  stationTag: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8c8e0',
    background: '#2a2a4a',
    padding: '2px 8px',
    borderRadius: 3,
    border: '1px solid #444',
  },
  arrow: {
    color: '#f0c060',
    fontSize: 16,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888',
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '4px 8px',
    width: 60,
    outline: 'none',
  },
  unit: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  checkLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#aaa',
  },
  btn: {
    marginTop: 4,
    padding: '6px 16px',
    background: '#3a3a18',
    color: '#f0e0a0',
    border: '1px solid #7a6030',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    alignSelf: 'flex-start',
  },
};
