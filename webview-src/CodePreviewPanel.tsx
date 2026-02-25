import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ParsedDiagram } from '../src/types';
import { generatePostgresSQL, generateMySQLSQL, generateSQLiteSQL, generateTypeScript, generateJSON } from './codeGenerators';
import { t } from './i18n';

export type OutputMode = 'editor' | 'json' | 'postgresql' | 'mysql' | 'sqlite' | 'typescript';

function getLanguage(mode: Exclude<OutputMode, 'editor'>): string {
  switch (mode) {
    case 'json':       return 'json';
    case 'postgresql': return 'pgsql';
    case 'mysql':      return 'mysql';
    case 'sqlite':     return 'sql';
    case 'typescript': return 'typescript';
  }
}

function getMonacoTheme(): 'vs-dark' | 'vs' {
  return document.body.classList.contains('vscode-light') ? 'vs' : 'vs-dark';
}

interface Props {
  outputMode: Exclude<OutputMode, 'editor'>;
  onOutputModeChange: (mode: OutputMode) => void;
  diagram: ParsedDiagram | null;
  includeFk: boolean;
  onIncludeFkChange: (v: boolean) => void;
  onJsonApply?: (json: string) => void;
}

export function CodePreviewPanel({ outputMode, onOutputModeChange, diagram, includeFk, onIncludeFkChange, onJsonApply }: Props) {
  const [copied, setCopied] = useState(false);
  const [localJson, setLocalJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const code = useMemo(() => {
    if (!diagram) return '';
    switch (outputMode) {
      case 'json':       return generateJSON(diagram);
      case 'postgresql': return generatePostgresSQL(diagram, includeFk);
      case 'mysql':      return generateMySQLSQL(diagram, includeFk);
      case 'sqlite':     return generateSQLiteSQL(diagram, includeFk);
      case 'typescript': return generateTypeScript(diagram);
    }
  }, [outputMode, diagram, includeFk]);

  // JSON 모드: diagram이 바뀌면 localJson 동기화
  useEffect(() => {
    if (outputMode === 'json') {
      setLocalJson(code);
      setJsonError(null);
    }
  }, [code, outputMode]);

  const handleCopy = () => {
    const text = outputMode === 'json' ? localJson : code;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApply = () => {
    try {
      JSON.parse(localJson);
      setJsonError(null);
      onJsonApply?.(localJson);
    } catch (e) {
      setJsonError(String(e));
    }
  };

  const editorValue = outputMode === 'json' ? localJson : code;
  const language = getLanguage(outputMode);
  const theme = getMonacoTheme();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--vscode-editor-background)',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        borderBottom: '1px solid var(--vscode-editorWidget-border, #454545)',
        flexShrink: 0,
        background: 'var(--vscode-editorWidget-background, #1e1e1e)',
      }}>
        {/* 왼쪽: 출력 모드 selector + FK 체크박스 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={outputMode}
            onChange={(e) => onOutputModeChange(e.target.value as OutputMode)}
            style={{
              height: 24,
              padding: '0 6px',
              background: 'var(--vscode-button-background, #0078d4)',
              color: 'var(--vscode-button-foreground, #fff)',
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="editor" style={{ background: '#1e1e1e', color: '#ccc' }}>{t('Editor')}</option>
            <option value="json"   style={{ background: '#1e1e1e', color: '#ccc' }}>JSON</option>
            <option value="postgresql" style={{ background: '#1e1e1e', color: '#ccc' }}>PostgreSQL</option>
            <option value="mysql"      style={{ background: '#1e1e1e', color: '#ccc' }}>MySQL</option>
            <option value="sqlite"     style={{ background: '#1e1e1e', color: '#ccc' }}>SQLite</option>
            <option value="typescript" style={{ background: '#1e1e1e', color: '#ccc' }}>TypeScript</option>
          </select>

          {outputMode !== 'typescript' && outputMode !== 'json' && (
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
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {jsonError && (
            <span style={{
              fontSize: 11,
              color: 'var(--vscode-errorForeground, #f48771)',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {jsonError}
            </span>
          )}
          {outputMode === 'json' && (
            <button
              onClick={handleApply}
              style={{
                padding: '3px 12px',
                fontSize: 12,
                border: '1px solid var(--vscode-button-background, #0078d4)',
                borderRadius: 3,
                cursor: 'pointer',
                background: 'var(--vscode-button-background, #0078d4)',
                color: 'var(--vscode-button-foreground, #fff)',
                fontFamily: 'var(--vscode-font-family)',
              }}
            >
              {t('Apply')}
            </button>
          )}
          <button
            onClick={handleCopy}
            style={{
              padding: '3px 12px',
              fontSize: 12,
              border: '1px solid var(--vscode-editorWidget-border, #454545)',
              borderRadius: 3,
              cursor: 'pointer',
              background: copied
                ? 'var(--vscode-button-background, #0078d4)'
                : 'var(--vscode-editor-background)',
              color: copied
                ? 'var(--vscode-button-foreground, #fff)'
                : 'var(--vscode-editor-foreground, #ccc)',
              transition: 'background 0.15s, color 0.15s',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            {copied ? t('Copied!') : t('Copy')}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          value={editorValue}
          language={language}
          theme={theme}
          options={{
            readOnly: outputMode !== 'json',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            folding: true,
            wordWrap: 'off',
            automaticLayout: true,
            renderLineHighlight: outputMode === 'json' ? 'all' : 'none',
            cursorStyle: outputMode === 'json' ? 'line' : 'underline',
            contextmenu: false,
          }}
          onChange={outputMode === 'json'
            ? (val) => { setLocalJson(val ?? ''); setJsonError(null); }
            : undefined
          }
        />
      </div>
    </div>
  );
}
