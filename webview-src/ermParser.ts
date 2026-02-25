import type { ParsedCategory, ParsedColumn, ParsedDiagram, ParsedRelation, ParsedTable } from '../src/types';
import { t } from './i18n';

/** 부모 요소의 직접 자식 중 tag와 일치하는 첫 번째 요소의 텍스트를 반환 */
function childText(parent: Element, tag: string): string {
  for (const child of parent.children) {
    if (child.tagName === tag) return child.textContent?.trim() ?? '';
  }
  return '';
}

function childInt(parent: Element, tag: string): number {
  return parseInt(childText(parent, tag), 10) || 0;
}

function childBool(parent: Element, tag: string): boolean {
  return childText(parent, tag) === 'true';
}

function childrenInt(parent: Element, tag: string): number[] {
  const results: number[] = [];
  for (const child of parent.children) {
    if (child.tagName === tag) {
      const n = parseInt(child.textContent?.trim() ?? '', 10);
      if (!isNaN(n)) results.push(n);
    }
  }
  return results;
}

function childNullableInt(parent: Element, tag: string): number | null {
  const text = childText(parent, tag);
  if (!text || text === 'null') return null;
  const n = parseInt(text, 10);
  return isNaN(n) ? null : n;
}

export function parseErm(xmlString: string): ParsedDiagram {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(t('XML parse error: {0}', parseError.textContent ?? ''));
  }

  const diagramEl = doc.documentElement;
  const database = doc.querySelector('settings > database')?.textContent?.trim() ?? 'PostgreSQL';

  // ── Dictionary (공유 컬럼 정의) ───────────────────────────────────────────
  type WordDef = { physicalName: string; logicalName: string; type: string; description: string };
  const wordMap = new Map<number, WordDef>();

  const dictEl = diagramEl.querySelector('dictionary');
  if (dictEl) {
    for (const wordEl of dictEl.children) {
      if (wordEl.tagName !== 'word') continue;
      const id = childInt(wordEl, 'id');
      wordMap.set(id, {
        physicalName: childText(wordEl, 'physical_name'),
        logicalName: childText(wordEl, 'logical_name'),
        type: childText(wordEl, 'type'),
        description: childText(wordEl, 'description'),
      });
    }
  }

  // ── Tables & Relations ────────────────────────────────────────────────────
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];
  const seenRelations = new Set<number>();

  const contentsEl = diagramEl.querySelector('contents');
  if (!contentsEl) return { database, tables, relations };

  for (const tableEl of contentsEl.children) {
    if (tableEl.tagName !== 'table') continue;

    const tableId = childInt(tableEl, 'id');

    // 관계 파싱 (connections > relation)
    for (const child of tableEl.children) {
      if (child.tagName !== 'connections') continue;
      for (const relEl of child.children) {
        if (relEl.tagName !== 'relation') continue;
        const relId = childInt(relEl, 'id');
        if (!seenRelations.has(relId)) {
          seenRelations.add(relId);
          relations.push({
            id: relId,
            sourceTableId: childInt(relEl, 'source'),
            targetTableId: childInt(relEl, 'target'),
            parentCardinality: childText(relEl, 'parent_cardinality'),
            childCardinality: childText(relEl, 'child_cardinality'),
          });
        }
      }
    }

    // 컬럼 파싱 (columns > normal_column)
    const columns: ParsedColumn[] = [];
    for (const child of tableEl.children) {
      if (child.tagName !== 'columns') continue;
      for (const colEl of child.children) {
        if (colEl.tagName !== 'normal_column') continue;
        const wordId = childInt(colEl, 'word_id');
        const word = wordMap.get(wordId) ?? { physicalName: '', logicalName: '', type: '', description: '' };

        columns.push({
          id: childInt(colEl, 'id'),
          wordId,
          physicalName: childText(colEl, 'physical_name') || word.physicalName,
          logicalName: childText(colEl, 'logical_name') || word.logicalName,
          type: childText(colEl, 'type') || word.type,
          description: childText(colEl, 'description') || word.description,
          isPrimaryKey: childBool(colEl, 'primary_key'),
          isForeignKey: childBool(colEl, 'foreign_key'),
          isNotNull: childBool(colEl, 'not_null'),
          isUniqueKey: childBool(colEl, 'unique_key'),
          referencedColumn: childNullableInt(colEl, 'referenced_column'),
          relationId: childNullableInt(colEl, 'relation'),
        });
      }
    }

    tables.push({
      id: tableId,
      physicalName: childText(tableEl, 'physical_name'),
      logicalName: childText(tableEl, 'logical_name'),
      description: childText(tableEl, 'description'),
      x: childInt(tableEl, 'x'),
      y: childInt(tableEl, 'y'),
      width: childInt(tableEl, 'width') || 120,
      height: childInt(tableEl, 'height') || 75,
      columns,
    });
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const categories: ParsedCategory[] = [];
  const categoryEls = diagramEl.querySelectorAll('category_settings > categories > category');
  categoryEls.forEach((catEl) => {
    categories.push({
      id: childInt(catEl, 'id'),
      name: childText(catEl, 'name'),
      tableIds: childrenInt(catEl, 'node_element'),
    });
  });

  return { database, tables, relations, categories };
}
