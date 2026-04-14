import React, { useRef } from 'react';
import { useStore } from '../state/store.js';
import type { ToolMode } from '../state/store.js';
import { getKeybindings, formatBinding } from '../state/keybindings.js';

function getShortcut(id: string): string {
  const bindings = getKeybindings();
  const b = bindings.find(b => b.id === id);
  return b ? formatBinding(b) : '';
}

interface Props {
  onOpenShortcuts: () => void;
}

export function Toolbar({ onOpenShortcuts }: Props) {
  const {
    mode,
    selectedTool,
    setMode,
    setSelectedTool,
    saveToJSON,
    loadFromJSON,
    undoLastStep,
    clearRoute,
    saveCurrentRoute,
    currentRoute,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    const json = saveToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transit-graph.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text === 'string') loadFromJSON(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const builderTools: { id: ToolMode; label: string; shortcutId: string }[] = [
    { id: 'select', label: 'Select', shortcutId: 'tool_select' },
    { id: 'addStation', label: '+ Station', shortcutId: 'tool_add_station' },
    { id: 'addLine', label: '+ Line', shortcutId: 'tool_add_line' },
    { id: 'addRunEdge', label: '+ Run Edge', shortcutId: 'tool_add_run_edge' },
  ];

  function handleSaveRoute() {
    const name = prompt('Name this route:');
    if (name) saveCurrentRoute(name);
  }

  return (
    <div style={styles.toolbar}>
      <div style={styles.group}>
        <span style={styles.appTitle}>Transit Speedrun</span>
        <button
          title={`Builder mode [${getShortcut('mode_builder')}]`}
          style={{ ...styles.modeBtn, ...(mode === 'builder' ? styles.modeBtnActive : {}) }}
          onClick={() => setMode('builder')}
        >
          Builder
          <span style={styles.hint}>{getShortcut('mode_builder')}</span>
        </button>
        <button
          title={`Pathfinder mode [${getShortcut('mode_pathfinder')}]`}
          style={{ ...styles.modeBtn, ...(mode === 'pathfinder' ? styles.modeBtnActive : {}) }}
          onClick={() => setMode('pathfinder')}
        >
          Pathfinder
          <span style={styles.hint}>{getShortcut('mode_pathfinder')}</span>
        </button>
      </div>

      {mode === 'builder' && (
        <div style={styles.group}>
          {builderTools.map(t => (
            <button
              key={t.id}
              title={`${t.label} [${getShortcut(t.shortcutId)}]`}
              style={{ ...styles.toolBtn, ...(selectedTool === t.id ? styles.toolBtnActive : {}) }}
              onClick={() => setSelectedTool(t.id)}
            >
              {t.label}
              <span style={styles.hint}>{getShortcut(t.shortcutId)}</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'pathfinder' && (
        <div style={styles.group}>
          <button
            title={`Undo last step [${getShortcut('pf_undo')}]`}
            style={styles.toolBtn}
            onClick={undoLastStep}
            disabled={currentRoute.length === 0}
          >
            Undo Step
            <span style={styles.hint}>{getShortcut('pf_undo')}</span>
          </button>
          <button
            title={`Clear route [${getShortcut('pf_clear')}]`}
            style={{ ...styles.toolBtn, color: '#e86060' }}
            onClick={clearRoute}
            disabled={currentRoute.length === 0}
          >
            Clear Route
            <span style={styles.hint}>{getShortcut('pf_clear')}</span>
          </button>
          <button
            title={`Save route [${getShortcut('pf_save')}]`}
            style={{ ...styles.toolBtn, color: '#7ec8e3' }}
            onClick={handleSaveRoute}
            disabled={currentRoute.length < 2}
          >
            Save Route
            <span style={styles.hint}>{getShortcut('pf_save')}</span>
          </button>
        </div>
      )}

      {mode === 'builder' && (
        <div style={styles.group}>
          <button
            title={`Save graph [${getShortcut('save_graph')}]`}
            style={styles.actionBtn}
            onClick={handleSave}
          >
            Save Graph
            <span style={styles.hint}>{getShortcut('save_graph')}</span>
          </button>
          <button
            title={`Load graph [${getShortcut('load_graph')}]`}
            style={styles.actionBtn}
            onClick={handleLoadClick}
          >
            Load Graph
            <span style={styles.hint}>{getShortcut('load_graph')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      )}

      <div style={{ marginLeft: 'auto' }}>
        <button
          title={`Keyboard shortcuts [${getShortcut('toggle_shortcuts')}]`}
          style={styles.shortcutsBtn}
          onClick={onOpenShortcuts}
        >
          ⌨ Shortcuts
          <span style={styles.hint}>{getShortcut('toggle_shortcuts')}</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '8px 16px',
    background: '#1a1a2e',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  appTitle: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#7ec8e3',
    fontSize: 15,
    marginRight: 8,
  },
  hint: {
    display: 'block',
    fontSize: 9,
    color: '#667',
    fontFamily: 'monospace',
    lineHeight: 1,
    marginTop: 1,
  },
  modeBtn: {
    padding: '4px 12px',
    background: '#2a2a4a',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  modeBtnActive: {
    background: '#3a5f8a',
    color: '#fff',
    borderColor: '#7ec8e3',
  },
  toolBtn: {
    padding: '4px 10px',
    background: '#2a2a3a',
    color: '#bbb',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  toolBtnActive: {
    background: '#4a6741',
    color: '#c8e8c3',
    borderColor: '#7ec878',
  },
  actionBtn: {
    padding: '4px 10px',
    background: '#3a2a2a',
    color: '#e8c3a0',
    border: '1px solid #554433',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  shortcutsBtn: {
    padding: '4px 10px',
    background: '#2a2a3a',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};
