import React from 'react';
import { getSmoothStepPath, Position, useNodes, type EdgeProps, type Node } from '@xyflow/react';

export interface ErEdgeData extends Record<string, unknown> {
  parentCardinality: string; // PK 쪽 (target 끝)
  childCardinality: string;  // FK 쪽 (source 끝)
}

const EDGE_COLOR = '#6cb6ff';
const STROKE_W = 1.5;

// Position → 노드에서 에지 방향 단위 벡터 [cos, sin]
function posDir(pos: Position): [number, number] {
  switch (pos) {
    case Position.Right:  return [1, 0];
    case Position.Left:   return [-1, 0];
    case Position.Bottom: return [0, 1];
    case Position.Top:    return [0, -1];
    default:              return [1, 0];
  }
}

// 로컬 좌표(along=에지 방향, perp=수직) → 월드 좌표
function lp(ox: number, oy: number, cos: number, sin: number, along: number, perp: number) {
  return { x: ox + cos * along - sin * perp, y: oy + sin * along + cos * perp };
}

/**
 * 두 노드의 위치/크기를 기반으로 가장 가까운 방향의 연결점을 계산
 */
function computeBestConnection(src: Node, tgt: Node) {
  const sw = (src.measured?.width  as number) ?? 180;
  const sh = (src.measured?.height as number) ?? 75;
  const tw = (tgt.measured?.width  as number) ?? 180;
  const th = (tgt.measured?.height as number) ?? 75;

  const srcCX = src.position.x + sw / 2;
  const srcCY = src.position.y + sh / 2;
  const tgtCX = tgt.position.x + tw / 2;
  const tgtCY = tgt.position.y + th / 2;

  const dx = tgtCX - srcCX;
  const dy = tgtCY - srcCY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // 좌우 연결
    if (dx >= 0) {
      return {
        srcX: src.position.x + sw, srcY: srcCY, srcPos: Position.Right,
        tgtX: tgt.position.x,      tgtY: tgtCY, tgtPos: Position.Left,
      };
    } else {
      return {
        srcX: src.position.x,      srcY: srcCY, srcPos: Position.Left,
        tgtX: tgt.position.x + tw, tgtY: tgtCY, tgtPos: Position.Right,
      };
    }
  } else {
    // 상하 연결
    if (dy >= 0) {
      return {
        srcX: srcCX, srcY: src.position.y + sh, srcPos: Position.Bottom,
        tgtX: tgtCX, tgtY: tgt.position.y,      tgtPos: Position.Top,
      };
    } else {
      return {
        srcX: srcCX, srcY: src.position.y,      srcPos: Position.Top,
        tgtX: tgtCX, tgtY: tgt.position.y + th, tgtPos: Position.Bottom,
      };
    }
  }
}

/**
 * Crow's Foot 표기법 마커
 *
 * 노드에서 바깥(에지)으로 뻗는 방향 기준:
 *   min 마커(x=4): 원=optional(0), 바=mandatory(1)
 *   max 마커(x=10~14): 바=one, 크로우풋(세 선)=many
 *
 *  1    → ||  (bar + bar)
 *  0..1 → O|  (circle + bar)
 *  1..n → |<  (bar + crow's foot)
 *  0..n → O<  (circle + crow's foot)
 */
interface MarkerProps {
  ox: number; oy: number;
  cos: number; sin: number;
  cardinality: string;
}

function CrowsFootMarker({ ox, oy, cos, sin, cardinality }: MarkerProps) {
  const isMany     = cardinality.includes('n');
  const isOptional = cardinality.startsWith('0');

  const p = (along: number, perp: number) => lp(ox, oy, cos, sin, along, perp);
  const g = { stroke: EDGE_COLOR, strokeWidth: STROKE_W, fill: 'none' as const };

  // min 마커 (노드에 가까운 쪽, x=4)
  const minEl = isOptional ? (
    <circle {...g} cx={p(4, 0).x} cy={p(4, 0).y} r={3.5} />
  ) : (() => {
    const a = p(4, 5); const b = p(4, -5);
    return <line {...g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  })();

  // max 마커 (바깥쪽)
  const maxEl = isMany ? (
    // 크로우풋: 버텍스 x=14, 팁 x=8 ±6
    <g>
      {([0, 6, -6] as const).map((spread, i) => {
        const v = p(14, 0); const t = p(8, spread);
        return <line key={i} {...g} x1={v.x} y1={v.y} x2={t.x} y2={t.y} />;
      })}
    </g>
  ) : (() => {
    const a = p(12, 5); const b = p(12, -5);
    return <line {...g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  })();

  return <>{minEl}{maxEl}</>;
}

export function ErEdge({
  id,
  source,
  target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const { parentCardinality = '', childCardinality = '' } = (data ?? {}) as ErEdgeData;

  const nodes = useNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  // 노드 위치가 있으면 동적으로 가장 가까운 방향 계산, 없으면 ReactFlow 기본값 사용
  const conn = sourceNode && targetNode
    ? computeBestConnection(sourceNode, targetNode)
    : null;

  const sx   = conn?.srcX   ?? sourceX;
  const sy   = conn?.srcY   ?? sourceY;
  const sPos = conn?.srcPos ?? sourcePosition;
  const tx   = conn?.tgtX   ?? targetX;
  const ty   = conn?.tgtY   ?? targetY;
  const tPos = conn?.tgtPos ?? targetPosition;

  const [edgePath] = getSmoothStepPath({
    sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
  });

  const [srcCos, srcSin] = posDir(sPos);
  const [tgtCos, tgtSin] = posDir(tPos);

  return (
    <g>
      {/* 에지 선 */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{ stroke: EDGE_COLOR, strokeWidth: STROKE_W, fill: 'none', ...style }}
        markerEnd={markerEnd}
      />

      {/* FK 쪽 (source): childCardinality */}
      {childCardinality && (
        <CrowsFootMarker
          ox={sx} oy={sy}
          cos={srcCos} sin={srcSin}
          cardinality={childCardinality}
        />
      )}

      {/* PK 쪽 (target): parentCardinality */}
      {parentCardinality && (
        <CrowsFootMarker
          ox={tx} oy={ty}
          cos={tgtCos} sin={tgtSin}
          cardinality={parentCardinality}
        />
      )}
    </g>
  );
}
