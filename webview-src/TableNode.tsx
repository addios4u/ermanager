import React, { useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ParsedColumn } from '../src/types';
import { NodeCallbacksContext } from './nodeCallbacks';
import { t } from './i18n';

export interface TableNodeData extends Record<string, unknown> {
  physicalName: string;
  logicalName: string;
  columns: ParsedColumn[];
  viewMode: 'full' | 'physical' | 'logical';
  categoryColor?: string;
}

const styles = {
  wrapper: {
    background: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-editorWidget-border, #454545)',
    borderRadius: 4,
    minWidth: 180,
    maxWidth: 280,
    fontFamily: 'var(--vscode-font-family, monospace)',
    fontSize: 12,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  } as React.CSSProperties,

  header: (editable: boolean): React.CSSProperties => ({
    background: 'var(--vscode-button-background, #0078d4)',
    color: 'var(--vscode-button-foreground, #fff)',
    padding: '5px 8px',
    borderRadius: '3px 3px 0 0',
    fontWeight: 700,
    cursor: editable ? 'pointer' : 'default',
    userSelect: 'none',
  }),

  headerSub: {
    fontSize: 10,
    opacity: 0.8,
    fontWeight: 400,
  } as React.CSSProperties,

  column: (isPk: boolean): React.CSSProperties => ({
    padding: '2px 8px',
    borderTop: '1px solid var(--vscode-editorWidget-border, #454545)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: 'var(--vscode-editor-foreground, #ccc)',
    background: isPk ? 'rgba(255,200,0,0.06)' : 'transparent',
    minHeight: 20,
  }),

  badge: (isPk: boolean, isFk: boolean, isUk: boolean): React.CSSProperties => ({
    fontSize: 9,
    width: 18,
    textAlign: 'center',
    flexShrink: 0,
    fontWeight: 700,
    color: isPk ? '#f0c040' : isFk ? '#6cb6ff' : isUk ? '#7ec87e' : 'transparent',
  }),

  colName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  colType: {
    opacity: 0.55,
    fontSize: 10,
    flexShrink: 0,
  } as React.CSSProperties,

  nn: {
    opacity: 0.45,
    fontSize: 9,
    flexShrink: 0,
  } as React.CSSProperties,
} as const;

const handleStyle: React.CSSProperties = {
  background: '#6cb6ff',
  width: 12,
  height: 12,
  border: '2px solid #3a8fc4',
  borderRadius: '50%',
};

export function TableNode({ id, data }: NodeProps) {
  const { physicalName, logicalName, columns, viewMode, categoryColor } = data as TableNodeData;
  const { onEditTable, editorMode, locked } = useContext(NodeCallbacksContext);

  const isLogical = viewMode === 'logical';
  const isFull = viewMode === 'full';
  const tableName = isLogical && logicalName
    ? logicalName
    : isFull && logicalName && logicalName !== physicalName
      ? `${physicalName} (${logicalName})`
      : physicalName;

  const canConnect = editorMode && !locked;
  const hiddenHandle: React.CSSProperties = { ...handleStyle, opacity: 0, pointerEvents: 'none' };

  return (
    <div style={{
      ...styles.wrapper,
      borderLeft: categoryColor
        ? `3px solid ${categoryColor}`
        : '1px solid var(--vscode-editorWidget-border, #454545)',
    }}>
      <Handle type="source" position={Position.Top}    id="s-top"    style={canConnect ? handleStyle : hiddenHandle} isConnectable={canConnect} />
      <Handle type="target" position={Position.Top}    id="t-top"    style={hiddenHandle} isConnectable={canConnect} />
      <Handle type="source" position={Position.Right}  id="s-right"  style={canConnect ? handleStyle : hiddenHandle} isConnectable={canConnect} />
      <Handle type="target" position={Position.Right}  id="t-right"  style={hiddenHandle} isConnectable={canConnect} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={canConnect ? handleStyle : hiddenHandle} isConnectable={canConnect} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={hiddenHandle} isConnectable={canConnect} />
      <Handle type="source" position={Position.Left}   id="s-left"   style={canConnect ? handleStyle : hiddenHandle} isConnectable={canConnect} />
      <Handle type="target" position={Position.Left}   id="t-left"   style={hiddenHandle} isConnectable={canConnect} />

      <div style={styles.header(editorMode)}>
        <div>{tableName}</div>
        {!isLogical && !isFull && logicalName && logicalName !== physicalName && (
          <div style={styles.headerSub}>{logicalName}</div>
        )}
      </div>

      <div>
        {(columns as ParsedColumn[]).map((col) => (
          <div key={col.id} style={styles.column(col.isPrimaryKey)}>
            <span style={styles.badge(col.isPrimaryKey, col.isForeignKey, col.isUniqueKey)}>
              {col.isPrimaryKey ? 'PK' : col.isForeignKey ? 'FK' : col.isUniqueKey ? 'UK' : ''}
            </span>
            <span style={styles.colName}>
              {isLogical
                ? (col.logicalName || col.physicalName)
                : isFull && col.logicalName && col.logicalName !== col.physicalName
                  ? `${col.physicalName || col.logicalName} (${col.logicalName})`
                  : (col.physicalName || col.logicalName)}
            </span>
            <span style={styles.colType}>{col.type}</span>
            {col.isNotNull && !col.isPrimaryKey && (
              <span style={styles.nn}>NN</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
