import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from './state/store.js';
import { Toolbar } from './components/Toolbar.js';
import { GraphCanvas } from './components/GraphCanvas.js';
import { LineCreator } from './components/LineCreator.js';
import { RunEdgeCreator } from './components/RunEdgeCreator.js';
import { TransferTable } from './components/TransferTable.js';
import { StationPanel } from './components/StationPanel.js';
import { LineEditor } from './components/LineEditor.js';
import { RunEdgeEditor } from './components/RunEdgeEditor.js';
import { PathfinderPanel } from './components/PathfinderPanel.js';
import { Timetable } from './components/Timetable.js';
import { RouteComparison } from './components/RouteComparison.js';
import { GraphSidebar } from './components/GraphSidebar.js';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel.js';
import { Toast } from './components/Toast.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import './styles.css';

// Resizable right sidebar hook
function useResizableSidebar(
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
  side: 'left' | 'right'
) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(defaultWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const newWidth = side === 'right'
        ? dragStartWidth.current - delta
        : dragStartWidth.current + delta;
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, side]);

  return { width, isDragging, handleMouseDown };
}

function BuilderSidePanel({ width }: { width: number }) {
  const { selectedTool, transfers, selectedLineId, selectedRunEdgeId } = useStore();

  // Priority: LineEditor / RunEdgeEditor > tool-specific panel > StationPanel
  const showLineEditor = selectedLineId !== null;
  const showRunEdgeEditor = selectedRunEdgeId !== null && !showLineEditor;

  return (
    <div style={{ ...sidePanelStyle, width }}>
      {showLineEditor ? (
        <LineEditor />
      ) : showRunEdgeEditor ? (
        <RunEdgeEditor />
      ) : (
        <>
          {selectedTool === 'addLine' && <LineCreator />}
          {selectedTool === 'addRunEdge' && <RunEdgeCreator />}
          {selectedTool === 'select' && <StationPanel />}
          {selectedTool === 'addStation' && (
            <div style={{ padding: 12 }}>
              <div style={sectionHeader}>Add Station</div>
              <div style={hintStyle}>Click anywhere on the canvas to place a new station.</div>
            </div>
          )}
        </>
      )}
      {transfers.length > 0 && (
        <div style={{ borderTop: '1px solid #222', marginTop: 8 }}>
          <TransferTable />
        </div>
      )}
    </div>
  );
}

function PathfinderSidePanel({ width }: { width: number }) {
  return (
    <div style={{ ...pathfinderPanelStyle, width }}>
      <PathfinderPanel />
      <div style={{ borderTop: '1px solid #222', marginTop: 4, paddingTop: 8 }}>
        <Timetable />
      </div>
      <div style={{ borderTop: '1px solid #222', marginTop: 8, padding: '8px 12px' }}>
        <RouteComparison />
      </div>
    </div>
  );
}

function App() {
  const { mode, loadGraphsFromStorage } = useStore();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load graphs from localStorage on mount
  useEffect(() => {
    loadGraphsFromStorage();
  }, []);

  const rightSidebar = useResizableSidebar(
    mode === 'pathfinder' ? 340 : 260,
    150,
    500,
    'right'
  );

  const handleLoadGraph = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        const { importGraph } = useStore.getState();
        importGraph(text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  useKeyboardShortcuts({
    onToggleShortcuts: () => setShortcutsOpen(v => !v),
    onLoadGraph: handleLoadGraph,
  });

  return (
    <div style={appStyle}>
      <Toolbar onOpenShortcuts={() => setShortcutsOpen(v => !v)} />
      <div style={mainStyle}>
        <GraphSidebar />
        <GraphCanvas />
        {/* Drag handle on the left edge of right sidebar */}
        <div
          className={`resize-handle${rightSidebar.isDragging ? ' dragging' : ''}`}
          onMouseDown={rightSidebar.handleMouseDown}
          style={{ borderLeft: '1px solid #1a1a35' }}
        />
        {mode === 'builder'
          ? <BuilderSidePanel width={rightSidebar.width} />
          : <PathfinderSidePanel width={rightSidebar.width} />
        }
      </div>
      {/* Hidden file input for keyboard-triggered import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {shortcutsOpen && (
        <KeyboardShortcutsPanel onClose={() => setShortcutsOpen(false)} />
      )}
      <Toast />
    </div>
  );
}

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  background: '#0d0d1a',
  color: '#e8e8f0',
};

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const sidePanelStyle: React.CSSProperties = {
  flexShrink: 0,
  background: '#12122a',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const pathfinderPanelStyle: React.CSSProperties = {
  flexShrink: 0,
  background: '#12122a',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const sectionHeader: React.CSSProperties = {
  fontFamily: 'monospace',
  fontWeight: 700,
  color: '#7ec8e3',
  fontSize: 15,
  borderBottom: '1px solid #333',
  paddingBottom: 6,
  marginBottom: 4,
};

const hintStyle: React.CSSProperties = {
  color: '#555',
  fontFamily: 'monospace',
  fontSize: 13,
  lineHeight: 1.6,
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
