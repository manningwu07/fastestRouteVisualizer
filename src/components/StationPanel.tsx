import React, { useState, useEffect } from 'react';
import { useStore } from '../state/store.js';

export function StationPanel() {
  const { stations, selectedStationIds, updateStation, removeStation, setSelectedStationIds } =
    useStore();

  const stationId = selectedStationIds[0];
  const station = stationId ? stations[stationId] : null;

  const [name, setName] = useState('');
  const [agency, setAgency] = useState('');

  useEffect(() => {
    if (station) {
      setName(station.name);
      setAgency(station.agency ?? '');
    }
  }, [stationId]);

  if (!station) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Station</div>
        <div style={styles.hint}>Select a station to edit it.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Station</div>

      <label style={styles.label}>Name</label>
      <input
        style={styles.input}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => updateStation(station.id, { name })}
      />

      <label style={styles.label}>Agency</label>
      <input
        style={styles.input}
        value={agency}
        onChange={e => setAgency(e.target.value)}
        onBlur={() => updateStation(station.id, { agency })}
        placeholder="optional"
      />

      <div style={styles.coords}>
        <span style={styles.coordLabel}>x: {Math.round(station.x)}</span>
        <span style={styles.coordLabel}>y: {Math.round(station.y)}</span>
      </div>

      <button
        style={styles.deleteBtn}
        onClick={() => {
          removeStation(station.id);
          setSelectedStationIds([]);
        }}
      >
        Delete Station
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
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
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
    outline: 'none',
  },
  coords: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  coordLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555',
  },
  deleteBtn: {
    marginTop: 8,
    padding: '5px 12px',
    background: '#3a1a1a',
    color: '#e8a0a0',
    border: '1px solid #6a3030',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    alignSelf: 'flex-start',
  },
};
