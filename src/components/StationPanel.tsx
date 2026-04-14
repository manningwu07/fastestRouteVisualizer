import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';

export function StationPanel() {
  const { stations, selectedStationIds, updateStation, removeStation, setSelectedStationIds } =
    useStore();

  const stationId = selectedStationIds[0];
  const station = stationId ? stations[stationId] : null;

  const [name, setName] = useState('');
  const [agencies, setAgencies] = useState<string[]>([]);
  const [agencyInput, setAgencyInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect all agency names used across all stations for autocomplete
  const allAgencies = Array.from(
    new Set(
      Object.values(stations).flatMap(s => s.agencies ?? [])
    )
  ).filter(Boolean);

  const filteredSuggestions = agencyInput.trim()
    ? allAgencies.filter(
        a =>
          a.toLowerCase().includes(agencyInput.toLowerCase()) &&
          !agencies.includes(a)
      )
    : allAgencies.filter(a => !agencies.includes(a));

  useEffect(() => {
    if (station) {
      setName(station.name);
      setAgencies(station.agencies ?? []);
      setAgencyInput('');
    }
  }, [stationId]);

  function addAgency(value: string) {
    const trimmed = value.trim();
    if (!trimmed || agencies.includes(trimmed)) {
      setAgencyInput('');
      setShowSuggestions(false);
      return;
    }
    const next = [...agencies, trimmed];
    setAgencies(next);
    setAgencyInput('');
    setShowSuggestions(false);
    if (station) updateStation(station.id, { agencies: next });
  }

  function removeAgency(a: string) {
    const next = agencies.filter(x => x !== a);
    setAgencies(next);
    if (station) updateStation(station.id, { agencies: next });
  }

  function handleAgencyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAgency(agencyInput);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && agencyInput === '' && agencies.length > 0) {
      removeAgency(agencies[agencies.length - 1]);
    }
  }

  if (!station) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Station</div>
        <div style={styles.hint}>Select a station to edit it.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Station</div>

      <label style={styles.label}>Name</label>
      <input
        style={styles.input}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => updateStation(station.id, { name })}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />

      <label style={styles.label}>Agencies</label>
      <div style={styles.tagBox}>
        {agencies.map(a => (
          <span key={a} style={styles.tag}>
            {a}
            <button
              style={styles.tagRemove}
              onClick={() => removeAgency(a)}
              title={`Remove ${a}`}
            >
              ×
            </button>
          </span>
        ))}
        <div style={{ position: 'relative', flex: 1, minWidth: 80 }}>
          <input
            ref={inputRef}
            style={styles.tagInput}
            value={agencyInput}
            onChange={e => {
              setAgencyInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowSuggestions(false);
                if (agencyInput.trim()) addAgency(agencyInput);
              }, 120);
            }}
            onKeyDown={handleAgencyKeyDown}
            placeholder={agencies.length === 0 ? 'Type agency, press Enter…' : '+ add'}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div style={styles.suggestions}>
              {filteredSuggestions.map(s => (
                <div
                  key={s}
                  style={styles.suggestion}
                  onMouseDown={e => {
                    e.preventDefault();
                    addAgency(s);
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={styles.tagHint}>Press Enter or comma to add. Backspace to remove last.</div>

      <div style={styles.coords}>
        <span style={styles.coordLabel}>x: {Math.round(station.x)}</span>
        <span style={styles.coordLabel}>y: {Math.round(station.y)}</span>
      </div>

      <button
        style={styles.deleteBtn}
        tabIndex={-1}
        onClick={() => {
          removeStation(station.id);
          setSelectedStationIds([]);
        }}
      >
        Delete Station
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#7ec8e3',
    fontSize: 14,
    borderBottom: '1px solid #333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  hint: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888',
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
  },
  tagBox: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    padding: '4px 6px',
    minHeight: 32,
    alignItems: 'center',
    cursor: 'text',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: '#2a3a5a',
    color: '#7ec8e3',
    borderRadius: 3,
    padding: '1px 6px',
    fontFamily: 'monospace',
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: '#7ec8e3',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
    lineHeight: 1,
    opacity: 0.7,
  },
  tagInput: {
    background: 'transparent',
    border: 'none',
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    padding: '2px 0',
  },
  tagHint: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555',
    marginTop: -2,
  },
  suggestions: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    background: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: 3,
    zIndex: 100,
    maxHeight: 120,
    overflowY: 'auto' as const,
  },
  suggestion: {
    padding: '4px 8px',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8c8e0',
    cursor: 'pointer',
  },
  coords: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  coordLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555',
  },
  deleteBtn: {
    marginTop: 8,
    padding: '5px 12px',
    background: '#3a1a1a',
    color: '#e8a0a0',
    border: '1px solid #6a3030',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    alignSelf: 'flex-start',
  },
};
