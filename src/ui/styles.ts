import { BuildingStatus } from '../types';

// =============================================================================
// STATUS COLORS
// =============================================================================

export const STATUS_COLORS: Record<BuildingStatus, string> = {
  online: '#00ff88',
  offline: '#666688',
  warning: '#ffaa00',
  critical: '#ff4444',
};

// =============================================================================
// HOVER TOOLTIP
// =============================================================================

export const HOVER_TOOLTIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  display: 'none',
  pointerEvents: 'none',
  zIndex: '1001',
  padding: '6px 12px',
  background: 'rgba(10, 10, 18, 0.92)',
  border: '1px solid rgba(79, 195, 247, 0.4)',
  borderRadius: '4px',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '12px',
  color: '#e0e0e0',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, -100%)',
  backdropFilter: 'blur(8px)',
};

// =============================================================================
// DETAIL TOOLTIP
// =============================================================================

export const DETAIL_TOOLTIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  display: 'none',
  zIndex: '1000',
  minWidth: '220px',
  maxWidth: '300px',
  background: 'rgba(10, 10, 18, 0.92)',
  border: '1px solid rgba(79, 195, 247, 0.4)',
  borderRadius: '6px',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '11px',
  color: '#e0e0e0',
  overflow: 'hidden',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(79, 195, 247, 0.1)',
};

export const DETAIL_HEADER_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  borderBottom: '1px solid rgba(79, 195, 247, 0.2)',
  cursor: 'grab',
};

export const DETAIL_BODY_STYLE: Partial<CSSStyleDeclaration> = {
  padding: '8px 10px',
};

export const DETAIL_SECTION_STYLE: Partial<CSSStyleDeclaration> = {
  marginBottom: '6px',
};

export const DETAIL_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  fontSize: '9px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#4fc3f7',
  marginBottom: '2px',
};

export const DETAIL_VALUE_STYLE: Partial<CSSStyleDeclaration> = {
  color: '#e0e0e0',
};

export const DETAIL_CLOSE_STYLE: Partial<CSSStyleDeclaration> = {
  background: 'none',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  padding: '2px',
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
};

// =============================================================================
// STATUS DOT
// =============================================================================

export const STATUS_DOT_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  marginRight: '6px',
  verticalAlign: 'middle',
};

// =============================================================================
// FLOATING LABEL
// =============================================================================

export const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '0',
  top: '0',
  pointerEvents: 'none',
  padding: '2px 8px',
  background: 'rgba(10, 10, 18, 0.75)',
  border: '1px solid rgba(79, 195, 247, 0.25)',
  borderRadius: '3px',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '10px',
  color: '#b0b0b0',
  whiteSpace: 'nowrap',
  willChange: 'transform, opacity',
};

export const LABELS_CONTAINER_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  inset: '0',
  pointerEvents: 'none',
  zIndex: '100',
  overflow: 'hidden',
};

// =============================================================================
// HELPERS
// =============================================================================

export function applyStyle(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined) {
      (el.style as unknown as Record<string, unknown>)[key] = value;
    }
  }
}
