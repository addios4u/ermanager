import React, { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { ParsedCategory, EditorMode } from '../src/types';
import type { ViewMode } from './ContextMenu';
import type { OutputMode } from './CodePreviewPanel';
import type { ImportedTable } from './sqlImporter';
import { parseSQLDDL } from './sqlImporter';
import { getCategoryColor } from './categoryColors';
import { t } from './i18n';

interface ToolbarProps {
  mode: EditorMode;
  locked: boolean;
  onToggleLock: () => void;
  outputMode: OutputMode;
  onOutputModeChange: (mode: OutputMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  categories: ParsedCategory[];
  selectedCategory: number | null;
  onCategoryChange: (id: number | null) => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: number, name: string) => void;
  onDeleteCategory: (id: number) => void;
  onExport: () => void;
  includeFk: boolean;
  onIncludeFkChange: (v: boolean) => void;
  onImportSQL: (tables: ImportedTable[]) => void;
  onInstallClaudeSkill: () => void;
}

const btn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid var(--vscode-editorWidget-border, #454545)',
  borderRadius: 4,
  background: 'var(--vscode-editor-background)',
  color: 'var(--vscode-editor-foreground)',
  cursor: 'pointer',
  fontSize: 14,
  flexShrink: 0,
  userSelect: 'none',
};

const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--vscode-editorWidget-border, #454545)',
  margin: '0 2px',
};

const smallInput: React.CSSProperties = {
  height: 24,
  padding: '0 6px',
  background: 'var(--vscode-input-background, #2d2d2d)',
  color: 'var(--vscode-input-foreground, #ccc)',
  border: '1px solid var(--vscode-input-border, #555)',
  borderRadius: 3,
  fontSize: 12,
  outline: 'none',
  width: 110,
};

const iconBtn: React.CSSProperties = {
  ...btn,
  width: 22,
  height: 22,
  fontSize: 12,
  border: 'none',
  background: 'transparent',
};

