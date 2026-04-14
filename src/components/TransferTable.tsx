import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store.js';
import type { Transfer } from '../engine/types.js';
import { NumericInput } from './NumericInput.js';

export function TransferTable() {
  const { stations, lines, transfers, updateTransfer } = useStore();
  const [syncOppositeDirections, setSyncOppositeDirections] = useState(true);
  const [expandedStationIds, setExpandedStationIds] = useState<Set<string>>(new Set());

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

  const stationIds = useMemo(() => Array.from(grouped.keys()), [transfers]);

  useEffect(() => {
    // Keep only valid station IDs and auto-expand when there is exactly one group.
    setExpandedStationIds(prev => {
      const valid = new Set(stationIds);
      const next = new Set<string>();
      prev.forEach(id => {
        if (valid.has(id)) next.add(id);
      });
      if (stationIds.length === 1 && next.size === 0) {
        next.add(stationIds[0]);
      }
      return next;
    });
  }, [stationIds]);

  function toggleStationGroup(stationId: string) {
    setExpandedStationIds(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
      }
      return next;
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Transfer Table</div>
      <div style={styles.descriptionRow}>
        <div style={styles.description}>
          Edit transfer wait times between lines at shared stations.
        </div>
        <label style={styles.syncToggleLabel}>
          <input
            type="checkbox"
            checked={syncOppositeDirections}
            onChange={e => setSyncOppositeDirections(e.target.checked)}
          />
          Sync A↔B
        </label>
      </div>

      {Array.from(grouped.entries()).map(([stationId, group]) => {
        const station = stations[stationId];
        const expanded = expandedStationIds.has(stationId);
        return (
          <div key={stationId} style={styles.stationGroup}>
            <button
              type="button"
              style={styles.stationHeaderBtn}
              onClick={() => toggleStationGroup(stationId)}
              aria-expanded={expanded}
            >
              <span style={styles.stationDot} />
              <span style={styles.stationName}>
                {station?.name ?? stationId}
              </span>
              {station?.agencies && station.agencies.length > 0 && (
                <span style={styles.stationAgency}>({station.agencies.join(', ')})</span>
              )}
              <span style={styles.transferCount}>{group.length} transfer{group.length !== 1 ? 's' : ''}</span>
              <span style={styles.chevron}>{expanded ? '▾' : '▸'}</span>
            </button>

            {expanded && (
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
                              updateTransfer(
                                t.stationId,
                                t.fromLineId,
                                t.toLineId,
                                v,
                                syncOppositeDirections
                              )
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
            )}
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
    flexShrink: 0,
  },
  description: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  descriptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
    flexShrink: 0,
  },
  syncToggleLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#8e8eb8',
    whiteSpace: 'nowrap',
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
    flexShrink: 0,
  },
  stationHeaderBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#1a1a35',
    border: 'none',
    borderBottom: '1px solid #2a2a4a',
    cursor: 'pointer',
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
  chevron: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#7a7aa8',
    marginLeft: 8,
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
