// ── .erm XML 파싱 결과 타입 ─────────────────────────────────────────────────

export interface ParsedColumn {
  id: number;
  wordId: number;
  physicalName: string;
  logicalName: string;
  type: string;
  description: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNotNull: boolean;
  isUniqueKey: boolean;
  defaultValue: string;
  referencedColumn: number | null;
  relationId: number | null;
}

export interface ParsedTable {
  id: number;
  physicalName: string;
  logicalName: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: ParsedColumn[];
}

export interface ParsedRelation {
  id: number;
  sourceTableId: number;
  targetTableId: number;
  parentCardinality: string;
  childCardinality: string;
}

export interface ParsedCategory {
  id: number;
  name: string;
  tableIds: number[];
}

export interface ParsedDiagram {
  database: string;
  tables: ParsedTable[];
  relations: ParsedRelation[];
  categories: ParsedCategory[];
}

// ── 에디터 모드 ───────────────────────────────────────────────────────────────

export type EditorMode = 'viewer' | 'editor';

// ── Extension ↔ Webview 메시지 타입 ─────────────────────────────────────────

export type ExtensionMessage =
  | { type: 'update'; mode: EditorMode; content: string; layoutContent: string | null };

export type LayoutJson = {
  tables: Record<string, { x: number; y: number; width: number; height: number }>;
};

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'save'; content: string }
  | { type: 'save-layout'; layout: LayoutJson }
  | { type: 'save-schema'; schema: unknown }
  | { type: 'export-json'; diagram: ParsedDiagram };
