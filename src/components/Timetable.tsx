import React from 'react';
import { useStore } from '../state/store.js';
import type { RouteStep } from '../engine/types.js';

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toAMPM(minutes: number): string {
  const totalMins = Math.floor(minutes);
  const h24 = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface TimetableProps {
  steps?: RouteStep[];
  startTime?: number;
  compact?: boolean;
}

export function Timetable({ steps: propSteps, startTime: propStartTime, compact = false }: TimetableProps) {
  const { stations, lines, currentRoute, routeStartTime, showToast } = useStore();

  const steps = propSteps ?? currentRoute;
  const startTime = propStartTime ?? routeStartTime;

  if (steps.length < 2) {
    return (
      <div style={styles.empty}>
        {steps.length === 0
          ? 'No route started. Select a starting station.'
          : 'Add more steps to see timetable.'}
      </div>
    );
  }

  const lastStep = steps[steps.length - 1];
  const totalMin = lastStep.cumulativeMin - startTime;

  function buildSheetsRows(): string {
    // Row 1: station names
    const names = steps.map(step => stations[step.stationId]?.name ?? step.stationId);
    // Row 2: arrival times (AM/PM)
    const times = steps.map((step, i) => toAMPM(i === 0 ? startTime : step.arriveAt));
    return names.join('\t') + '\n' + times.join('\t');
  }

  function buildTsvRows(): string {
    const header = 'Station\tVia\tArrive\tWait\tDepart\tTravel\tCumulative';
    const rows = steps.map((step, i) => {
      const stName = stations[step.stationId]?.name ?? step.stationId;
      const line = step.lineId ? lines[step.lineId] : null;
      const isFirst = i === 0;
      const via = isFirst ? '-' : line ? (line.agency || line.id.slice(0, 8)) : 'Run';
      const arrive = isFirst ? toAMPM(startTime) : toAMPM(step.arriveAt);
      const wait = isFirst ? '0' : String(step.waitTime);
      const depart = isFirst ? toAMPM(startTime) : toAMPM(step.departAt);
      const travel = String(step.travelTime);
      const cumulative = isFirst ? '0' : String(step.cumulativeMin - startTime);
      return [stName, via, arrive, wait, depart, travel, cumulative].join('\t');
    });
    return header + '\n' + rows.join('\n');
  }

  async function handleCopySheets() {
    try {
      await navigator.clipboard.writeText(buildSheetsRows());
      showToast('Copied!');
    } catch {
      showToast('Copy failed');
    }
  }

  async function handleCopyTsv() {
    try {
      await navigator.clipboard.writeText(buildTsvRows());
      showToast('Copied!');
    } catch {
      showToast('Copy failed');
    }
  }

  return (
    <div style={styles.wrapper}>
      {!compact && <div style={styles.header}>Timetable</div>}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Station</th>
              <th style={styles.th}>Via</th>
              <th style={styles.th}>Arrive</th>
              <th style={styles.th}>Wait</th>
              <th style={styles.th}>Depart</th>
              <th style={styles.th}>Travel</th>
              <th style={styles.th}>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => {
              const st = stations[step.stationId];
              const line = step.lineId ? lines[step.lineId] : null;
              const isFirst = i === 0;
              const rowBg = line
                ? `${line.color}18`
                : step.lineId === null && i > 0
                ? '#f0c06018'
                : '#1a1a2e';
              const nextStep = steps[i + 1];

              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={styles.td}>{i + 1}</td>
                  <td style={{ ...styles.td, color: '#e8e8f0', fontWeight: 600 }}>
                    {st?.name ?? step.stationId}
                  </td>
                  <td style={styles.td}>
                    {isFirst ? (
                      <span style={{ color: '#556' }}>Start</span>
                    ) : line ? (
                      <span style={{ color: line.color, fontWeight: 700 }}>
                        {line.id.slice(0, 8)}
                      </span>
                    ) : (
                      <span style={{ color: '#f0c060' }}>Run</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, color: '#7ec8e3' }}>
                    {isFirst ? toHHMM(startTime) : toHHMM(step.arriveAt)}
                  </td>
                  <td style={{ ...styles.td, color: '#e8c87a' }}>
                    {isFirst ? '-' : step.waitTime > 0 ? `${step.waitTime}m` : '0m'}
                  </td>
                  <td style={{ ...styles.td, color: '#87e8a0' }}>
                    {isFirst ? toHHMM(startTime) : toHHMM(step.departAt)}
                  </td>
                  <td style={{ ...styles.td, color: '#aaa' }}>
                    {nextStep !== undefined && step.travelTime > 0
                      ? `${step.travelTime}m`
                      : i === steps.length - 1
                      ? '-'
                      : `${step.travelTime}m`}
                  </td>
                  <td style={{ ...styles.td, color: '#c0c0e8' }}>
                    {i === 0 ? '0m' : `${step.cumulativeMin - startTime}m`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={styles.footerRow}>
              <td colSpan={7} style={{ ...styles.td, color: '#e8e8f0', fontWeight: 700 }}>
                Total journey time
              </td>
              <td style={{ ...styles.td, color: '#7ec8e3', fontWeight: 700, fontSize: 14 }}>
                {totalMin}m
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={styles.copyRow}>
        <button style={styles.copyBtn} onClick={handleCopySheets} title="Copy station names + arrival times as two rows for Google Sheets">
          Copy to Clipboard (Sheets)
        </button>
        <button style={styles.copyBtn} onClick={handleCopyTsv} title="Copy full timetable as TSV with all columns">
          Copy as TSV
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: 'monospace',
  },
  header: {
    fontWeight: 700,
    color: '#7ec8e3',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 6,
    padding: '0 12px 6px',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 11,
  },
  th: {
    padding: '5px 6px',
    textAlign: 'left' as const,
    color: '#666',
    borderBottom: '1px solid #333',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '4px 6px',
    color: '#aaa',
    borderBottom: '1px solid #1e1e3a',
    whiteSpace: 'nowrap' as const,
  },
  footerRow: {
    background: '#1e2a3a',
    borderTop: '2px solid #3a5f7a',
  },
  empty: {
    color: '#445',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 12,
    fontStyle: 'italic',
  },
  copyRow: {
    display: 'flex',
    gap: 6,
    padding: '0 0 4px',
    flexWrap: 'wrap' as const,
  },
  copyBtn: {
    padding: '4px 10px',
    background: '#1e2a3a',
    color: '#7ec8e3',
    border: '1px solid #3a5f7a',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  },
};
