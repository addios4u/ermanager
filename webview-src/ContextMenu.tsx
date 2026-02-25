import React from 'react';
import { t } from './i18n';
import type { EditorMode } from '../src/types';

export type ViewMode = 'full' | 'physical' | 'logical';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string | null;
  mode: EditorMode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddTable: (x: number, y: number) => void;
  onDeleteTable: (nodeId: string) => void;
  onClose: () => void;
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--vscode-menu-border, #454545)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  minWidth: 160,
  fontFamily: 'var(--vscode-font-family)',
  fontSize: 13,
  color: 'var(--vscode-menu-foreground, #ccc)',
  padding: '4px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 16px',
  cursor: 'pointer',
  userSelect: 'none',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--vscode-menu-separatorBackground, #454545)',
  margin: '4px 0',
};

interface ItemProps {
  label: string;
  checked?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function MenuItem({ label, checked, danger, onClick }: ItemProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{
        ...itemStyle,
        background: hovered ? 'var(--vscode-menu-selectionBackground, #094771)' : 'transparent',
        color: danger && !hovered
          ? 'var(--vscode-errorForeground, #f48771)'
          : hovered
            ? 'var(--vscode-menu-selectionForeground, #fff)'
            : 'var(--vscode-menu-foreground, #ccc)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span style={{ width: 14, textAlign: 'center', fontSize: 11 }}>
        {checked ? '✓' : ''}
      </span>
      {label}
    </div>
  );
}

export function ContextMenu({
  x, y, nodeId, mode, viewMode,
  onViewModeChange, onAddTable, onDeleteTable, onClose,
}: ContextMenuProps) {
  const menuWidth = 180;
  const menuHeight = mode === 'editor' ? 220 : 130;
  const left = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  const handle = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onMouseDown={onClose}
      />
      <div style={{ ...menuStyle, left, top }}>
        {/* 뷰 모드 선택 (공통) */}
        <MenuItem
          label={t('Full name')}
          checked={viewMode === 'full'}
          onClick={() => handle(() => onViewModeChange('full'))}
        />
        <MenuItem
          label={t('Physical name')}
          checked={viewMode === 'physical'}
          onClick={() => handle(() => onViewModeChange('physical'))}
        />
        <MenuItem
          label={t('Logical name')}
          checked={viewMode === 'logical'}
          onClick={() => handle(() => onViewModeChange('logical'))}
        />

        {/* 에디터 모드 전용 */}
        {mode === 'editor' && (
          <>
            <div style={separatorStyle} />
            {nodeId === null ? (
              // 빈 캔버스 우클릭
              <MenuItem
                label={t('Add Table')}
                onClick={() => handle(() => onAddTable(x, y))}
              />
            ) : (
              // 테이블 노드 우클릭
              <MenuItem
                label={t('Delete Table')}
                danger
                onClick={() => handle(() => onDeleteTable(nodeId))}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
