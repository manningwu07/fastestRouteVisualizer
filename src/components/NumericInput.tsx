import React from 'react';

export interface NumericInputProps {
  value: number | string;
  onChange: (value: number) => void;
  onSubmit?: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
  min?: number;
  suffix?: string;
}

const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]);

export function NumericInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  style,
  min = 0,
  suffix,
}: NumericInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (ALLOWED_KEYS.has(e.key)) {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
        onSubmit?.();
      }
      return;
    }
    // Allow Ctrl/Cmd+A, C, V, X
    if (e.ctrlKey || e.metaKey) return;
    // Allow digits only
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!/^\d+$/.test(text)) {
      e.preventDefault();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    const parsed = raw === '' ? min : parseInt(raw, 10);
    onChange(Math.max(min, parsed));
  }

  const defaultStyle: React.CSSProperties = {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 3,
    color: '#e8e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '4px 8px',
    width: 60,
    outline: 'none',
  };

  const input = (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      style={style ?? defaultStyle}
    />
  );

  if (!suffix) return input;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {input}
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{suffix}</span>
    </div>
  );
}
