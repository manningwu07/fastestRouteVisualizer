import React from 'react';
import { useStore } from '../state/store.js';
import type { Transfer } from '../engine/types.js';
import { NumericInput } from './NumericInput.js';

export function TransferTable() {
  const { stations, lines, transfers, updateTransfer } = useStore();

  if (transfers.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Transfer Table</div>
        <div style={styles.empty}>
          No transfers yet. Create multiple lines that share stations to configure transfer times.
        </div>
      </div>
    );
  }

  // Group transfers by stationId, preserving insertion order
  const grouped = new Map<string, Transfer[]>();
  for (const t of transfers) {
    if (!grouped.has(t.stationId)) grouped.set(t.stationId, []);
    grouped.get(t.stationId)!.push(t);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Transfer Table</div>
      <div style={styles.description}>
        Edit transfer wait times between lines at shared stations.
      </div>

      {Array.from(grouped.entries()).map(([stationId, group]) => {
        const station = stations[stationId];
        return (
          <div key={stationId} style={styles.stationGroup}>
            {/* Station section header */}
            <div style={styles.stationHeader}>
              <span style={styles.stationDot} />
              <span style={styles.stationName}>
                {station?.name ?? stationId}
              </span>
              {station?.agencies && station.agencies.length > 0 && (
                <span style={styles.stationAgency}>({station.agencies.join(', ')})</span>
              )}
              <span style={styles.transferCount}>{group.length} transfer{group.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table for this station's transfers */}
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>From Line</th>
                  <th style={styles.th}>To Line</th>
                  <th style={{ ...styles.th, ...styles.thMin }}>Wait (min)</th>
                </tr>
              </thead>
              <tbody>
                {group.map((t, i) => {
                  const fromLine = lines[t.fromLineId];
                  const toLine = lines[t.toLineId];
                  return (
                    <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                      <td style={styles.td}>
                        <div style={styles.lineBadge}>
                          <span
                            style={{
                              ...styles.lineDot,
                              background: fromLine?.color ?? '#444',
                            }}
                          />
                          <span style={styles.lineName}>
                            {fromLine?.agency ?? t.fromLineId}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.lineBadge}>
                          <span
                            style={{
                              ...styles.lineDot,
                              background: toLine?.color ?? '#444',
                            }}
                          />
                          <span style={styles.lineName}>
                            {toLine?.agency ?? t.toLineId}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...styles.td, ...styles.tdMin }}>
                        <NumericInput
                          value={t.transferMin}
                          onChange={v =>
                            updateTransfer(t.stationId, t.fromLineId, t.toLineId, v)
                          }
                          min={0}
                          style={styles.minInput}
                          suffix="min"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    flex: 1,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#c8a0e8',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 8,
  },
  description: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  empty: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 1.6,
  },
  stationGroup: {
    background: '#111124',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid #222',
  },
  stationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#1a1a35',
    borderBottom: '1px solid #2a2a4a',
  },
  stationDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#7ec8e3',
    flexShrink: 0,
    display: 'inline-block',
  },
  stationName: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: 13,
    color: '#e8e8f0',
  },
  stationAgency: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888',
  },
  transferCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#556',
    marginLeft: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    color: '#777',
    padding: '6px 12px',
    borderBottom: '1px solid #222',
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  thMin: {
    width: 90,
    textAlign: 'center' as const,
  },
  td: {
    padding: '7px 12px',
    color: '#c8c8e0',
    verticalAlign: 'middle',
  },
  tdMin: {
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  },
  rowEven: {
    background: 'transparent',
  },
  rowOdd: {
    background: '#0d0d1f',
  },
  lineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  lineDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  lineName: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#d0d0e8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 140,
  },
  minInput: {
    width: 54,
    background: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: '3px 6px',
    outline: 'none',
    textAlign: 'center',
  },
  minLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555',
    marginLeft: 4,
  },
};
