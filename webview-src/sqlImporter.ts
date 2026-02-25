import type { ParsedColumn } from '../src/types';

export interface ImportedTable {
  physicalName: string;
  logicalName: string;
  columns: ParsedColumn[];
}

function unquote(s: string): string {
  return s.replace(/^[`"'[\]]|[`"'[\]]$/g, '').trim();
}

/** 최상위 레벨(depth=0)에서 콤마로 분리 */
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr = false;
  let strCh = '';

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      cur += c;
      if (c === strCh && str[i - 1] !== '\\') inStr = false;
    } else if (c === "'" || c === '"' || c === '`') {
      inStr = true;
      strCh = c;
      cur += c;
    } else if (c === '(') {
      depth++;
      cur += c;
    } else if (c === ')') {
      depth--;
      cur += c;
    } else if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** CREATE TABLE 이후 첫 번째 ( ... ) 블록 추출 */
function extractBody(sql: string, from: number): string | null {
  let depth = 0;
  let start = -1;
  for (let i = from; i < sql.length; i++) {
    if (sql[i] === '(') {
      depth++;
      if (depth === 1) start = i + 1;
    } else if (sql[i] === ')') {
      depth--;
      if (depth === 0) return sql.slice(start, i);
    }
  }
  return null;
}

const SKIP_RE = /^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s+(KEY|INDEX)?|KEY\s|INDEX\s|CONSTRAINT\s|CHECK\s*\()/i;
const TYPE_BREAK_RE = /\b(NOT\s+NULL|NULL\b|DEFAULT\b|PRIMARY\s+KEY|UNIQUE\b|AUTO_INCREMENT|AUTOINCREMENT|SERIAL\b|COMMENT\b|REFERENCES\b|CHECK\b|GENERATED\b)/i;

function parseColumnDef(line: string, idBase: number, idx: number): ParsedColumn | null {
  const trimmed = line.trim();
  if (!trimmed || SKIP_RE.test(trimmed)) return null;

  // 컬럼명 추출 (backtick / double-quote / bracket / plain)
  const nameMatch = trimmed.match(/^([`"[\]\w]+)\s+([\s\S]+)/);
  if (!nameMatch) return null;

  const physicalName = unquote(nameMatch[1]);
  if (!physicalName) return null;
  const rest = nameMatch[2].trim();

  // 타입: 첫 번째 제약 키워드 이전까지
  const breakMatch = rest.match(TYPE_BREAK_RE);
  const rawType = (breakMatch ? rest.slice(0, breakMatch.index) : rest).trim().replace(/\s+/g, ' ');

  const up = rest.toUpperCase();
  const isPrimaryKey = /\bPRIMARY\s+KEY\b/.test(up);
  const isNotNull = isPrimaryKey || /\bNOT\s+NULL\b/.test(up);
  const isUniqueKey = !isPrimaryKey && /\bUNIQUE\b/.test(up);

  // DEFAULT
  let defaultValue = '';
  const defMatch = rest.match(/\bDEFAULT\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\S+)/i);
  if (defMatch) {
    defaultValue = defMatch[1].replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1');
  }

  // COMMENT (MySQL inline)
  let logicalName = '';
  const comMatch = rest.match(/\bCOMMENT\s+'((?:[^'\\]|\\.)*)'/i);
  if (comMatch) logicalName = comMatch[1];

  return {
    id: idBase + idx * 2,
    wordId: idBase + idx * 2 + 1,
    physicalName,
    logicalName,
    type: rawType,
    description: '',
    isPrimaryKey,
    isForeignKey: false,
    isNotNull,
    isUniqueKey,
    defaultValue,
    referencedColumn: null,
    relationId: null,
  };
}

export function parseSQLDDL(sql: string): ImportedTable[] {
  const tables: ImportedTable[] = [];

  // 주석 제거
  const cleaned = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:[`"[\]]?[\w$]+[`"[\]]?\.)?[`"[\]]?[\w$]+[`"[\]]?)/gi;
  let m: RegExpExecArray | null;

  while ((m = createRe.exec(cleaned)) !== null) {
    const rawName = m[1];
    // schema.table → table 만 취함
    const physicalName = unquote((rawName.includes('.') ? rawName.split('.').pop()! : rawName));
    if (!physicalName) continue;

    const body = extractBody(cleaned, m.index + m[0].length);
    if (body === null) continue;

    const lines = splitTopLevel(body);

    // 테이블 레벨 PK 제약 (복합 PK)
    const pkSet = new Set<string>();
    for (const line of lines) {
      const pkMatch = line.match(/^\s*(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        pkMatch[1].split(',').forEach((c) => pkSet.add(unquote(c.trim())));
      }
    }

    const idBase = Date.now() + Math.floor(Math.random() * 1e6);
    const columns: ParsedColumn[] = [];

    lines.forEach((line, idx) => {
      const col = parseColumnDef(line, idBase, idx);
      if (col) {
        if (pkSet.has(col.physicalName)) col.isPrimaryKey = true;
        columns.push(col);
      }
    });

    // PostgreSQL COMMENT ON COLUMN 처리 (별도 구문)
    // CREATE TABLE 파싱 후 COMMENT ON 구문을 뒤에서 찾음 — 이 루프 밖에서 처리
    tables.push({ physicalName, logicalName: '', columns });
  }

  // PostgreSQL COMMENT ON TABLE / COLUMN 적용
  const commentTableRe = /COMMENT\s+ON\s+TABLE\s+([`"[\].\w]+)\s+IS\s+'((?:[^'\\]|\\.)*)'/gi;
  const commentColRe   = /COMMENT\s+ON\s+COLUMN\s+([`"[\].\w]+)\.([`"[\]\w]+)\s+IS\s+'((?:[^'\\]|\\.)*)'/gi;

  let cm: RegExpExecArray | null;
  while ((cm = commentTableRe.exec(cleaned)) !== null) {
    const tName = unquote(cm[1].split('.').pop() ?? cm[1]);
    const t = tables.find((t) => t.physicalName === tName);
    if (t) t.logicalName = cm[2];
  }
  while ((cm = commentColRe.exec(cleaned)) !== null) {
    const tName = unquote(cm[1].split('.').pop() ?? cm[1]);
    const cName = unquote(cm[2]);
    const t = tables.find((t) => t.physicalName === tName);
    if (t) {
      const col = t.columns.find((c) => c.physicalName === cName);
      if (col) col.logicalName = cm[3];
    }
  }

  return tables;
}
