import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ParsedColumn, ParsedDiagram, ParsedTable } from '../src/types';
import { getCategoryColor } from './categoryColors';
import { t } from './i18n';

interface TableEditPanelProps {
  tableId: number;
  diagram: ParsedDiagram;
  onUpdate: (updated: ParsedDiagram) => void;
  onClose: () => void;
}

const TYPE_GROUPS = [
  {
    label: 'Integer',
    types: ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'INTEGER', 'BIGINT', 'SERIAL', 'SMALLSERIAL', 'BIGSERIAL'],
  },
  {
    label: 'Decimal / Float',
    types: ['FLOAT', 'DOUBLE', 'REAL', 'DOUBLE PRECISION', 'DECIMAL(10,2)', 'NUMERIC(10,2)', 'MONEY'],
  },
  {
    label: 'String',
    types: ['CHAR(1)', 'CHAR(36)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'CITEXT'],
  },
  {
    label: 'Binary',
    types: ['BINARY(16)', 'VARBINARY(255)', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BYTEA'],
  },
  {
    label: 'Date / Time',
    types: ['DATE', 'TIME', 'TIMETZ', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'YEAR'],
  },
  {
    label: 'Boolean',
    types: ['BOOLEAN', 'BOOL', 'TINYINT(1)'],
  },
  {
    label: 'JSON',
    types: ['JSON', 'JSONB'],
  },
  {
    label: 'UUID',
    types: ['UUID', 'CHAR(36)'],
  },
  {
    label: 'Network (PostgreSQL)',
    types: ['INET', 'CIDR', 'MACADDR'],
  },
  {
    label: 'Full Text (PostgreSQL)',
    types: ['TSVECTOR', 'TSQUERY'],
  },
  {
    label: 'Other',
    types: ['XML', 'BIT', 'BIT VARYING', 'ENUM'],
  },
];

const ALL_TYPES = TYPE_GROUPS.flatMap((g) => g.types);

// position:fixed 커스텀 자동완성 — ReactFlow transform 영향 없음
function TypeInput({
  value,
  onChange,
  disabled,
  inputStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  inputStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim()
    ? ALL_TYPES.filter((tp) => tp.toLowerCase().includes(query.toLowerCase()))
    : ALL_TYPES;

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
  }, []);

  const handleFocus = () => { updatePos(); setOpen(true); setActiveIndex(-1); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    updatePos();
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleSelect = (tp: string) => {
    setQuery(tp);
    onChange(tp);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'ArrowDown') { updatePos(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      scrollIntoView(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      scrollIntoView(prev);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const scrollIntoView = (idx: number) => {
    if (!listRef.current) return;
    const item = listRef.current.children[idx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <>
      <input
        ref={inputRef}
        style={{ ...inputStyle, marginBottom: 6 }}
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        spellCheck={false}
        placeholder="e.g. VARCHAR(255)"
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} style={{
          position: 'fixed',
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          maxHeight: 220,
          overflowY: 'auto',
          background: 'var(--vscode-dropdown-background, #3c3c3c)',
          border: '1px solid var(--vscode-dropdown-border, #555)',
          borderRadius: 3,
          zIndex: 99999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontFamily: 'var(--vscode-font-family, monospace)',
          fontSize: 12,
        }}>
          {filtered.map((tp, i) => (
            <div
              key={tp}
              style={{
                padding: '4px 10px',
                cursor: 'pointer',
                color: 'var(--vscode-foreground, #ccc)',
                background: activeIndex === i
                  ? 'var(--vscode-list-activeSelectionBackground, #094771)'
                  : 'transparent',
              }}
              onMouseDown={() => handleSelect(tp)}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {tp}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const panel: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 300,
  zIndex: 10,
  background: 'var(--vscode-editorWidget-background, #2d2d2d)',
  borderLeft: '1px solid var(--vscode-editorWidget-border, #454545)',
  borderTop: '3px solid var(--vscode-button-background, #0078d4)',
  boxShadow: '-6px 0 24px rgba(0,0,0,0.55)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--vscode-font-family, monospace)',
  fontSize: 12,
  color: 'var(--vscode-foreground, #ccc)',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--vscode-input-background, #3c3c3c)',
  color: 'var(--vscode-input-foreground, #ccc)',
  border: '1px solid var(--vscode-input-border, #555)',
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  marginBottom: 2,
};

const btnSmall: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground, #ccc)',
  cursor: 'pointer',
  padding: '0 4px',
  fontSize: 12,
  opacity: 0.7,
};

function makeNewColumn(id: number): ParsedColumn {
  return {
    id,
    wordId: id,
    physicalName: '',
    logicalName: '',
    type: '',
    description: '',
    isPrimaryKey: false,
    isForeignKey: false,
    isNotNull: false,
    isUniqueKey: false,
    defaultValue: '',
    referencedColumn: null,
    relationId: null,
  };
}

export function TableEditPanel({ tableId, diagram, onUpdate, onClose }: TableEditPanelProps) {
  const table = diagram.tables.find((t) => t.id === tableId);
  const prevIdRef = useRef<number | null>(null);

  const [physicalName, setPhysicalName] = useState('');
  const [logicalName, setLogicalName] = useState('');
  const [columns, setColumns] = useState<ParsedColumn[]>([]);
  const [expandedCol, setExpandedCol] = useState<number | null>(null);

  // 테이블이 바뀔 때만 로컬 상태 초기화
  useEffect(() => {
    if (!table) return;
    if (table.id !== prevIdRef.current) {
      prevIdRef.current = table.id;
      setPhysicalName(table.physicalName);
      setLogicalName(table.logicalName);
      setColumns(table.columns);
      setExpandedCol(null);
    }
  }, [table?.id]);

  if (!table) return null;

  const applyUpdate = (
    newPhysical: string,
    newLogical: string,
    newCols: ParsedColumn[]
  ) => {
    const updatedTable: ParsedTable = {
      ...table,
      physicalName: newPhysical,
      logicalName: newLogical,
      columns: newCols,
    };
    const updated: ParsedDiagram = {
      ...diagram,
      tables: diagram.tables.map((t) => (t.id === tableId ? updatedTable : t)),
    };
    onUpdate(updated);
  };

  const handlePhysicalName = (v: string) => {
    setPhysicalName(v);
    applyUpdate(v, logicalName, columns);
  };

  const handleLogicalName = (v: string) => {
    setLogicalName(v);
    applyUpdate(physicalName, v, columns);
  };

  const updateColumn = (idx: number, patch: Partial<ParsedColumn>) => {
    const newCols = columns.map((c, i) => i === idx ? { ...c, ...patch } : c);
    setColumns(newCols);
    applyUpdate(physicalName, logicalName, newCols);
  };

  const deleteColumn = (idx: number) => {
    const newCols = columns.filter((_, i) => i !== idx);
    setColumns(newCols);
    applyUpdate(physicalName, logicalName, newCols);
  };

  const addColumn = () => {
    const newCol = makeNewColumn(Date.now());
    const newCols = [...columns, newCol];
    setColumns(newCols);
    setExpandedCol(newCols.length - 1);
    applyUpdate(physicalName, logicalName, newCols);
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= columns.length) return;
    const newCols = [...columns];
    [newCols[idx], newCols[to]] = [newCols[to], newCols[idx]];
    setColumns(newCols);
    if (expandedCol === idx) setExpandedCol(to);
    else if (expandedCol === to) setExpandedCol(idx);
    applyUpdate(physicalName, logicalName, newCols);
  };

  const toggleCategory = (catId: number, checked: boolean) => {
    const updatedCategories = diagram.categories.map((cat) =>
      cat.id === catId
        ? {
            ...cat,
            tableIds: checked
              ? [...cat.tableIds, tableId]
              : cat.tableIds.filter((id) => id !== tableId),
          }
        : cat
    );
    onUpdate({ ...diagram, categories: updatedCategories });
  };

  return (
    <div style={panel}>
      {/* 헤더 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-editorWidget-border, #454545)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--vscode-button-background, #0078d4)' }}>{t('Edit Table')}</span>
        <button style={{ ...btnSmall, fontSize: 16, opacity: 1 }} onClick={onClose}>×</button>
      </div>

      {/* 테이블 이름 */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--vscode-editorWidget-border, #454545)', flexShrink: 0 }}>
        <div style={labelStyle}>{t('Physical name')}</div>
        <input
          style={inputStyle}
          value={physicalName}
          onChange={(e) => handlePhysicalName(e.target.value)}
          spellCheck={false}
        />
        <div style={{ ...labelStyle, marginTop: 8 }}>{t('Logical name')}</div>
        <input
          style={inputStyle}
          value={logicalName}
          onChange={(e) => handleLogicalName(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* 컬럼 목록 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'var(--vscode-sideBar-background, #252526)',
          zIndex: 1,
          borderBottom: '1px solid var(--vscode-editorWidget-border, #454545)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('Columns')}
          </span>
          <button
            style={{
              ...btnSmall,
              fontSize: 18,
              opacity: 1,
              color: 'var(--vscode-button-background, #0078d4)',
            }}
            title={t('Add Column')}
            onClick={addColumn}
          >+</button>
        </div>

        {columns.map((col, idx) => {
          const isFk = !!col.isForeignKey;
          const isExpanded = expandedCol === idx;
          return (
            <div key={col.id} style={{
              borderBottom: '1px solid var(--vscode-editorWidget-border, #454545)',
            }}>
              {/* 컬럼 요약 행 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px 4px 12px',
                  gap: 4,
                  cursor: 'pointer',
                  background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                }}
                onClick={() => setExpandedCol(isExpanded ? null : idx)}
              >
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  width: 18,
                  textAlign: 'center',
                  color: col.isPrimaryKey ? '#f0c040' : col.isForeignKey ? '#6cb6ff' : 'transparent',
                  flexShrink: 0,
                }}>
                  {col.isPrimaryKey ? 'PK' : col.isForeignKey ? 'FK' : '·'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {col.physicalName || <span style={{ opacity: 0.4 }}>{t('(unnamed)')}</span>}
                </span>
                <span style={{ fontSize: 10, opacity: 0.5, flexShrink: 0 }}>{col.type}</span>
                <button style={btnSmall} onClick={(e) => { e.stopPropagation(); moveColumn(idx, -1); }} disabled={idx === 0}>↑</button>
                <button style={btnSmall} onClick={(e) => { e.stopPropagation(); moveColumn(idx, 1); }} disabled={idx === columns.length - 1}>↓</button>
                {!isFk && (
                  <button
                    style={{ ...btnSmall, color: 'var(--vscode-errorForeground, #f48771)' }}
                    onClick={(e) => { e.stopPropagation(); deleteColumn(idx); }}
                  >×</button>
                )}
              </div>

              {/* 확장 편집 영역 */}
              {isExpanded && (
                <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)' }}>
                  {isFk && (
                    <div style={{ fontSize: 10, color: '#6cb6ff', marginBottom: 6, opacity: 0.8 }}>
                      {t('FK — managed by relation')}
                    </div>
                  )}

                  <div style={labelStyle}>{t('Physical name')}</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={col.physicalName}
                    onChange={(e) => updateColumn(idx, { physicalName: e.target.value })}
                    disabled={isFk}
                    spellCheck={false}
                  />

                  <div style={labelStyle}>{t('Logical name')}</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={col.logicalName}
                    onChange={(e) => updateColumn(idx, { logicalName: e.target.value })}
                    spellCheck={false}
                  />

                  <div style={labelStyle}>{t('Type')}</div>
                  <TypeInput
                    value={col.type}
                    onChange={(v) => updateColumn(idx, { type: v })}
                    disabled={isFk}
                    inputStyle={inputStyle}
                  />

                  <div style={labelStyle}>{t('Default')}</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={col.defaultValue ?? ''}
                    onChange={(e) => updateColumn(idx, { defaultValue: e.target.value })}
                    placeholder="e.g. 0, '', NOW()"
                    spellCheck={false}
                  />

                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: isFk ? 'default' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={col.isPrimaryKey}
                        onChange={(e) => updateColumn(idx, { isPrimaryKey: e.target.checked })}
                        disabled={isFk}
                      />
                      PK
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={col.isNotNull}
                        onChange={(e) => updateColumn(idx, { isNotNull: e.target.checked })}
                      />
                      NN
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={col.isUniqueKey}
                        onChange={(e) => updateColumn(idx, { isUniqueKey: e.target.checked })}
                      />
                      UK
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 카테고리 섹션 */}
      {diagram.categories.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--vscode-editorWidget-border, #454545)',
          padding: '8px 12px',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, opacity: 0.7,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
          }}>
            {t('Category')}
          </div>
          {diagram.categories.map((cat, idx) => {
            const isAssigned = cat.tableIds.includes(tableId);
            return (
              <label key={cat.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 0', cursor: 'pointer', fontSize: 12,
              }}>
                <input
                  type="checkbox"
                  checked={isAssigned}
                  onChange={(e) => toggleCategory(cat.id, e.target.checked)}
                />
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: getCategoryColor(idx), flexShrink: 0,
                }} />
                <span>{cat.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
