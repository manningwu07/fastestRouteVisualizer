import React, { useState } from 'react';
import { useStore } from '../state/store.js';
import { Timetable } from './Timetable.js';

export function RouteComparison() {
  const { savedRoutes, deleteSavedRoute, stations } = useStore();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (savedRoutes.length === 0) {
    return (
      <div style={styles.empty}>
        No saved routes. Build a route and click "Save Route" to compare.
      </div>
    );
  }

  const fastestMin = Math.min(...savedRoutes.map(r => r.totalMin));

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>Saved Routes ({savedRoutes.length})</div>
      {savedRoutes.map((route, i) => {
        const isFastest = route.totalMin === fastestMin;
        const isExpanded = expandedIdx === i;
        const firstStation = route.steps[0]
          ? stations[route.steps[0].stationId]?.name ?? route.steps[0].stationId
          : '?';
        const lastStation = route.steps[route.steps.length - 1]
          ? stations[route.steps[route.steps.length - 1].stationId]?.name ??
            route.steps[route.steps.length - 1].stationId
          : '?';

        return (
          <div key={i} style={{ ...styles.routeCard, ...(isFastest ? styles.fastestCard : {}) }}>
            <div style={styles.routeCardHeader}>
              <div style={styles.routeInfo}>
                {isFastest && <span style={styles.fastestBadge}>FASTEST</span>}
                <span style={styles.routeName}>{route.name}</span>
                <span style={styles.routeMeta}>
                  {firstStation} → {lastStation}
                </span>
              </div>
              <div style={styles.routeStats}>
                <span style={{ color: isFastest ? '#7ec8e3' : '#aaa', fontWeight: isFastest ? 700 : 400 }}>
                  {route.totalMin}m
                </span>
                <span style={styles.stepCount}>{route.steps.length - 1} stops</span>
              </div>
              <div style={styles.routeActions}>
                <button
                  style={styles.expandBtn}
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  {isExpanded ? 'Hide' : 'Show'}
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={() => {
                    if (expandedIdx === i) setExpandedIdx(null);
                    deleteSavedRoute(i);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            {isExpanded && (
              <div style={styles.timetableWrapper}>
                <Timetable steps={route.steps} startTime={route.startTime} compact />
              </div>
            )}
          </div>
        );
      })}
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
    padding: '0 0 6px',
  },
  empty: {
    color: '#445',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 4,
    fontStyle: 'italic',
  },
  routeCard: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: 6,
    overflow: 'hidden',
  },
  fastestCard: {
    border: '1px solid #3a6a8a',
    boxShadow: '0 0 8px #3a6a8a44',
  },
  routeCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
  },
  routeInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  fastestBadge: {
    background: '#1e3a4a',
    color: '#7ec8e3',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    alignSelf: 'flex-start' as const,
  },
  routeName: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: 600,
  },
  routeMeta: {
    color: '#555',
    fontSize: 10,
  },
  routeStats: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    gap: 2,
    fontSize: 12,
  },
  stepCount: {
    color: '#445',
    fontSize: 10,
  },
  routeActions: {
    display: 'flex',
    gap: 4,
  },
  expandBtn: {
    padding: '3px 8px',
    background: '#2a2a4a',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  deleteBtn: {
    padding: '3px 8px',
    background: '#3a1a1a',
    color: '#e86060',
    border: '1px solid #553',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 1,
  },
  timetableWrapper: {
    borderTop: '1px solid #2a2a4a',
    padding: '8px 0',
  },
};
