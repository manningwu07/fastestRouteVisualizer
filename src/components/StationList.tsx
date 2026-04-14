import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';


export function StationList() {
  const {
    mode,
    stations,
    lines,
    selectedStationIds,
    tabFocusedStationId,
    currentRoute,
    setSelectedStationIds,
    setSelectedLineId,
    setSelectedRunEdgeId,
    setSelectedTool,
    addPathfinderWaypoint,
  } = useStore();

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  // Resizable width
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(200);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    setIsDragging(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const newWidth = dragStartWidth.current + delta;
      setSidebarWidth(Math.max(150, Math.min(500, newWidth)));
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // Build visited set for pathfinder mode
  const visitedIds = useMemo(() => {
    const set = new Set<string>();
    currentRoute.forEach(step => set.add(step.stationId));
    return set;
  }, [currentRoute]);

  // Count lines through each station
  const lineCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of Object.values(lines)) {
      for (const stopId of line.stops) {
        counts[stopId] = (counts[stopId] ?? 0) + 1;
      }
    }
    return counts;
  }, [lines]);

  const stationList = useMemo(() => {
    return Object.values(stations).filter(st => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        st.name.toLowerCase().includes(q) ||
        (st.agency ?? '').toLowerCase().includes(q)
      );
    });
  }, [stations, search]);

  // Group by agency
  const grouped = useMemo(() => {
    const groups: Record<string, typeof stationList> = {};
    for (const st of stationList) {
      const key = st.agency ?? 'No Agency';
      if (!groups[key]) groups[key] = [];
      groups[key].push(st);
    }
    return groups;
  }, [stationList]);

  const sortedGroups = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      if (a === 'No Agency') return 1;
      if (b === 'No Agency') return -1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  function handleStationClick(stationId: string) {
    if (mode === 'builder') {
      setSelectedStationIds([stationId]);
      setSelectedLineId(null);
      setSelectedRunEdgeId(null);
      setSelectedTool('select');
    } else if (mode === 'pathfinder') {
      addPathfinderWaypoint(stationId);
    }
  }

  function handleStationDoubleClick(stationId: string) {
    if (mode === 'builder') {
      setSelectedStationIds([stationId]);
      setSelectedLineId(null);
      setSelectedRunEdgeId(null);
      setSelectedTool('select');
    }
  }

  if (collapsed) {
    return (
      <div style={{ ...containerStyle, width: 28 }}>
        <button
          title="Expand station list"
          style={collapseBtn}
          onClick={() => setCollapsed(false)}
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ ...containerStyle, width: sidebarWidth }}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={headerTitle}>Stations</span>
          <button
            title="Collapse"
            style={collapseBtn}
            onClick={() => setCollapsed(true)}
          >
            ◀
          </button>
        </div>

        {/* Search */}
        <div style={searchContainer}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>

        {/* List */}
        <div style={listContainer}>
          {stationList.length === 0 && (
            <div style={emptyHint}>
              {Object.keys(stations).length === 0
                ? 'No stations yet'
                : 'No matches'}
            </div>
          )}

          {sortedGroups.map(agency => (
            <div key={agency}>
              <div style={agencyHeader}>{agency}</div>
              {grouped[agency].map(st => {
                const isSelected = selectedStationIds.includes(st.id);
                const isTabFocused = tabFocusedStationId === st.id;
                const isVisited = mode === 'pathfinder' && visitedIds.has(st.id);
                const lc = lineCount[st.id] ?? 0;

                return (
                  <div
                    key={st.id}
                    title={`${st.name}${st.agency ? ` (${st.agency})` : ''} — ${lc} line${lc !== 1 ? 's' : ''}`}
                    style={{
                      ...stationRow,
                      background: isTabFocused
                        ? '#1e3a4a'
                        : isSelected
                        ? '#1a2a4a'
                        : 'transparent',
                      borderLeft: isTabFocused
                        ? '2px solid #7ec8e3'
                        : isSelected
                        ? '2px solid #4a7aaa'
                        : '2px solid transparent',
                      opacity: mode === 'pathfinder' && !isVisited && currentRoute.length > 0 ? 0.5 : 1,
                    }}
                    onClick={() => handleStationClick(st.id)}
                    onDoubleClick={() => handleStationDoubleClick(st.id)}
                  >
                    <span style={{
                      ...stationName,
                      color: isSelected || isTabFocused ? '#e8e8f0' : '#bbb',
                    }}>
                      {st.name}
                    </span>
                    <div style={badgeRow}>
                      {isVisited && mode === 'pathfinder' && (
                        <span style={visitedBadge}>✓</span>
                      )}
                      {lc > 0 && (
                        <span style={lineBadge}>{lc}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Station count */}
        <div style={footer}>
          {Object.keys(stations).length} station{Object.keys(stations).length !== 1 ? 's' : ''}
        </div>
      </div>
      {/* Drag handle on the right edge */}
      <div
        className={`resize-handle${isDragging ? ' dragging' : ''}`}
        onMouseDown={handleResizeMouseDown}
        style={{ borderRight: '1px solid #1a1a35' }}
      />
    </>
  );
}

const containerStyle: React.CSSProperties = {
  flexShrink: 0,
  background: '#0f0f20',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 8px 6px',
  borderBottom: '1px solid #1a1a30',
  flexShrink: 0,
};

const headerTitle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontWeight: 700,
  color: '#7ec8e3',
  fontSize: 14,
};

const collapseBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 13,
  padding: '2px 4px',
  lineHeight: 1,
};

const searchContainer: React.CSSProperties = {
  padding: '6px 6px 4px',
  flexShrink: 0,
};

const searchInput: React.CSSProperties = {
  width: '100%',
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
  borderRadius: 3,
  color: '#e8e8f0',
  fontFamily: 'monospace',
  fontSize: 13,
  padding: '4px 7px',
  outline: 'none',
  boxSizing: 'border-box',
};

const listContainer: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const agencyHeader: React.CSSProperties = {
  padding: '4px 8px 2px',
  fontSize: 10,
  color: '#556',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontFamily: 'monospace',
};

const stationRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '5px 8px',
  cursor: 'pointer',
  borderRadius: 0,
  gap: 4,
  transition: 'background 0.1s',
};

const stationName: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const badgeRow: React.CSSProperties = {
  display: 'flex',
  gap: 3,
  alignItems: 'center',
  flexShrink: 0,
};

const visitedBadge: React.CSSProperties = {
  fontSize: 11,
  color: '#5ec870',
};

const lineBadge: React.CSSProperties = {
  fontSize: 11,
  background: '#1e2e4e',
  color: '#7ec8e3',
  borderRadius: 8,
  padding: '0 4px',
  minWidth: 16,
  textAlign: 'center',
  fontFamily: 'monospace',
};

const emptyHint: React.CSSProperties = {
  padding: '12px 8px',
  color: '#445',
  fontFamily: 'monospace',
  fontSize: 13,
  fontStyle: 'italic',
};

const footer: React.CSSProperties = {
  padding: '5px 8px',
  borderTop: '1px solid #1a1a30',
  fontSize: 12,
  color: '#445',
  fontFamily: 'monospace',
  flexShrink: 0,
};
