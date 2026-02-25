import type { ParsedDiagram, ParsedTable, ParsedColumn } from '../src/types';

// ── 공통 유틸 ────────────────────────────────────────────────────────────────

/** 쉼표를 '--' 주석 앞에 삽입 (주석이 없으면 끝에 추가) */
function appendComma(def: string): string {
  const idx = def.indexOf(' --');
  return idx !== -1 ? def.slice(0, idx) + ',' + def.slice(idx) : def + ',';
}

function joinDefs(defs: string[]): string {
  return defs.map((d, i) => i < defs.length - 1 ? appendComma(d) : d).join('\n');
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(name: string): string {
  const p = toPascalCase(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

// ── DEFAULT 값 포매팅 ─────────────────────────────────────────────────────────

const SQL_BARE_RE = /^-?\d+(\.\d+)?$|^(NULL|TRUE|FALSE|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NOW\(\)|GETDATE\(\)|SYSDATE\(\)|NEWID\(\)|RANDOM\(\)|RAND\(\)|GEN_RANDOM_UUID\(\)|UUID\(\))$/i;

function fmtDefault(val: string): string {
  const v = val.trim();
  if (!v) return '';
  // 이미 따옴표로 감싸져 있는 경우
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return v;
  // 숫자 / SQL 예약어 / 함수 호출
  if (SQL_BARE_RE.test(v) || /\(.*\)$/.test(v)) return v;
  // 나머지 문자열 → 작은따옴표로 감쌈 (내부 ' 이스케이프)
  return `'${v.replace(/'/g, "''")}'`;
}

// ── FK 참조 컬럼 맵 ───────────────────────────────────────────────────────────

function buildColMap(diagram: ParsedDiagram): Map<number, { table: ParsedTable; col: ParsedColumn }> {
  const map = new Map<number, { table: ParsedTable; col: ParsedColumn }>();
  for (const table of diagram.tables) {
    for (const col of table.columns) {
      map.set(col.id, { table, col });
    }
  }
  return map;
}

// ── TypeScript 타입 매핑 ──────────────────────────────────────────────────────

function sqlTypeToTs(sqlType: string): string {
  const u = sqlType.toUpperCase().replace(/\(.*\)/, '').trim();
  if (['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
       'SERIAL', 'SMALLSERIAL', 'BIGSERIAL',
       'FLOAT', 'DOUBLE', 'REAL', 'NUMERIC', 'DECIMAL', 'MONEY',
       'DOUBLE PRECISION'].some((t) => u.startsWith(t))) return 'number';
  if (['BOOLEAN', 'BOOL'].includes(u)) return 'boolean';
  if (['JSON', 'JSONB'].includes(u)) return 'Record<string, unknown>';
  if (['DATE', 'TIME', 'TIMETZ', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'].some((t) => u.startsWith(t))) return 'Date';
  if (['BYTEA', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BINARY', 'VARBINARY'].some((t) => u.startsWith(t))) return 'Buffer';
  return 'string';
}

// ── PostgreSQL DDL ────────────────────────────────────────────────────────────

function pgColumnDef(col: ParsedColumn): string {
  const parts: string[] = [`  ${col.physicalName}`, col.type];
  if (col.isPrimaryKey) parts.push('PRIMARY KEY');
  if (col.isNotNull && !col.isPrimaryKey) parts.push('NOT NULL');
  if (col.isUniqueKey && !col.isPrimaryKey) parts.push('UNIQUE');
  if (col.defaultValue) parts.push(`DEFAULT ${fmtDefault(col.defaultValue)}`);
  return parts.join(' ');
}

export function generatePostgresSQL(diagram: ParsedDiagram, includeFk = true): string {
  const lines: string[] = [];

  for (const table of diagram.tables) {
    lines.push(`CREATE TABLE ${table.physicalName} (`);
    const colDefs = table.columns.map(pgColumnDef);
    lines.push(joinDefs(colDefs));
    lines.push(');', '');
  }

  // COMMENT ON TABLE / COLUMN
  const commentLines: string[] = [];
  for (const table of diagram.tables) {
    if (table.logicalName) {
      commentLines.push(`COMMENT ON TABLE ${table.physicalName} IS '${table.logicalName}';`);
    }
    for (const col of table.columns) {
      if (col.logicalName) {
        commentLines.push(`COMMENT ON COLUMN ${table.physicalName}.${col.physicalName} IS '${col.logicalName}';`);
      }
    }
  }
  if (commentLines.length > 0) {
    lines.push('-- Comments', '', ...commentLines, '');
  }

  // FK constraints
  const colMap = buildColMap(diagram);
  const fkLines: string[] = [];
  if (includeFk) for (const table of diagram.tables) {
    for (const col of table.columns) {
      if (!col.isForeignKey || col.referencedColumn == null) continue;
      const ref = colMap.get(col.referencedColumn);
      if (!ref) continue;
      const constraintName = `fk_${table.physicalName}_${col.physicalName}`;
      fkLines.push(
        `ALTER TABLE ${table.physicalName}`,
        `  ADD CONSTRAINT ${constraintName}`,
        `  FOREIGN KEY (${col.physicalName})`,
        `  REFERENCES ${ref.table.physicalName}(${ref.col.physicalName});`,
        ''
      );
    }
  }
  if (fkLines.length > 0) {
    lines.push('-- Foreign Keys', '', ...fkLines);
  }

  return lines.join('\n');
}

// ── MySQL DDL ─────────────────────────────────────────────────────────────────

function mysqlType(sqlType: string): string {
  const u = sqlType.toUpperCase().trim();
  if (u === 'SERIAL') return 'INT AUTO_INCREMENT';
  if (u === 'SMALLSERIAL') return 'SMALLINT AUTO_INCREMENT';
  if (u === 'BIGSERIAL') return 'BIGINT AUTO_INCREMENT';
  if (u === 'BOOLEAN' || u === 'BOOL') return 'TINYINT(1)';
  if (u === 'BYTEA') return 'BLOB';
  if (u === 'TIMESTAMPTZ') return 'TIMESTAMP';
  if (u === 'TIMETZ') return 'TIME';
  if (u === 'TEXT' || u === 'CITEXT') return 'TEXT';
  if (u === 'JSONB') return 'JSON';
  if (u === 'UUID') return 'CHAR(36)';
  if (u === 'DOUBLE PRECISION') return 'DOUBLE';
  return sqlType;
}

function mysqlColumnDef(col: ParsedColumn): string {
  const t = mysqlType(col.type);
  const parts: string[] = [`  \`${col.physicalName}\``, t];
  if (col.isNotNull && !col.isPrimaryKey) parts.push('NOT NULL');
  if (col.isUniqueKey && !col.isPrimaryKey) parts.push('UNIQUE');
  if (col.isPrimaryKey && (t.includes('AUTO_INCREMENT') || col.type.toUpperCase() === 'SERIAL')) {
    parts.push('PRIMARY KEY');
  } else if (col.isPrimaryKey) {
    // PK declared separately
  }
  if (col.defaultValue) parts.push(`DEFAULT ${fmtDefault(col.defaultValue)}`);
  if (col.logicalName) parts.push(`COMMENT '${col.logicalName}'`);
  return parts.join(' ');
}

export function generateMySQLSQL(diagram: ParsedDiagram, includeFk = true): string {
  const lines: string[] = [];
  const mysqlColMap = buildColMap(diagram);

  for (const table of diagram.tables) {
    const comment = table.logicalName ? ` -- ${table.logicalName}` : '';
    lines.push(`CREATE TABLE \`${table.physicalName}\` (${comment}`);
    const defs: string[] = table.columns.map(mysqlColumnDef);

    const pkCols = table.columns.filter((c) => c.isPrimaryKey && !mysqlType(c.type).includes('AUTO_INCREMENT') && c.type.toUpperCase() !== 'SERIAL');
    if (pkCols.length > 0) {
      defs.push(`  PRIMARY KEY (${pkCols.map((c) => `\`${c.physicalName}\``).join(', ')})`);
    }

    if (includeFk) for (const col of table.columns) {
      if (!col.isForeignKey || col.referencedColumn == null) continue;
      const ref = mysqlColMap.get(col.referencedColumn);
      if (!ref) continue;
      defs.push(
        `  CONSTRAINT \`fk_${table.physicalName}_${col.physicalName}\`` +
        ` FOREIGN KEY (\`${col.physicalName}\`) REFERENCES \`${ref.table.physicalName}\`(\`${ref.col.physicalName}\`)`
      );
    }

    lines.push(joinDefs(defs));
    const tableComment = table.logicalName ? ` COMMENT='${table.logicalName}'` : '';
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4${tableComment};`, '');
  }

  return lines.join('\n');
}

// ── SQLite DDL ────────────────────────────────────────────────────────────────

function sqliteType(sqlType: string): string {
  const u = sqlType.toUpperCase().replace(/\(.*\)/, '').trim();
  if (['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
       'SERIAL', 'SMALLSERIAL', 'BIGSERIAL'].some((t) => u.startsWith(t))) return 'INTEGER';
  if (['FLOAT', 'DOUBLE', 'REAL', 'NUMERIC', 'DECIMAL', 'MONEY', 'DOUBLE PRECISION'].some((t) => u.startsWith(t))) return 'REAL';
  if (['BLOB', 'BYTEA', 'BINARY', 'VARBINARY', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'].some((t) => u.startsWith(t))) return 'BLOB';
  return 'TEXT';
}

function sqliteColumnDef(col: ParsedColumn, isOnlyPk: boolean): string {
  const t = sqliteType(col.type);
  const parts: string[] = [`  "${col.physicalName}"`, t];
  if (col.isPrimaryKey && isOnlyPk) {
    const isSerial = ['SERIAL', 'SMALLSERIAL', 'BIGSERIAL', 'INTEGER', 'INT'].some(
      (s) => col.type.toUpperCase().startsWith(s)
    );
    parts.push(isSerial ? 'PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY');
  }
  if (col.isNotNull && !col.isPrimaryKey) parts.push('NOT NULL');
  if (col.isUniqueKey && !col.isPrimaryKey) parts.push('UNIQUE');
  if (col.defaultValue) parts.push(`DEFAULT ${fmtDefault(col.defaultValue)}`);
  const def = parts.join(' ');
  // SQLite has no COMMENT syntax — use -- inline comment
  return col.logicalName ? `${def} -- ${col.logicalName}` : def;
}

export function generateSQLiteSQL(diagram: ParsedDiagram, includeFk = true): string {
  const lines: string[] = [];
  const sqliteColMap = buildColMap(diagram);

  for (const table of diagram.tables) {
    const comment = table.logicalName ? ` -- ${table.logicalName}` : '';
    lines.push(`CREATE TABLE IF NOT EXISTS "${table.physicalName}" (${comment}`);

    const pkCols = table.columns.filter((c) => c.isPrimaryKey);
    const isOnlyPk = pkCols.length === 1;
    const defs: string[] = table.columns.map((c) => sqliteColumnDef(c, isOnlyPk));

    if (!isOnlyPk && pkCols.length > 0) {
      defs.push(`  PRIMARY KEY (${pkCols.map((c) => `"${c.physicalName}"`).join(', ')})`);
    }

    // FK references
    if (includeFk) for (const col of table.columns) {
      if (!col.isForeignKey || col.referencedColumn == null) continue;
      const ref = sqliteColMap.get(col.referencedColumn);
      if (!ref) continue;
      defs.push(
        `  FOREIGN KEY ("${col.physicalName}") REFERENCES "${ref.table.physicalName}"("${ref.col.physicalName}")`
      );
    }

    lines.push(joinDefs(defs));
    lines.push(');', '');
  }

  return lines.join('\n');
}

// ── TypeScript ────────────────────────────────────────────────────────────────

export function generateTypeScript(diagram: ParsedDiagram): string {
  const lines: string[] = [];

  for (const table of diagram.tables) {
    const interfaceName = toPascalCase(table.physicalName);
    if (table.logicalName) lines.push(`/** ${table.logicalName} */`);
    lines.push(`export interface ${interfaceName} {`);

    for (const col of table.columns) {
      const fieldName = toCamelCase(col.physicalName);
      const tsType = sqlTypeToTs(col.type);
      const optional = !col.isPrimaryKey && !col.isNotNull ? '?' : '';
      const badge = col.isPrimaryKey ? ' PK' : col.isForeignKey ? ' FK' : '';
      const comment = [badge, col.logicalName].filter(Boolean).join(' ');
      lines.push(`  ${fieldName}${optional}: ${tsType};${comment ? ` // ${comment}` : ''}`);
    }

    lines.push('}', '');
  }

  return lines.join('\n');
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export function generateJSON(diagram: ParsedDiagram): string {
  const schema = {
    database: diagram.database,
    tables: diagram.tables.map(({ id, physicalName, logicalName, description, columns }) => ({
      id, physicalName, logicalName, description, columns,
    })),
    relations: diagram.relations,
    categories: diagram.categories,
  };
  return JSON.stringify(schema, null, 2);
}
