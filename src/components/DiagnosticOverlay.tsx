import React, { useState } from 'react';
import type { DiagnosticMessage } from '../data/diagnostics';

const SEVERITY_COLORS: Record<DiagnosticMessage['severity'], string> = {
  info: '#4fc3f7',
  warning: '#ffaa00',
  hint: '#666688',
};

interface Props {
  messages: DiagnosticMessage[];
}

export const DiagnosticOverlay: React.FC<Props> = ({ messages }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = messages.filter((m) => !dismissed.has(m.id));

  if (visible.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      {visible.map((msg) => (
        <div key={msg.id} style={{ ...cardStyle, borderLeftColor: SEVERITY_COLORS[msg.severity] }}>
          <div style={headerStyle}>
            <span style={{ ...severityLabelStyle, color: SEVERITY_COLORS[msg.severity] }}>
              {msg.severity.toUpperCase()}
            </span>
            <button
              style={closeStyle}
              onClick={() => setDismissed((prev) => new Set(prev).add(msg.id))}
              aria-label="Dismiss"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1L9 9M9 1L1 9" stroke="#888" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          <div style={titleStyle}>{msg.title}</div>
          <div style={detailStyle}>
            {msg.detail.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: 12,
  maxWidth: 380,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  pointerEvents: 'none',
  zIndex: 500,
};

const cardStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  background: 'rgba(10, 10, 18, 0.88)',
  border: '1px solid rgba(79, 195, 247, 0.25)',
  borderLeft: '3px solid #4fc3f7',
  borderRadius: 4,
  padding: '8px 12px',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: 11,
  color: '#b0b0b0',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const severityLabelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  fontWeight: 600,
};

const titleStyle: React.CSSProperties = {
  color: '#e0e0e0',
  fontSize: 11,
};

const detailStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 10,
  lineHeight: '1.4',
};

const closeStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 2,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  pointerEvents: 'auto',
};
