import { ExtractedQuestion, QuestionCoordinate, QuestionRect } from '../types/question';

export type BboxDebugTarget = 'outer' | 'focus';
export type BboxDebugScope = 'current' | 'page';

export interface BboxPxDelta {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface BboxOffset extends BboxPxDelta {
  target: BboxDebugTarget;
  scope: BboxDebugScope;
}

export interface ImagePixelDimensions {
  baseWidth: number;
  baseHeight: number;
  naturalWidth: number;
  naturalHeight: number;
}

export const DEFAULT_IMAGE_DIMS: ImagePixelDimensions = {
  baseWidth: 700,
  baseHeight: 990,
  naturalWidth: 2481,
  naturalHeight: 3508,
};

export const ZERO_OFFSET_DELTA: BboxPxDelta = {
  dx: 0,
  dy: 0,
  dw: 0,
  dh: 0,
};

export const DEFAULT_BBOX_OFFSET: BboxOffset = {
  ...ZERO_OFFSET_DELTA,
  target: 'outer',
  scope: 'current',
};

export function roundCoord(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundPx(value: number): number {
  return Math.round(value);
}

export function clampCoord(value: number, min = 0, max = 0.995): number {
  return Math.min(max, Math.max(min, roundCoord(value, 4)));
}

export function clampSize(value: number, min = 0.01, max = 1): number {
  return Math.min(max, Math.max(min, roundCoord(value, 4)));
}

export function hasNonZeroDelta(offset?: BboxPxDelta | null): boolean {
  if (!offset) return false;
  return (
    Math.abs(offset.dx) >= 1 ||
    Math.abs(offset.dy) >= 1 ||
    Math.abs(offset.dw) >= 1 ||
    Math.abs(offset.dh) >= 1
  );
}

export function getCoordForPage(
  question: ExtractedQuestion,
  pageNum: number,
): QuestionCoordinate | undefined {
  const matched = question.coordinates?.find((c) => c.page === pageNum);
  if (matched) return matched;
  if (question.pages[0] === pageNum && question.bbox) {
    return {
      page: pageNum,
      x: question.bbox[0],
      y: question.bbox[1],
      w: question.bbox[2],
      h: question.bbox[3],
    };
  }
  return undefined;
}

export function applyPxOffsetToRect(
  rect: QuestionRect,
  offset?: BboxPxDelta | null,
  dims: Pick<ImagePixelDimensions, 'baseWidth' | 'baseHeight'> = DEFAULT_IMAGE_DIMS,
): QuestionRect {
  const safeW = dims.baseWidth > 0 ? dims.baseWidth : DEFAULT_IMAGE_DIMS.baseWidth;
  const safeH = dims.baseHeight > 0 ? dims.baseHeight : DEFAULT_IMAGE_DIMS.baseHeight;
  if (!offset || !hasNonZeroDelta(offset)) {
    return {
      x: roundCoord(rect.x, 4),
      y: roundCoord(rect.y, 4),
      w: roundCoord(rect.w, 4),
      h: roundCoord(rect.h, 4),
    };
  }
  return {
    x: clampCoord(rect.x + offset.dx / safeW),
    y: clampCoord(rect.y + offset.dy / safeH),
    w: clampSize(rect.w + offset.dw / safeW),
    h: clampSize(rect.h + offset.dh / safeH),
  };
}

export function formatSignedPx(value: number): string {
  const rounded = roundPx(value);
  if (rounded === 0) return '0px';
  return `${rounded > 0 ? '+' : ''}${rounded}px`;
}

export function makeOffsetStorageKey(
  questionId: string,
  pageNum: number,
  target: BboxDebugTarget,
): string {
  return `${questionId}-p${pageNum}-${target}`;
}
