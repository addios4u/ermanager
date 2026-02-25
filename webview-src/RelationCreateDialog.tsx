import React, { useState } from 'react';
import type { ParsedTable } from '../src/types';
import { t } from './i18n';

interface Props {
  sourceTable: ParsedTable;
  targetTable: ParsedTable;
  onConfirm: (refColumnId: number | null, existingSourceColumnId: number | null) => void;
  onCancel: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--vscode-editor-background)',
  border: '1px solid var(--vscode-editorWidget-border, #454545)',
  borderRadius: 6,
  padding: '20px 24px',
  minWidth: 360,
  maxWidth: 480,
  fontFamily: 'var(--vscode-font-family, monospace)',
  fontSize: 13,
  color: 'var(--vscode-editor-foreground, #ccc)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 11,
  opacity: 0.7,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--vscode-input-background, #2d2d2d)',
  color: 'var(--vscode-input-foreground, #ccc)',
  border: '1px solid var(--vscode-input-border, #555)',
  borderRadius: 3,
  fontSize: 12,
  marginBottom: 14,
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 6,
};

const btnStyle = (primary: boolean): React.CSSProperties => ({
  padding: '5px 16px',
  borderRadius: 3,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  background: primary ? 'var(--vscode-button-background, #0078d4)' : 'var(--vscode-button-secondaryBackground, #3a3a3a)',
  color: primary ? 'var(--vscode-button-foreground, #fff)' : 'var(--vscode-button-secondaryForeground, #ccc)',
});

export function RelationCreateDialog({ sourceTable, targetTable, onConfirm, onCancel }: Props) {
  const refCandidates = targetTable.columns.filter((c) => c.isPrimaryKey || c.isUniqueKey);
  const existingSourceCols = sourceTable.columns.filter((c) => !c.isForeignKey);

  const [refColId, setRefColId] = useState<number | null>(refCandidates[0]?.id ?? null);
  const [sourceColOption, setSourceColOption] = useState<'new' | number>('new');

  const tableName = (t: ParsedTable) =>
    t.logicalName ? `${t.physicalName} (${t.logicalName})` : t.physicalName;

  const colLabel = (col: { physicalName: string; logicalName: string; isPrimaryKey: boolean; isUniqueKey: boolean }) => {
    const badge = col.isPrimaryKey ? 'PK' : col.isUniqueKey ? 'UK' : '';
    const name = col.logicalName ? `${col.physicalName} (${col.logicalName})` : col.physicalName;
    return badge ? `[${badge}] ${name}` : name;
  };

  return (
    <div style={overlayStyle} onMouseDown={onCancel}>
      <div style={dialogStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 14 }}>{t('Create Relation')}</div>

        <div style={{ marginBottom: 14, fontSize: 12, opacity: 0.8 }}>
          <span style={{ color: 'var(--vscode-button-background, #6cb6ff)' }}>{tableName(sourceTable)}</span>
          <span style={{ margin: '0 6px' }}>→</span>
          <span style={{ color: 'var(--vscode-button-background, #6cb6ff)' }}>{tableName(targetTable)}</span>
        </div>

        <label style={labelStyle}>{t('Referenced column ({0})', targetTable.physicalName)}</label>
        {refCandidates.length === 0 ? (
          <div style={{ ...selectStyle, opacity: 0.5, paddingTop: 6 }}>{t('No PK/UK columns — auto generate')}</div>
        ) : (
          <select
            style={selectStyle}
            value={refColId ?? ''}
            onChange={(e) => setRefColId(Number(e.target.value))}
          >
            {refCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {colLabel(c)}
              </option>
            ))}
          </select>
        )}

        <label style={labelStyle}>{t('FK column ({0})', sourceTable.physicalName)}</label>
        <select
          style={selectStyle}
          value={sourceColOption === 'new' ? 'new' : String(sourceColOption)}
          onChange={(e) => {
            const v = e.target.value;
            setSourceColOption(v === 'new' ? 'new' : Number(v));
          }}
        >
          <option value="new">{t('Auto generate new column')}</option>
          {existingSourceCols.map((c) => (
            <option key={c.id} value={c.id}>
              {colLabel(c)}
            </option>
          ))}
        </select>

        <div style={btnRowStyle}>
          <button style={btnStyle(false)} onClick={onCancel}>{t('Cancel')}</button>
          <button
            style={btnStyle(true)}
            onClick={() =>
              onConfirm(refColId, sourceColOption === 'new' ? null : (sourceColOption as number))
            }
          >
            {t('OK')}
          </button>
        </div>
      </div>
    </div>
  );
}
