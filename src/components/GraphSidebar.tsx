import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store.js';
import type { SavedGraph } from '../state/store.js';

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

interface GraphRowProps {
  graph: SavedGraph;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function GraphRow({ graph, isActive, canDelete, onSelect, onRename, onDelete }: GraphRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(graph.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function startEdit() {
    setEditName(graph.name);
    setIsEditing(true);
  }

  function commitEdit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== graph.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditName(graph.name);
      setIsEditing(false);
    }
  }

  const stationCount = Object.keys(graph.data.stations).length;
  const lineCount = Object.keys(graph.data.lines).length;

  if (confirmDelete) {
    return (
      <div style={{ ...rowStyle, background: '#1a0f0f', borderLeft: '2px solid #a04040' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#e8a0a0', marginBottom: 6 }}>
          Delete "{graph.name}"?
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={confirmDeleteBtnStyle}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            Delete
          </button>
          <button
            style={cancelBtnStyle}
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...rowStyle,
        background: isActive ? '#1a2a3a' : 'transparent',
        borderLeft: isActive ? '2px solid #7ec8e3' : '2px solid transparent',
      }}
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            style={editInputStyle}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 13,
              color: isActive ? '#e8e8f0' : '#bbb',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {graph.name}
            </span>
            <button
              style={pencilBtnStyle}
              title="Rename graph"
              onClick={(e) => { e.stopPropagation(); startEdit(); }}
            >
              ✎
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
          <span style={badgeStyle}>{stationCount} stn</span>
          <span style={badgeStyle}>{lineCount} line{lineCount !== 1 ? 's' : ''}</span>
          <span style={timestampStyle}>{formatTimestamp(graph.lastModified)}</span>
        </div>
      </div>

      {canDelete && (
        <button
          style={deleteBtnStyle}
          title="Delete graph"
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function GraphSidebar() {
  const {
    savedGraphs,
    activeGraphId,
    stations,
    lines,
    createNewGraph,
    switchGraph,
    renameGraph,
    deleteGraph,
  } = useStore();

  const [collapsed, setCollapsed] = useState(false);
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

  // Build display graphs: for the active graph, show live station/line counts
  const displayGraphs = savedGraphs.map(g => {
    if (g.id === activeGraphId) {
      return {
        ...g,
        data: {
          ...g.data,
          stations,
          lines,
        },
      };
    }
    return g;
  });

  if (collapsed) {
    return (
      <div style={{ ...containerStyle, width: 28 }}>
        <button
          title="Expand graphs"
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
        <div style={headerStyle}>
          <span style={headerTitle}>Graphs</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              style={newBtnStyle}
              title="New graph"
              onClick={() => createNewGraph()}
            >
              + New
            </button>
            <button
              title="Collapse"
              style={collapseBtn}
              onClick={() => setCollapsed(true)}
            >
              ◀
            </button>
          </div>
        </div>

        <div style={listContainer}>
          {displayGraphs.map(graph => (
            <GraphRow
              key={graph.id}
              graph={graph}
              isActive={graph.id === activeGraphId}
              canDelete={savedGraphs.length > 1}
              onSelect={() => switchGraph(graph.id)}
              onRename={(name) => renameGraph(graph.id, name)}
              onDelete={() => deleteGraph(graph.id)}
            />
          ))}
        </div>

        <div style={footerStyle}>
          {savedGraphs.length} graph{savedGraphs.length !== 1 ? 's' : ''}
        </div>
      </div>
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

const newBtnStyle: React.CSSProperties = {
  background: '#1a3a2a',
  border: '1px solid #3a6a4a',
  color: '#7ec8a8',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '2px 7px',
  lineHeight: 1.4,
};

const listContainer: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '7px 8px',
  cursor: 'pointer',
  gap: 4,
  transition: 'background 0.1s',
  borderBottom: '1px solid #1a1a28',
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  background: '#1e2e4e',
  color: '#7ec8e3',
  borderRadius: 8,
  padding: '0 5px',
  fontFamily: 'monospace',
};

const timestampStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#445',
  fontFamily: 'monospace',
  marginLeft: 'auto',
};

const pencilBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#556',
  cursor: 'pointer',
  fontSize: 13,
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#664444',
  cursor: 'pointer',
  fontSize: 16,
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
  alignSelf: 'center',
};

const editInputStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #7ec8e3',
  borderRadius: 3,
  color: '#e8e8f0',
  fontFamily: 'monospace',
  fontSize: 12,
  padding: '2px 6px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const confirmDeleteBtnStyle: React.CSSProperties = {
  padding: '3px 9px',
  background: '#5a1a1a',
  color: '#e8a0a0',
  border: '1px solid #8a3030',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '3px 9px',
  background: '#2a2a3a',
  color: '#aaa',
  border: '1px solid #444',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

const footerStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderTop: '1px solid #1a1a30',
  fontSize: 12,
  color: '#445',
  fontFamily: 'monospace',
  flexShrink: 0,
};
