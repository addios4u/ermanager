import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseErm } from './ermParser';
import { parseErmJson } from './ermJsonParser';
import { t } from './i18n';
import { TableNode, type TableNodeData } from './TableNode';
import { ErEdge, type ErEdgeData } from './ErEdge';
import { Toolbar } from './Toolbar';
import { ContextMenu, type ViewMode } from './ContextMenu';
import { RelationContextMenu } from './RelationContextMenu';
import { RelationCreateDialog } from './RelationCreateDialog';
import { TableEditPanel } from './TableEditPanel';
import { NodeCallbacksContext } from './nodeCallbacks';
import { getCategoryColor } from './categoryColors';
import { CodePreviewPanel, type OutputMode } from './CodePreviewPanel';
import type { ImportedTable } from './sqlImporter';
import type { EditorMode, LayoutJson, ParsedColumn, ParsedDiagram, ParsedRelation, ParsedTable } from '../src/types';

const vscode = acquireVsCodeApi();
const nodeTypes = { tableNode: TableNode };
const edgeTypes = { erEdge: ErEdge };

let nextId = Date.now();
function genId(): number {
  return nextId++;
}

function diagramToFlow(
  diagram: ParsedDiagram,
  viewMode: ViewMode,
  selectedCategory: number | null
): { nodes: Node[]; edges: Edge[] } {
  const visibleIds =
    selectedCategory !== null
      ? new Set(diagram.categories.find((c) => c.id === selectedCategory)?.tableIds ?? [])
      : null;

  // 테이블 ID → 카테고리 색상 맵
  const categoryColorMap = new Map<number, string>();
  diagram.categories.forEach((cat, idx) => {
    const color = getCategoryColor(idx);
    cat.tableIds.forEach((tid) => categoryColorMap.set(tid, color));
  });

  const nodes: Node[] = diagram.tables
    .filter((t) => !visibleIds || visibleIds.has(t.id))
    .map((table) => ({
      id: String(table.id),
      type: 'tableNode',
      position: { x: table.x, y: table.y },
      data: {
        physicalName: table.physicalName,
        logicalName: table.logicalName,
        columns: table.columns,
        viewMode,
        categoryColor: categoryColorMap.get(table.id),
      } as TableNodeData,
    }));

  const edges: Edge[] = diagram.relations
    .filter(
      (rel) =>
        !visibleIds ||
        (visibleIds.has(rel.sourceTableId) && visibleIds.has(rel.targetTableId))
    )
    .map((rel) => ({
      id: `rel-${rel.id}`,
      source: String(rel.sourceTableId),
      target: String(rel.targetTableId),
      type: 'erEdge',
      data: {
        parentCardinality: rel.parentCardinality,
        childCardinality: rel.childCardinality,
      } as ErEdgeData,
    }));

  return { nodes, edges };
}

function buildLayoutFromNodes(nodes: Node[]): LayoutJson {
  return {
    tables: Object.fromEntries(
      nodes.map((n) => [
        n.id,
        {
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          width: Math.round((n.measured?.width as number) ?? 180),
          height: Math.round((n.measured?.height as number) ?? 75),
        },
      ])
    ),
  };
}

function buildSchemaFromDiagram(diagram: ParsedDiagram) {
  return {
    database: diagram.database,
    tables: diagram.tables.map(({ id, physicalName, logicalName, description, columns }) => ({
      id, physicalName, logicalName, description, columns,
    })),
    relations: diagram.relations,
    categories: diagram.categories,
  };
}

