import React, { useState, useEffect } from 'react';

export const PRESET_COLORS = [
  { hex: '#7986CB', name: 'Lavender' },
  { hex: '#33B679', name: 'Sage' },
  { hex: '#8E24AA', name: 'Grape' },
  { hex: '#E67C73', name: 'Flamingo' },
  { hex: '#F6BF26', name: 'Banana' },
  { hex: '#F4511E', name: 'Tangerine' },
  { hex: '#039BE5', name: 'Peacock' },
  { hex: '#616161', name: 'Graphite' },
  { hex: '#3F51B5', name: 'Blueberry' },
  { hex: '#0B8043', name: 'Basil' },
  { hex: '#D50000', name: 'Tomato' },
  { hex: '#795548', name: 'Cocoa' },
];

const CUSTOM_COLORS_KEY = 'transit-speedrun-custom-colors';

function loadCustomColors(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCustomColors(colors: string[]) {
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);

  useEffect(() => { saveCustomColors(customColors); }, [customColors]);

  const isPreset = PRESET_COLORS.some(c => c.hex.toLowerCase() === value.toLowerCase());
  const isCustomSaved = customColors.some(c => c.toLowerCase() === value.toLowerCase());

  function addCustomColor(hex: string) {
    const norm = hex.toLowerCase();
    if (PRESET_COLORS.some(c => c.hex.toLowerCase() === norm)) return;
    if (customColors.some(c => c.toLowerCase() === norm)) return;
    setCustomColors(prev => [...prev, hex]);
  }

  function removeCustomColor(hex: string) {
    setCustomColors(prev => prev.filter(c => c.toLowerCase() !== hex.toLowerCase()));
  }

  return (
    <div style={styles.wrapper}>
      {/* Preset grid */}
      <div style={styles.grid}>
        {PRESET_COLORS.map(({ hex, name }) => {
          const isSelected = hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={hex}
              title={name}
              onClick={() => onChange(hex)}
              style={{
                ...styles.swatch,
                background: hex,
                outline: isSelected ? `3px solid #fff` : `2px solid transparent`,
                outlineOffset: isSelected ? 1 : 2,
              }}
            >
              {isSelected && <span style={styles.check}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Saved custom colors */}
      {customColors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Custom</div>
          <div style={styles.grid}>
            {customColors.map(hex => {
              const isSelected = hex.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={hex}
                  title={`${hex} (right-click to remove)`}
                  onClick={() => onChange(hex)}
                  onContextMenu={e => { e.preventDefault(); removeCustomColor(hex); }}
                  style={{
                    ...styles.swatch,
                    background: hex,
                    outline: isSelected ? `3px solid #fff` : `2px solid transparent`,
                    outlineOffset: isSelected ? 1 : 2,
                  }}
                >
                  {isSelected && <span style={styles.check}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom color picker */}
      <div style={styles.customRow}>
        <button
          style={styles.customToggle}
          onClick={() => setShowCustom(v => !v)}
        >
          {showCustom ? 'Hide custom' : 'Custom…'}
        </button>
        {!isPreset && !isCustomSaved && value && (
          <button
            style={{ ...styles.customToggle, color: '#7eb8ff' }}
            onClick={() => addCustomColor(value)}
            title="Save this color for reuse"
          >
            + Save color
          </button>
        )}
        {!isPreset && (
          <span style={styles.customPreview}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: value,
                border: '1px solid #555',
                verticalAlign: 'middle',
                marginRight: 4,
              }}
            />
            <span style={{ color: '#aaa', fontSize: 11, fontFamily: 'monospace' }}>{value}</span>
          </span>
        )}
      </div>

      {showCustom && (
        <div style={styles.customInputRow}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={styles.colorInput}
          />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{value}</span>
          {!isPreset && !isCustomSaved && (
            <button
              style={{ ...styles.customToggle, color: '#7eb8ff' }}
              onClick={() => addCustomColor(value)}
            >
              + Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 24px)',
    gap: 5,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'transform 0.1s',
  },
  check: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 1,
    textShadow: '0 0 2px rgba(0,0,0,0.8)',
    pointerEvents: 'none',
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  customToggle: {
    background: 'none',
    border: '1px solid #444',
    borderRadius: 3,
    color: '#aaa',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '2px 7px',
  },
  customPreview: {
    display: 'flex',
    alignItems: 'center',
  },
  customInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorInput: {
    width: 40,
    height: 28,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: 0,
  },
};
