import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';

export function RunEdgeEditor() {
  const {
    stations,
    runEdges,
    selectedRunEdgeId,
    setSelectedRunEdgeId,
    updateRunEdge,
    removeRunEdge,
  } = useStore();

  const edge = selectedRunEdgeId ? runEdges.find(e => e.id === selectedRunEdgeId) : null;

  const [timeMin, setTimeMin] = useState(5);
  const [bidirectional, setBidirectional] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (edge) {
      setTimeMin(edge.timeMin);
      setBidirectional(edge.bidirectional);
      setConfirmDelete(false);
    }
  }, [selectedRunEdgeId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedRunEdgeId(null);
  }, [setSelectedRunEdgeId]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!edge) return null;

  const fromStation = stations[edge.from];
  const toStation = stations[edge.to];

  function save(overrides?: { timeMin?: number; bidirectional?: boolean }) {
    if (!selectedRunEdgeId) return;
    updateRunEdge(selectedRunEdgeId, {
      timeMin: Math.max(1, overrides?.timeMin ?? timeMin),
      bidirectional: overrides?.bidirectional ?? bidirectional,
    });
  }

  function handleDelete() {
    if (!selectedRunEdgeId) return;
    removeRunEdge(selectedRunEdgeId);
    setSelectedRunEdgeId(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.header}>Edit Run Edge</div>
        <button style={styles.closeBtn} onClick={() => setSelectedRunEdgeId(null)} title="Close (Esc)">
          ✕
        </button>
      </div>

      <div style={styles.pair}>
        <span style={styles.stationTag}>{fromStation?.name ?? edge.from}</span>
        <span style={styles.arrow}>{bidirectional ? '⇄' : '→'}</span>
        <span style={styles.stationTag}>{toStation?.name ?? edge.to}</span>
      </div>

      <label style={styles.label}>Travel Time</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          min={1}
          style={styles.input}
          value={timeMin}
          onChange={e => setTimeMin(parseInt(e.target.value) || 1)}
          onBlur={() => save()}
        />
        <span style={styles.unit}>min</span>
      </div>

      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={bidirectional}
          onChange={e => {
            setBidirectional(e.target.checked);
            save({ bidirectional: e.target.checked });
          }}
        />
        <span style={styles.checkLabel}>Bidirectional</span>
      </label>

      <div style={styles.buttonRow}>
        <button style={styles.doneBtn} onClick={() => setSelectedRunEdgeId(null)}>
          Done
        </button>
        {!confirmDelete ? (
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        ) : (
          <div style={styles.confirmBox}>
            <span style={{ color: '#e8a0a0', fontSize: 11, fontFamily: 'monospace' }}>
              Delete this run edge?
            </span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button style={styles.confirmDeleteBtn} onClick={handleDelete}>Yes, Delete</button>
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
    gap: 8,
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
    color: '#f0c060',
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
  buttonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
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
