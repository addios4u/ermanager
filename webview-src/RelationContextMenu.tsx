import React from 'react';
import { t } from './i18n';

interface RelationContextMenuProps {
  x: number;
  y: number;
  parentCardinality: string;
  childCardinality: string;
  onChangeCardinality: (parent: string, child: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--vscode-menu-border, #454545)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  minWidth: 200,
  fontFamily: 'var(--vscode-font-family)',
  fontSize: 12,
  color: 'var(--vscode-menu-foreground, #ccc)',
  padding: '8px 0',
};

const sectionLabel: React.CSSProperties = {
  padding: '2px 16px',
  fontSize: 10,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '3px 16px',
  cursor: 'pointer',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--vscode-menu-separatorBackground, #454545)',
  margin: '6px 0',
};

const deleteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 16px',
  cursor: 'pointer',
  color: 'var(--vscode-errorForeground, #f48771)',
  userSelect: 'none',
};

const PARENT_OPTIONS = [
  { value: '1',    labelKey: '1 (exactly one)' },
  { value: '0..1', labelKey: '0..1 (zero or one)' },
];

const CHILD_OPTIONS = [
  { value: '1..n', labelKey: '1..N (one or more)' },
  { value: '0..n', labelKey: '0..N (zero or more)' },
  { value: '1',    labelKey: '1 (exactly one)' },
  { value: '0..1', labelKey: '0..1 (zero or one)' },
];

export function RelationContextMenu({
  x, y,
  parentCardinality,
  childCardinality,
  onChangeCardinality,
  onDelete,
  onClose,
}: RelationContextMenuProps) {
  const menuWidth = 210;
  const menuHeight = 260;
  const left = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onMouseDown={onClose}
      />
      <div style={{ ...menuStyle, left, top }}>
        <div style={sectionLabel}>{t('Parent (1 side)')}</div>
        {PARENT_OPTIONS.map((opt) => (
          <label key={opt.value} style={radioRow}>
            <input
              type="radio"
              name="parent"
              value={opt.value}
              checked={parentCardinality === opt.value}
              onChange={() => onChangeCardinality(opt.value, childCardinality)}
            />
            {t(opt.labelKey)}
          </label>
        ))}

        <div style={separatorStyle} />

        <div style={sectionLabel}>{t('Child (N side)')}</div>
        {CHILD_OPTIONS.map((opt) => (
          <label key={opt.value} style={radioRow}>
            <input
              type="radio"
              name="child"
              value={opt.value}
              checked={childCardinality === opt.value}
              onChange={() => onChangeCardinality(parentCardinality, opt.value)}
            />
            {t(opt.labelKey)}
          </label>
        ))}

        <div style={separatorStyle} />

        <div style={deleteStyle} onClick={() => { onDelete(); onClose(); }}>
          {t('Delete Relation')}
        </div>
      </div>
    </>
  );
}
