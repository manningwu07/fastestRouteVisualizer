import React, { useState, useEffect, useCallback } from 'react';
import {
  getKeybindings,
  setKeybinding,
  resetKeybinding,
  resetAllKeybindings,
  formatBinding,
  type KeyBinding,
} from '../state/keybindings.js';

interface Props {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  builder: 'Builder',
  pathfinder: 'Pathfinder',
};

export function KeyboardShortcutsPanel({ onClose }: Props) {
  const [bindings, setBindings] = useState<KeyBinding[]>(() => getKeybindings());
  const [rebindingId, setRebindingId] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    newKey: string;
    newMods: string[];
    conflictWith: KeyBinding;
    targetId: string;
  } | null>(null);

  const refresh = useCallback(() => setBindings(getKeybindings()), []);

  // Close on Escape (unless rebinding)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (rebindingId !== null) {
        e.preventDefault();
        e.stopPropagation();

        const key = e.key;
        const modifiers: string[] = [];
        if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');

        // Ignore bare modifier presses
        if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) return;

        if (key === 'Escape') {
          setRebindingId(null);
          return;
        }

        // Check for conflict
        const currentBindings = getKeybindings();
        const conflict = currentBindings.find(b => {
          if (b.id === rebindingId) return false;
          const modsMatch =
            b.defaultModifiers.length === modifiers.length &&
            b.defaultModifiers.every(m => modifiers.includes(m));
          const keyMatch = b.defaultKey === key || b.defaultKey.toLowerCase() === key.toLowerCase();
          return keyMatch && modsMatch;
        });

        if (conflict) {
          setConflictInfo({ newKey: key, newMods: modifiers, conflictWith: conflict, targetId: rebindingId });
          setRebindingId(null);
        } else {
          setKeybinding(rebindingId, key, modifiers);
          setRebindingId(null);
          refresh();
        }
        return;
      }

      if (key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [rebindingId, onClose, refresh]);

  function confirmConflict() {
    if (!conflictInfo) return;
    setKeybinding(conflictInfo.targetId, conflictInfo.newKey, conflictInfo.newMods);
    resetKeybinding(conflictInfo.conflictWith.id);
    setConflictInfo(null);
    refresh();
  }

  function handleReset(id: string) {
    resetKeybinding(id);
    refresh();
  }

  function handleResetAll() {
    if (confirm('Reset all keybindings to defaults?')) {
      resetAllKeybindings();
      refresh();
    }
  }

  const categories = ['general', 'builder', 'pathfinder'] as const;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <span style={title}>Keyboard Shortcuts</span>
          <button style={closeBtn} onClick={onClose}>×</button>
        </div>

        {conflictInfo && (
          <div style={conflictBanner}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#f0c060' }}>Conflict: </span>
              <span style={{ color: '#e8e8f0' }}>
                "{formatKeyCombo(conflictInfo.newKey, conflictInfo.newMods)}" is already used by{' '}
                <strong>{conflictInfo.conflictWith.label}</strong>.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnPrimary} onClick={confirmConflict}>
                Override (remove old binding)
              </button>
              <button style={btnSecondary} onClick={() => setConflictInfo(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={body}>
          {categories.map(cat => {
            const catBindings = bindings.filter(b => b.category === cat);
            if (catBindings.length === 0) return null;
            return (
              <div key={cat} style={section}>
                <div style={catHeader}>{CATEGORY_LABELS[cat]}</div>
                <table style={table}>
                  <tbody>
                    {catBindings.map(b => (
                      <tr key={b.id} style={tableRow}>
                        <td style={tdLabel}>{b.label}</td>
                        <td style={tdKey}>
                          {rebindingId === b.id ? (
                            <span style={listeningBadge}>Press key...</span>
                          ) : (
                            <kbd style={kbdStyle}>{formatBinding(b)}</kbd>
                          )}
                        </td>
                        <td style={tdActions}>
                          <button
                            style={rebindingId === b.id ? btnCancelRebind : btnRebind}
                            onClick={() => setRebindingId(rebindingId === b.id ? null : b.id)}
                          >
                            {rebindingId === b.id ? 'Cancel' : 'Rebind'}
                          </button>
                          <button style={btnReset} onClick={() => handleReset(b.id)}>
                            ↩
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div style={footer}>
          <button style={resetAllBtn} onClick={handleResetAll}>
            Reset All to Defaults
          </button>
          <button style={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatKeyCombo(key: string, mods: string[]): string {
  const parts: string[] = [];
  if (mods.includes('ctrl')) parts.push('Ctrl');
  if (mods.includes('shift')) parts.push('Shift');
  if (mods.includes('alt')) parts.push('Alt');
  parts.push(key);
  return parts.join('+');
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const panel: React.CSSProperties = {
  background: '#12122a',
  border: '1px solid #333',
  borderRadius: 8,
  width: 560,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'monospace',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #222',
  flexShrink: 0,
};

const title: React.CSSProperties = {
  fontWeight: 700,
  color: '#7ec8e3',
  fontSize: 15,
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: 20,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const body: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 16px',
};

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderTop: '1px solid #222',
  flexShrink: 0,
};

const section: React.CSSProperties = {
  marginBottom: 16,
};

const catHeader: React.CSSProperties = {
  fontSize: 11,
  color: '#7ec8e3',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  marginTop: 8,
};

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const tableRow: React.CSSProperties = {
  borderBottom: '1px solid #1a1a2e',
};

const tdLabel: React.CSSProperties = {
  padding: '5px 4px',
  color: '#ccc',
  fontSize: 12,
  width: '50%',
};

const tdKey: React.CSSProperties = {
  padding: '5px 4px',
  width: '25%',
};

const tdActions: React.CSSProperties = {
  padding: '5px 4px',
  display: 'flex',
  gap: 4,
  justifyContent: 'flex-end',
};

const kbdStyle: React.CSSProperties = {
  background: '#1e1e3a',
  border: '1px solid #444',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 11,
  color: '#e8e8f0',
};

const listeningBadge: React.CSSProperties = {
  background: '#2a4a2a',
  border: '1px solid #5a8a5a',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 11,
  color: '#88e888',
  animation: 'pulse 1s infinite',
};

const conflictBanner: React.CSSProperties = {
  margin: '8px 16px',
  padding: '10px 12px',
  background: '#2a1a0a',
  border: '1px solid #a06020',
  borderRadius: 4,
  fontSize: 12,
  color: '#e8c080',
};

const btnRebind: React.CSSProperties = {
  padding: '2px 8px',
  background: '#1e2e4e',
  color: '#7ec8e3',
  border: '1px solid #3a5a7a',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
};

const btnCancelRebind: React.CSSProperties = {
  padding: '2px 8px',
  background: '#2a1a1a',
  color: '#e86060',
  border: '1px solid #6a3a3a',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
};

const btnReset: React.CSSProperties = {
  padding: '2px 6px',
  background: '#1e1e2e',
  color: '#888',
  border: '1px solid #333',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '5px 12px',
  background: '#2a4a6a',
  color: '#7ec8e3',
  border: '1px solid #3a7a9a',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
};

const btnSecondary: React.CSSProperties = {
  padding: '5px 12px',
  background: '#2a2a3a',
  color: '#aaa',
  border: '1px solid #445',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
};

const resetAllBtn: React.CSSProperties = {
  padding: '5px 12px',
  background: '#3a1a1a',
  color: '#e8a0a0',
  border: '1px solid #6a3030',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
};
