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
  const [topPaneHeight, setTopPaneHeight] = useState(520);
  const [isTransferDividerDragging, setIsTransferDividerDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartTopHeight = useRef(520);
  const transferSplitInitializedRef = useRef(false);

  // Priority: LineEditor / RunEdgeEditor > tool-specific panel > StationPanel
  const showLineEditor = selectedLineId !== null;
  const showRunEdgeEditor = selectedRunEdgeId !== null && !showLineEditor;

  const clampTopHeight = useCallback((panelHeight: number, desiredTop: number) => {
    const dividerHeight = 10;
    const minTop = 0;
    const maxTop = Math.max(minTop, panelHeight - dividerHeight);
    return Math.max(minTop, Math.min(maxTop, desiredTop));
  }, []);

  useEffect(() => {
    const panelHeight = panelRef.current?.clientHeight ?? 0;
    if (panelHeight <= 0) return;

    if (transfers.length === 0) {
      transferSplitInitializedRef.current = false;
      return;
    }

    setTopPaneHeight(prev => {
      const desiredInitial = panelHeight - 320;
      const target = transferSplitInitializedRef.current ? prev : desiredInitial;
      return clampTopHeight(panelHeight, target);
    });

    transferSplitInitializedRef.current = true;
  }, [transfers.length, clampTopHeight]);

  useEffect(() => {
    const onWindowResize = () => {
      const panelHeight = panelRef.current?.clientHeight ?? 0;
      if (panelHeight <= 0 || transfers.length === 0) return;
      setTopPaneHeight(prev => clampTopHeight(panelHeight, prev));
    };

    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [transfers.length, clampTopHeight]);

  const handleTransferDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartTopHeight.current = topPaneHeight;
    setIsTransferDividerDragging(true);
  }, [topPaneHeight]);

  useEffect(() => {
    if (!isTransferDividerDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const panelHeight = panelRef.current?.clientHeight ?? 0;
      const nextTop = dragStartTopHeight.current + (e.clientY - dragStartY.current);
      setTopPaneHeight(clampTopHeight(panelHeight, nextTop));
    };

    const onMouseUp = () => setIsTransferDividerDragging(false);

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isTransferDividerDragging, clampTopHeight]);

  return (
    <div ref={panelRef} style={{ ...sidePanelStyle, width, overflowY: 'hidden' }}>
      <div
        style={{
          flexShrink: 0,
          height: transfers.length > 0 ? topPaneHeight : '100%',
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
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
      </div>
      {transfers.length > 0 && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            title="Drag to resize transfer table"
            onMouseDown={handleTransferDividerMouseDown}
            style={{
              height: 10,
              borderTop: '1px solid #222',
              borderBottom: '1px solid #1a1a35',
              cursor: 'row-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isTransferDividerDragging ? '#171737' : '#101026',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 46,
                height: 3,
                borderRadius: 2,
                background: isTransferDividerDragging ? '#7ec8e3' : '#40406b',
              }}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
            <TransferTable />
          </div>
        </>
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