export function Toolbar({
  mode, locked, onToggleLock,
  outputMode, onOutputModeChange,
  viewMode, onViewModeChange,
  categories, selectedCategory, onCategoryChange,
  onAddCategory, onRenameCategory, onDeleteCategory,
  onExport,
  includeFk, onIncludeFkChange,
  onImportSQL,
  onInstallClaudeSkill,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const sql = ev.target?.result as string;
      onImportSQL(parseSQLDDL(sql));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [addingMode, setAddingMode] = useState(false);
  const [addName, setAddName] = useState('');
  const [renamingMode, setRenamingMode] = useState(false);
  const [renameName, setRenameName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selCatIdx = categories.findIndex((c) => c.id === selectedCategory);
  const selColor = selCatIdx >= 0 ? getCategoryColor(selCatIdx) : null;

  const commitAdd = () => {
    if (addName.trim()) onAddCategory(addName.trim());
    setAddName('');
    setAddingMode(false);
  };

  const commitRename = () => {
    if (selectedCategory != null && renameName.trim()) {
      onRenameCategory(selectedCategory, renameName.trim());
    }
    setRenameName('');
    setRenamingMode(false);
  };

  const startAdding = () => {
    setRenamingMode(false);
    setAddingMode(true);
    setAddName('');
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const startRenaming = () => {
    if (selectedCategory == null) return;
    const cat = categories.find((c) => c.id === selectedCategory);
    setAddingMode(false);
    setRenamingMode(true);
    setRenameName(cat?.name ?? '');
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: 'var(--vscode-editorWidget-background, #1e1e1e)',
        border: '1px solid var(--vscode-editorWidget-border, #454545)',
        borderRadius: 6,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        flexWrap: 'wrap',
        maxWidth: 'calc(100vw - 260px)',
      }}
    >
      {/* 뷰어 모드: JSON 내보내기 버튼 */}
      {mode === 'viewer' && (
        <>
          <button
            style={btn}
            title={t('Save as JSON (.erm.json, .erm.layout.json)')}
            onClick={onExport}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
          </button>
          <div style={divider} />
        </>
      )}

      {/* 에디터 모드: SQL 불러오기 버튼 */}
      {mode === 'editor' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.ddl,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            style={btn}
            title={t('Import SQL')}
            onClick={handleImportClick}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>
          <div style={divider} />
        </>
      )}

      <button style={btn} title={t('Zoom in')} onClick={() => zoomIn({ duration: 200 })}>+</button>
      <button style={btn} title={t('Zoom out')} onClick={() => zoomOut({ duration: 200 })}>−</button>
      <button style={btn} title={t('Fit view')} onClick={() => fitView({ duration: 300, padding: 0.15 })}>⊡</button>

      <div style={divider} />

      <button
        style={{
          ...btn,
          background: locked
            ? 'var(--vscode-button-background, #0078d4)'
            : 'var(--vscode-editor-background)',
          color: locked
            ? 'var(--vscode-button-foreground, #fff)'
            : 'var(--vscode-editor-foreground)',
        }}
        title={locked ? t('Unlock layout') : t('Lock layout')}
        onClick={onToggleLock}
      >
        {locked ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1C9.24 1 7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2H9V6c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-2.76-2.24-5-5-5zm0 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
          </svg>
        )}
      </button>

      <div style={divider} />

      {/* 출력 모드 dropdown */}
      <select
        value={outputMode}
        onChange={(e) => onOutputModeChange(e.target.value as OutputMode)}
        style={{
          height: 28,
          padding: '0 6px',
          background: outputMode !== 'editor'
            ? 'var(--vscode-button-background, #0078d4)'
            : 'var(--vscode-editor-background)',
          color: outputMode !== 'editor'
            ? 'var(--vscode-button-foreground, #fff)'
            : 'var(--vscode-editor-foreground)',
          border: '1px solid var(--vscode-editorWidget-border, #454545)',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="editor">{t('Editor')}</option>
        <option value="json">JSON</option>
        <option value="postgresql">PostgreSQL</option>
        <option value="mysql">MySQL</option>
        <option value="sqlite">SQLite</option>
        <option value="typescript">TypeScript</option>
      </select>

      {/* FK 포함 체크박스 (SQL 모드일 때만) */}
      {outputMode !== 'editor' && outputMode !== 'typescript' && outputMode !== 'json' && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 12, cursor: 'pointer', userSelect: 'none',
          color: 'var(--vscode-editor-foreground)',
          whiteSpace: 'nowrap',
        }}>
          <input
            type="checkbox"
            checked={includeFk}
            onChange={(e) => onIncludeFkChange(e.target.checked)}
            style={{ cursor: 'pointer', margin: 0 }}
          />
          {t('Include FK')}
        </label>
      )}

      <div style={divider} />

      {/* 뷰 모드 세그먼트 */}
      <div style={{
        display: 'flex',
        border: '1px solid var(--vscode-editorWidget-border, #454545)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {([
          { value: 'full'     as ViewMode, label: t('Full') },
          { value: 'physical' as ViewMode, label: t('Physical') },
          { value: 'logical'  as ViewMode, label: t('Logical') },
        ]).map((item, i) => (
          <button
            key={item.value}
            onClick={() => onViewModeChange(item.value)}
            style={{
              padding: '0 10px',
              height: 28,
              fontSize: 12,
              fontFamily: 'var(--vscode-font-family)',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--vscode-editorWidget-border, #454545)' : 'none',
              cursor: 'pointer',
              userSelect: 'none',
              background: viewMode === item.value
                ? 'var(--vscode-button-background, #0078d4)'
                : 'var(--vscode-editor-background)',
              color: viewMode === item.value
                ? 'var(--vscode-button-foreground, #fff)'
                : 'var(--vscode-editor-foreground, #ccc)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 (공통) */}
      {(categories.length > 0 || mode === 'editor') && (
        <>
          <div style={divider} />

          {/* 색상 도트 */}
          {selColor && (
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: selColor, flexShrink: 0, display: 'inline-block',
            }} />
          )}

          {/* 이름 변경 모드 */}
          {renamingMode ? (
            <>
              <input
                ref={renameInputRef}
                style={smallInput}
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setRenamingMode(false); setRenameName(''); }
                }}
              />
              <button style={{ ...iconBtn, color: '#98c379' }} title={t('OK')} onClick={commitRename}>✓</button>
              <button style={iconBtn} onClick={() => { setRenamingMode(false); setRenameName(''); }}>✕</button>
            </>
          ) : (
            <select
              value={selectedCategory ?? ''}
              onChange={(e) => onCategoryChange(e.target.value === '' ? null : Number(e.target.value))}
              style={{
                height: 28,
                padding: '0 6px',
                background: 'var(--vscode-editor-background)',
                color: 'var(--vscode-editor-foreground)',
                border: '1px solid var(--vscode-editorWidget-border, #454545)',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
              }}
              title={t('Category filter')}
            >
              <option value="">{t('All')}</option>
              {categories.map((cat, idx) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}

          {/* 에디터 모드 전용: 카테고리 관리 버튼 */}
          {mode === 'editor' && !renamingMode && (
            <>
              {selectedCategory != null && (
                <>
                  <button style={iconBtn} title={t('Rename')} onClick={startRenaming}>✎</button>
                  <button
                    style={{ ...iconBtn, color: 'var(--vscode-errorForeground, #f48771)' }}
                    title={t('Delete Category')}
                    onClick={() => { onDeleteCategory(selectedCategory); onCategoryChange(null); }}
                  >✕</button>
                </>
              )}
            </>
          )}

          {/* 추가 모드 */}
          {mode === 'editor' && (
            addingMode ? (
              <>
                <input
                  ref={addInputRef}
                  style={smallInput}
                  placeholder={t('Category name')}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd();
                    if (e.key === 'Escape') { setAddingMode(false); setAddName(''); }
                  }}
                />
                <button style={{ ...iconBtn, color: '#98c379' }} title={t('OK')} onClick={commitAdd}>✓</button>
                <button style={iconBtn} onClick={() => { setAddingMode(false); setAddName(''); }}>✕</button>
              </>
            ) : (
              <button style={iconBtn} title={t('Add Category')} onClick={startAdding}>+</button>
            )
          )}
        </>
      )}

      <div style={divider} />

      {/* Claude 스킬 설치 버튼 */}
      <button
        style={{
          ...btn,
          width: 'auto',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 'bold',
          gap: 3,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--vscode-button-background, #0078d4)',
          color: 'var(--vscode-button-foreground, #fff)',
          border: 'none',
        }}
        title={t('Install Claude Skill to .claude/skills/ermanager/SKILL.md')}
        onClick={onInstallClaudeSkill}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        {t('Skill')}
      </button>
    </div>
  );
}
