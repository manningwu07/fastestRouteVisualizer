import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store.js';

export function Toast() {
  const { toastMessage } = useStore();
  const [visible, setVisible] = useState(false);
  const [displayedMessage, setDisplayedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      setDisplayedMessage(toastMessage);
      setVisible(true);
    } else {
      // Fade out: keep message visible during fade, then clear
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setDisplayedMessage(null), 300);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!displayedMessage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1e3a2a',
        color: '#7ec8a8',
        border: '1px solid #3a6a4a',
        borderRadius: 6,
        padding: '8px 20px',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {displayedMessage}
    </div>
  );
}
