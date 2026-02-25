import type { ParsedColumn, ParsedDiagram, ParsedRelation, ParsedTable, ParsedCategory, LayoutJson } from '../src/types';

interface ErmJsonSchema {
  database?: string;
  tables: Array<{
    id: number;
    physicalName: string;
    logicalName: string;
    description: string;
    columns: ParsedColumn[];
  }>;
  relations: ParsedRelation[];
  categories?: ParsedCategory[];
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 75;
const GRID_COLS = 4;
const GRID_COL_GAP = 320;
const GRID_ROW_GAP = 260;
const GRID_ORIGIN_X = 40;
const GRID_ORIGIN_Y = 40;

function autoLayout(
  tableIds: number[]
): Record<number, { x: number; y: number; width: number; height: number }> {
  const result: Record<number, { x: number; y: number; width: number; height: number }> = {};
  tableIds.forEach((id, idx) => {
    result[id] = {
      x: GRID_ORIGIN_X + (idx % GRID_COLS) * GRID_COL_GAP,
      y: GRID_ORIGIN_Y + Math.floor(idx / GRID_COLS) * GRID_ROW_GAP,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  });
  return result;
}

/** .erm.json + (선택적) .erm.layout.json → ParsedDiagram
 *  @returns { diagram, didAutoLayout } — didAutoLayout=true 이면 레이아웃 파일 없었음 */
export function parseErmJson(
  schemaContent: string,
  layoutContent: string | null
): { diagram: ParsedDiagram; didAutoLayout: boolean } {
  const schema: ErmJsonSchema = JSON.parse(schemaContent);

  // 레이아웃 파싱 시도
  let layout: LayoutJson['tables'] = {};
  let didAutoLayout = false;

  if (layoutContent) {
    try {
      const parsed: LayoutJson = JSON.parse(layoutContent);
      layout = parsed.tables ?? {};
    } catch {
      // 파싱 실패 → 자동 배치
    }
  }

  if (Object.keys(layout).length === 0) {
    const auto = autoLayout(schema.tables.map((t) => t.id));
    for (const [id, pos] of Object.entries(auto)) {
      layout[String(id)] = pos;
    }
    didAutoLayout = true;
  }

  const tables: ParsedTable[] = schema.tables.map((t) => {
    const pos = layout[String(t.id)] ?? { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    return {
      id: t.id,
      physicalName: t.physicalName,
      logicalName: t.logicalName,
      description: t.description,
      x: pos.x,
      y: pos.y,
      width: pos.width ?? DEFAULT_WIDTH,
      height: pos.height ?? DEFAULT_HEIGHT,
      columns: t.columns,
    };
  });

  return {
    diagram: {
      database: schema.database ?? 'PostgreSQL',
      tables,
      relations: schema.relations ?? [],
      categories: schema.categories ?? [],
    },
    didAutoLayout,
  };
}
