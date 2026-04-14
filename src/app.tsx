import React, { useState, useRef, useCallback } from 'react';
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
import { StationList } from './components/StationList.js';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import './styles.css';

function BuilderSidePanel() {
  const { selectedTool, transfers, selectedLineId, selectedRunEdgeId } = useStore();

  // Priority: LineEditor / RunEdgeEditor > tool-specific panel > StationPanel
  const showLineEditor = selectedLineId !== null;
  const showRunEdgeEditor = selectedRunEdgeId !== null && !showLineEditor;

  return (
    <div style={sidePanelStyle}>
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

function PathfinderSidePanel() {
  return (
    <div style={pathfinderPanelStyle}>
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
  const { mode, saveToJSON, loadFromJSON } = useStore();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveGraph = useCallback(() => {
    const json = saveToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transit-graph.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [saveToJSON]);

  const handleLoadGraph = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text === 'string') loadFromJSON(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadFromJSON]);

  useKeyboardShortcuts({
    onToggleShortcuts: () => setShortcutsOpen(v => !v),
    onSaveGraph: handleSaveGraph,
    onLoadGraph: handleLoadGraph,
  });

  return (
    <div style={appStyle}>
      <Toolbar onOpenShortcuts={() => setShortcutsOpen(v => !v)} />
      <div style={mainStyle}>
        <StationList />
        <GraphCanvas />
        {mode === 'builder' ? <BuilderSidePanel /> : <PathfinderSidePanel />}
      </div>
      {/* Hidden file input for keyboard-triggered load */}
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
  width: 260,
  flexShrink: 0,
  background: '#12122a',
  borderLeft: '1px solid #222',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const pathfinderPanelStyle: React.CSSProperties = {
  width: 340,
  flexShrink: 0,
  background: '#12122a',
  borderLeft: '1px solid #222',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const sectionHeader: React.CSSProperties = {
  fontFamily: 'monospace',
  fontWeight: 700,
  color: '#7ec8e3',
  fontSize: 14,
  borderBottom: '1px solid #333',
  paddingBottom: 6,
  marginBottom: 4,
};

const hintStyle: React.CSSProperties = {
  color: '#555',
  fontFamily: 'monospace',
  fontSize: 11,
  lineHeight: 1.6,
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