function AppInner() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const [relationMenu, setRelationMenu] = useState<{ x: number; y: number; relationId: number } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>('viewer');
  const [outputMode, setOutputMode] = useState<OutputMode>('editor');
  const [includeFk, setIncludeFk] = useState(true);

  const diagramRef = useRef<ParsedDiagram | null>(null);
  const modeRef = useRef<EditorMode>('viewer');
  const nodesRef = useRef<Node[]>([]);
  const isFirstUpdate = useRef(true);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const refresh = useCallback((vmode: ViewMode, cat: number | null) => {
    if (!diagramRef.current) return;
    const { nodes: n, edges: e } = diagramToFlow(diagramRef.current, vmode, cat);
    setNodes(n);
    setEdges(e);
  }, []);

  const saveLayout = useCallback(() => {
    if (modeRef.current !== 'editor') return;
    vscode.postMessage({ type: 'save-layout', layout: buildLayoutFromNodes(nodesRef.current) });
  }, []);

  const saveSchema = useCallback((diagram: ParsedDiagram) => {
    if (modeRef.current !== 'editor') return;
    vscode.postMessage({ type: 'save-schema', schema: buildSchemaFromDiagram(diagram) });
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type !== 'update') return;

      const newMode: EditorMode = message.mode ?? 'viewer';
      setMode(newMode);
      modeRef.current = newMode;

      if (isFirstUpdate.current) {
        isFirstUpdate.current = false;
        setLocked(newMode === 'viewer');
      }

      try {
        let diagram: ParsedDiagram;
        let didAutoLayout = false;

        if (newMode === 'editor') {
          const result = parseErmJson(message.content, message.layoutContent);
          diagram = result.diagram;
          didAutoLayout = result.didAutoLayout;
        } else {
          diagram = parseErm(message.content);
        }

        diagramRef.current = diagram;
        const { nodes: n, edges: e } = diagramToFlow(diagram, viewMode, selectedCategory);
        setNodes(n);
        setEdges(e);
        setError(null);

        if (didAutoLayout) {
          setTimeout(() => {
            vscode.postMessage({ type: 'save-layout', layout: buildLayoutFromNodes(nodesRef.current) });
          }, 100);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setIsLoaded(true);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleViewMode = useCallback((vmode: ViewMode) => {
    setViewMode(vmode);
    refresh(vmode, selectedCategory);
  }, [selectedCategory, refresh]);

  const handleCategory = useCallback((cat: number | null) => {
    setSelectedCategory(cat);
    refresh(viewMode, cat);
  }, [viewMode, refresh]);

  const onPaneClick = useCallback(() => {
    setSelectedTableId(null);
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: null });
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (modeRef.current !== 'editor') return;
    setSelectedTableId(Number(node.id));
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (modeRef.current !== 'editor') return;
    event.preventDefault();
    const relId = Number(edge.id.replace('rel-', ''));
    setRelationMenu({ x: event.clientX, y: event.clientY, relationId: relId });
  }, []);

  const onNodeDragStop = useCallback(() => {
    saveLayout();
  }, [saveLayout]);

  const onExport = useCallback(() => {
    if (!diagramRef.current) return;
    vscode.postMessage({ type: 'export-json', diagram: diagramRef.current });
  }, []);

  const onInstallClaudeSkill = useCallback(() => {
    vscode.postMessage({ type: 'install-claude-skill' });
  }, []);

  // ── 테이블 추가 ────────────────────────────────────────────────────────────
  const onAddTable = useCallback((screenX: number, screenY: number) => {
    if (!diagramRef.current) return;
    const pos = screenToFlowPosition({ x: screenX, y: screenY });
    const id = genId();
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      tables: [...diagramRef.current.tables, {
        id,
        physicalName: `table_${id}`,
        logicalName: '',
        description: '',
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: 180,
        height: 75,
        columns: [],
      }],
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
    setSelectedTableId(id); // 생성 즉시 편집 패널 열기
  }, [viewMode, selectedCategory, refresh, saveSchema, screenToFlowPosition]);

  // ── 테이블 삭제 ────────────────────────────────────────────────────────────
  const onDeleteTable = useCallback((nodeId: string) => {
    if (!diagramRef.current) return;
    const tableId = Number(nodeId);
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      tables: diagramRef.current.tables.filter((t) => t.id !== tableId),
      relations: diagramRef.current.relations.filter(
        (r) => r.sourceTableId !== tableId && r.targetTableId !== tableId
      ),
    };
    diagramRef.current = updated;
    if (selectedTableId === tableId) setSelectedTableId(null);
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
    saveLayout();
  }, [viewMode, selectedCategory, selectedTableId, refresh, saveSchema, saveLayout]);

  // ── 테이블 편집 패널 열기 ──────────────────────────────────────────────────
  const handleEditTable = useCallback((nodeId: string) => {
    setSelectedTableId(Number(nodeId));
  }, []);

  // ── 테이블/컬럼 업데이트 (TableEditPanel에서 호출) ─────────────────────────
  const handleUpdateDiagram = useCallback((updated: ParsedDiagram) => {
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── 관계 생성 (onConnect) — 다이얼로그 오픈 ──────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    if (!diagramRef.current || modeRef.current !== 'editor') return;
    const sourceId = Number(connection.source);
    const targetId = Number(connection.target);
    if (connection.source == null || connection.target == null || sourceId === targetId) return;
    const alreadyExists = diagramRef.current.relations.some(
      (r) => r.sourceTableId === sourceId && r.targetTableId === targetId
    );
    if (alreadyExists) return;
    setPendingConnection(connection);
  }, []);

  // ── 관계 생성 확정 ────────────────────────────────────────────────────────
  const handleConfirmRelation = useCallback((
    refColumnId: number | null,
    existingSourceColumnId: number | null,
  ) => {
    if (!diagramRef.current || !pendingConnection) return;
    setPendingConnection(null);

    const sourceId = Number(pendingConnection.source);
    const targetId = Number(pendingConnection.target);
    const sourceTable = diagramRef.current.tables.find((t) => t.id === sourceId);
    const targetTable = diagramRef.current.tables.find((t) => t.id === targetId);
    if (!sourceTable || !targetTable) return;

    const relId = genId();
    const refCol = refColumnId != null
      ? targetTable.columns.find((c) => c.id === refColumnId) ?? null
      : null;

    let updatedTables = diagramRef.current.tables;

    if (existingSourceColumnId != null) {
      // 기존 컬럼을 FK로 전환
      updatedTables = updatedTables.map((t) =>
        t.id === sourceId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === existingSourceColumnId
                  ? { ...c, isForeignKey: true, referencedColumn: refColumnId, relationId: relId }
                  : c
              ),
            }
          : t
      );
    } else {
      // 새 FK 컬럼 생성
      const newFk: ParsedColumn = refCol
        ? {
            id: genId(),
            wordId: 0,
            physicalName: `${targetTable.physicalName}_${refCol.physicalName}`,
            logicalName: refCol.logicalName
              ? `${targetTable.logicalName || targetTable.physicalName}_${refCol.logicalName}`
              : '',
            type: refCol.type,
            description: '',
            isPrimaryKey: false,
            isForeignKey: true,
            isNotNull: false,
            isUniqueKey: false,
            defaultValue: '',
            referencedColumn: refCol.id,
            relationId: relId,
          }
        : {
            id: genId(),
            wordId: 0,
            physicalName: `${targetTable.physicalName}_id`,
            logicalName: '',
            type: 'INTEGER',
            description: '',
            isPrimaryKey: false,
            isForeignKey: true,
            isNotNull: false,
            isUniqueKey: false,
            defaultValue: '',
            referencedColumn: null,
            relationId: relId,
          };
      updatedTables = updatedTables.map((t) =>
        t.id === sourceId ? { ...t, columns: [...t.columns, newFk] } : t
      );
    }

    const newRelation: ParsedRelation = {
      id: relId,
      sourceTableId: sourceId,
      targetTableId: targetId,
      parentCardinality: '1',
      childCardinality: '0..n',
    };

    const updated: ParsedDiagram = {
      ...diagramRef.current,
      tables: updatedTables,
      relations: [...diagramRef.current.relations, newRelation],
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [pendingConnection, viewMode, selectedCategory, refresh, saveSchema]);

  // ── 관계 삭제 (FK 컬럼은 일반 컬럼으로 변환) ──────────────────────────────
  const deleteRelation = useCallback((relationId: number) => {
    if (!diagramRef.current) return;
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      tables: diagramRef.current.tables.map((t) => ({
        ...t,
        columns: t.columns.map((c) =>
          c.relationId === relationId
            ? { ...c, isForeignKey: false, referencedColumn: null, relationId: null }
            : c
        ),
      })),
      relations: diagramRef.current.relations.filter((r) => r.id !== relationId),
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── 카테고리 추가 ──────────────────────────────────────────────────────────
  const onAddCategory = useCallback((name: string) => {
    if (!diagramRef.current || !name.trim()) return;
    const id = genId();
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      categories: [...diagramRef.current.categories, { id, name: name.trim(), tableIds: [] }],
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── 카테고리 이름 변경 ────────────────────────────────────────────────────
  const onRenameCategory = useCallback((id: number, name: string) => {
    if (!diagramRef.current || !name.trim()) return;
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      categories: diagramRef.current.categories.map((c) =>
        c.id === id ? { ...c, name: name.trim() } : c
      ),
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── 카테고리 삭제 ──────────────────────────────────────────────────────────
  const onDeleteCategory = useCallback((id: number) => {
    if (!diagramRef.current) return;
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      categories: diagramRef.current.categories.filter((c) => c.id !== id),
    };
    diagramRef.current = updated;
    const newSelected = selectedCategory === id ? null : selectedCategory;
    setSelectedCategory(newSelected);
    refresh(viewMode, newSelected);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── SQL 불러오기 ──────────────────────────────────────────────────────────
  const handleImportSQL = useCallback((importedTables: ImportedTable[]) => {
    if (!diagramRef.current || importedTables.length === 0) return;

    const existingNames = new Set(diagramRef.current.tables.map((t) => t.physicalName));

    // 테이블 높이: 저장된 height(ReactFlow 실측값)와 추정값 중 큰 값 사용
    const estH = (colCount: number) => 36 + Math.max(colCount, 1) * 24;
    const tableBottom = (t: ParsedTable) => t.y + Math.max(t.height || 0, estH(t.columns.length));

    // 기존 테이블 최하단 아래부터 배치
    const startY = diagramRef.current.tables.length > 0
      ? Math.max(...diagramRef.current.tables.map(tableBottom)) + 80
      : 40;

    const COLS = 4;
    const COL_GAP = 320;
    const H_GAP = 40; // 행 간 여백

    // 행별 최대 높이를 계산해 누적 y 구하기
    const rowCount = Math.ceil(importedTables.length / COLS);
    const rowY: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      const prev = r === 0 ? startY : rowY[r - 1] + Math.max(
        ...importedTables.slice((r - 1) * COLS, r * COLS).map((t) => estH(t.columns.length))
      ) + H_GAP;
      rowY.push(prev);
    }

    const newTables: ParsedTable[] = importedTables.map((t, idx) => {
      // 중복 이름 처리
      let name = t.physicalName;
      if (existingNames.has(name)) {
        let i = 1;
        while (existingNames.has(`${name}_${i}`)) i++;
        name = `${name}_${i}`;
      }
      existingNames.add(name);

      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      return {
        id: genId(),
        physicalName: name,
        logicalName: t.logicalName,
        description: '',
        x: 40 + col * COL_GAP,
        y: rowY[row],
        width: 180,
        height: 75,
        columns: t.columns.map((c) => ({ ...c, id: genId(), wordId: genId() })),
      };
    });

    const updated: ParsedDiagram = {
      ...diagramRef.current,
      tables: [...diagramRef.current.tables, ...newTables],
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
    setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 50);
  }, [viewMode, selectedCategory, refresh, saveSchema, fitView]);

  // ── JSON 편집 적용 ────────────────────────────────────────────────────────
  const handleJsonApply = useCallback((json: string) => {
    if (!diagramRef.current) return;
    try {
      const parsed = JSON.parse(json);
      const posMap = new Map(diagramRef.current.tables.map((t) => [t.id, { x: t.x, y: t.y, width: t.width, height: t.height }]));
      const updated: ParsedDiagram = {
        ...diagramRef.current,
        database: parsed.database ?? diagramRef.current.database,
        tables: (parsed.tables ?? []).map((t: any) => {
          const pos = posMap.get(t.id) ?? { x: 0, y: 0, width: 180, height: 75 };
          return { ...pos, ...t };
        }),
        relations: parsed.relations ?? diagramRef.current.relations,
        categories: parsed.categories ?? diagramRef.current.categories,
      };
      diagramRef.current = updated;
      refresh(viewMode, selectedCategory);
      saveSchema(updated);
    } catch {
      // 유효하지 않은 JSON — CodePreviewPanel에서 이미 에러 표시
    }
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── 관계 cardinality 변경 ──────────────────────────────────────────────────
  const changeCardinality = useCallback((relationId: number, parent: string, child: string) => {
    if (!diagramRef.current) return;
    const updated: ParsedDiagram = {
      ...diagramRef.current,
      relations: diagramRef.current.relations.map((r) =>
        r.id === relationId
          ? { ...r, parentCardinality: parent, childCardinality: child }
          : r
      ),
    };
    diagramRef.current = updated;
    refresh(viewMode, selectedCategory);
    saveSchema(updated);
  }, [viewMode, selectedCategory, refresh, saveSchema]);

  // ── Delete 키로 에지 삭제 ──────────────────────────────────────────────────
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    if (modeRef.current !== 'editor') return;
    for (const edge of deletedEdges) {
      const relId = Number(edge.id.replace('rel-', ''));
      if (!isNaN(relId)) deleteRelation(relId);
    }
  }, [deleteRelation]);

  const nodeCallbacks = {
    onEditTable: handleEditTable,
    editorMode: mode === 'editor',
    locked,
  };

  const activeRelation = relationMenu
    ? diagramRef.current?.relations.find((r) => r.id === relationMenu.relationId)
    : null;

  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--vscode-errorForeground)', fontFamily: 'var(--vscode-font-family)' }}>
        <strong>{t('Parse error')}</strong>
        <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--vscode-foreground)', fontFamily: 'var(--vscode-font-family)' }}>
        {t('Loading...')}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {outputMode !== 'editor' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <CodePreviewPanel
            outputMode={outputMode}
            onOutputModeChange={setOutputMode}
            diagram={diagramRef.current}
            includeFk={includeFk}
            onIncludeFkChange={setIncludeFk}
            onJsonApply={handleJsonApply}
          />
        </div>
      )}
      {outputMode === 'editor' && <Toolbar
          mode={mode}
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
          outputMode={outputMode}
          onOutputModeChange={setOutputMode}
          viewMode={viewMode}
          onViewModeChange={handleViewMode}
          categories={diagramRef.current?.categories ?? []}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategory}
          onAddCategory={onAddCategory}
          onRenameCategory={onRenameCategory}
          onDeleteCategory={onDeleteCategory}
          onExport={onExport}
          includeFk={includeFk}
          onIncludeFkChange={setIncludeFk}
          onImportSQL={handleImportSQL}
          onInstallClaudeSkill={onInstallClaudeSkill}
        />}
      <div style={{ width: '100%', height: '100%' }}>
    <img
      src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
      alt="Buy Me a Coffee"
      style={{ position: 'absolute', top: 170, right: 15, zIndex: 5, height: 32, cursor: 'pointer', borderRadius: 6, opacity: 0.85 }}
      onClick={() => vscode.postMessage({ type: 'open-external', url: 'https://buymeacoffee.com/addios4u' })}
    />
    <NodeCallbacksContext.Provider value={nodeCallbacks}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!locked}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={mode === 'editor' ? 'Delete' : null}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />

        <MiniMap
          position="top-right"
          nodeColor={() => 'var(--vscode-button-background, #0078d4)'}
          maskColor="rgba(0,0,0,0.4)"
          pannable
          zoomable
        />


        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            mode={mode}
            viewMode={viewMode}
            onViewModeChange={handleViewMode}
            onAddTable={onAddTable}
            onDeleteTable={onDeleteTable}
            onClose={() => setContextMenu(null)}
          />
        )}

        {pendingConnection && diagramRef.current && (() => {
          const srcId = Number(pendingConnection.source);
          const tgtId = Number(pendingConnection.target);
          const srcTable = diagramRef.current!.tables.find((t) => t.id === srcId);
          const tgtTable = diagramRef.current!.tables.find((t) => t.id === tgtId);
          return srcTable && tgtTable ? (
            <RelationCreateDialog
              sourceTable={srcTable}
              targetTable={tgtTable}
              onConfirm={handleConfirmRelation}
              onCancel={() => setPendingConnection(null)}
            />
          ) : null;
        })()}

        {relationMenu && activeRelation && (
          <RelationContextMenu
            x={relationMenu.x}
            y={relationMenu.y}
            parentCardinality={activeRelation.parentCardinality}
            childCardinality={activeRelation.childCardinality}
            onChangeCardinality={(parent, child) => changeCardinality(relationMenu.relationId, parent, child)}
            onDelete={() => deleteRelation(relationMenu.relationId)}
            onClose={() => setRelationMenu(null)}
          />
        )}

        {/* 테이블 편집 패널 */}
        {mode === 'editor' && selectedTableId !== null && diagramRef.current && (
          <TableEditPanel
            tableId={selectedTableId}
            diagram={diagramRef.current}
            onUpdate={handleUpdateDiagram}
            onClose={() => setSelectedTableId(null)}
          />
        )}
      </ReactFlow>
    </NodeCallbacksContext.Provider>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
