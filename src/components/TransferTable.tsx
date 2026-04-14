import React from 'react';
import { useStore } from '../state/store.js';

export function TransferTable() {
  const { stations, lines, transfers, updateTransfer } = useStore();

  if (transfers.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Transfer Table</div>
        <div style={styles.empty}>No transfers yet. Add multiple lines sharing stations.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Transfer Table</div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Station</th>
              <th style={styles.th}>From Line</th>
              <th style={styles.th}>To Line</th>
              <th style={styles.th}>Min</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t, i) => {
              const station = stations[t.stationId];
              const fromLine = lines[t.fromLineId];
              const toLine = lines[t.toLineId];
              return (
                <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  <td style={styles.td}>{station?.name ?? t.stationId.slice(0, 6)}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.lineChip,
                        background: fromLine?.color ?? '#444',
                      }}
                    >
                      {fromLine ? (fromLine.agency + ' ') : ''}
                      {t.fromLineId.slice(0, 6)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.lineChip,
                        background: toLine?.color ?? '#444',
                      }}
                    >
                      {toLine ? (toLine.agency + ' ') : ''}
                      {t.toLineId.slice(0, 6)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min={0}
                      style={styles.minInput}
                      value={t.transferMin}
                      onChange={e =>
                        updateTransfer(
                          t.stationId,
                          t.fromLineId,
                          t.toLineId,
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    overflowY: 'auto',
    flex: 1,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#c8a0e8',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 6,
  },
  empty: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  th: {
    textAlign: 'left',
    color: '#888',
    padding: '4px 8px',
    borderBottom: '1px solid #333',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '3px 8px',
    color: '#c8c8e0',
    verticalAlign: 'middle',
  },
  rowEven: {
    background: '#111124',
  },
  rowOdd: {
    background: '#0d0d1a',
  },
  lineChip: {
    display: 'inline-block',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    color: '#fff',
    fontWeight: 600,
    maxWidth: 90,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  minInput: {
    width: 44,
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '1px 4px',
    outline: 'none',
  },
};
