import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Crosshair, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { ExtractedQuestion, QuestionRect } from '../types/question';
import {
  applyPxOffsetToRect,
  BboxDebugScope,
  BboxDebugTarget,
  BboxOffset,
  DEFAULT_IMAGE_DIMS,
  formatSignedPx,
  getCoordForPage,
  hasNonZeroDelta,
  ImagePixelDimensions,
  roundPx,
} from '../utils/bboxDebug';

interface BboxDebugPanelProps {
  question: ExtractedQuestion;
  activePage: number;
  imageDims?: ImagePixelDimensions;
  offset: BboxOffset;
  savedCount?: number;
  onChangeOffset: (next: BboxOffset) => void;
  onResetOffset: () => void;
  onResetAllOffsets?: () => void;
  onClose: () => void;
}

type AxisKey = 'dx' | 'dy' | 'dw' | 'dh';

const AXES: {
  key: AxisKey;
  shortLabel: string;
  label: string;
  rectKey: keyof QuestionRect;
  primary?: boolean;
}[] = [
  { key: 'dx', shortLabel: 'X', label: 'X 오프셋', rectKey: 'x', primary: true },
  { key: 'dy', shortLabel: 'Y', label: 'Y 오프셋', rectKey: 'y', primary: true },
  { key: 'dw', shortLabel: 'W', label: '너비 (W)', rectKey: 'w' },
  { key: 'dh', shortLabel: 'H', label: '높이 (H)', rectKey: 'h' },
];

export const BboxDebugPanel: React.FC<BboxDebugPanelProps> = ({
  question,
  activePage,
  imageDims = DEFAULT_IMAGE_DIMS,
  offset,
  savedCount = 0,
  onChangeOffset,
  onResetOffset,
  onResetAllOffsets,
  onClose,
}) => {
  const [stepPx, setStepPx] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const [inputDrafts, setInputDrafts] = useState<Record<AxisKey, string>>({
    dx: String(offset.dx),
    dy: String(offset.dy),
    dw: String(offset.dw),
    dh: String(offset.dh),
  });

  useEffect(() => {
    setInputDrafts({
      dx: String(offset.dx),
      dy: String(offset.dy),
      dw: String(offset.dw),
      dh: String(offset.dh),
    });
  }, [offset.dx, offset.dy, offset.dw, offset.dh, question.id, activePage, offset.target, offset.scope]);

  const pageCoord = useMemo(
    () => getCoordForPage(question, activePage),
    [question, activePage],
  );

  const hasFocus = Boolean(pageCoord?.focus);
  const effectiveTarget: BboxDebugTarget =
    offset.target === 'focus' && hasFocus ? 'focus' : 'outer';

  const baseOuter: QuestionRect = useMemo(
    () => ({
      x: pageCoord?.x ?? question.bbox[0],
      y: pageCoord?.y ?? question.bbox[1],
      w: pageCoord?.w ?? question.bbox[2],
      h: pageCoord?.h ?? question.bbox[3],
    }),
    [pageCoord, question.bbox],
  );

  const baseFocus: QuestionRect | undefined = pageCoord?.focus
    ? {
        x: pageCoord.focus.x,
        y: pageCoord.focus.y,
        w: pageCoord.focus.w,
        h: pageCoord.focus.h,
      }
    : undefined;

  const activeBaseRect =
    effectiveTarget === 'focus' && baseFocus ? baseFocus : baseOuter;
  const activeAdjustedRect = applyPxOffsetToRect(activeBaseRect, offset, imageDims);

  const finalOuter =
    effectiveTarget === 'outer'
      ? applyPxOffsetToRect(baseOuter, offset, imageDims)
      : baseOuter;
  const finalFocus = baseFocus
    ? effectiveTarget === 'focus'
      ? applyPxOffsetToRect(baseFocus, offset, imageDims)
      : baseFocus
    : undefined;

  const isDirty = hasNonZeroDelta(offset);

  const commitPxDelta = (key: AxisKey, rawVal: number) => {
    if (!Number.isFinite(rawVal)) return;
    const clamped = Math.min(600, Math.max(-600, roundPx(rawVal)));
    onChangeOffset({
      ...offset,
      [key]: clamped,
    });
  };

  const handleNumericInputChange = (key: AxisKey, rawStr: string) => {
    setInputDrafts((prev) => ({ ...prev, [key]: rawStr }));
    const trimmed = rawStr.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '+') {
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      commitPxDelta(key, parsed);
    }
  };

  const handleNumericInputBlur = (key: AxisKey) => {
    const trimmed = inputDrafts[key].trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '+') {
      commitPxDelta(key, 0);
      setInputDrafts((prev) => ({ ...prev, [key]: '0' }));
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(600, Math.max(-600, roundPx(parsed)));
      commitPxDelta(key, clamped);
      setInputDrafts((prev) => ({ ...prev, [key]: String(clamped) }));
    } else {
      setInputDrafts((prev) => ({ ...prev, [key]: String(offset[key]) }));
    }
  };

  const handleCopyJson = async () => {
    const payload = {
      id: question.id,
      page: activePage,
      pxOffset: {
        dx: offset.dx,
        dy: offset.dy,
        dw: offset.dw,
        dh: offset.dh,
        baseWidthPx: Math.round(imageDims.baseWidth),
        baseHeightPx: Math.round(imageDims.baseHeight),
      },
      bbox: [finalOuter.x, finalOuter.y, finalOuter.w, finalOuter.h],
      coordinate: {
        page: activePage,
        x: finalOuter.x,
        y: finalOuter.y,
        w: finalOuter.w,
        h: finalOuter.h,
        ...(finalFocus ? { focus: finalFocus } : {}),
      },
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted iframe
    }
  };

  return (
    <div
      role="region"
      aria-label="좌표 오프셋 제어 패널"
      className="rounded-2xl border-2 border-[#FDA4AF] bg-[#FFF1F2]/95 px-3.5 py-3 shadow-xs space-y-2.5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E11D48] text-white text-xs font-extrabold">
            <Crosshair className="w-3.5 h-3.5" />
            <span>좌표 오프셋 제어 패널</span>
          </span>
          <span className="text-xs font-mono font-extrabold text-[#881337] bg-white px-2 py-0.5 rounded-lg border border-[#FECDD3] tabular-nums">
            {question.id} · {question.originalItemNumber} · {activePage}p
          </span>
          <span className="hidden sm:inline text-[11px] font-mono font-bold text-[#9F1239]/80 tabular-nums">
            기준 {Math.round(imageDims.baseWidth)}×{Math.round(imageDims.baseHeight)}px
          </span>

          {hasFocus && (
            <div className="inline-flex items-center rounded-lg border border-[#FECDD3] bg-white p-0.5 gap-0.5">
              {(['focus', 'outer'] as BboxDebugTarget[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChangeOffset({ ...offset, target: t })}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                    effectiveTarget === t
                      ? 'bg-[#E11D48] text-white'
                      : 'text-[#881337] hover:bg-[#FFF1F2]'
                  }`}
                >
                  {t === 'focus' ? '문항 focus' : '세트 outer'}
                </button>
              ))}
            </div>
          )}

          <div className="inline-flex items-center rounded-lg border border-[#FECDD3] bg-white p-0.5 gap-0.5">
            {(
              [
                { id: 'current', label: '개별 문항' },
                { id: 'page', label: '페이지 전체' },
              ] as { id: BboxDebugScope; label: string }[]
            ).map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => onChangeOffset({ ...offset, scope: sc.id })}
                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                  offset.scope === sc.id
                    ? 'bg-[#1E293B] text-white'
                    : 'text-[#64748B] hover:bg-slate-100'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-[#FECDD3] bg-white p-0.5 gap-0.5">
            <span className="px-1.5 text-[10px] font-bold text-[#9F1239]">증감</span>
            {[1, 5, 10].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStepPx(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer tabular-nums ${
                  stepPx === s
                    ? 'bg-[#FFE4E6] text-[#9F1239]'
                    : 'text-[#64748B] hover:bg-slate-100'
                }`}
              >
                {s}px
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onResetOffset}
            disabled={!isDirty}
            className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white border border-[#FECDD3] text-[#881337] hover:bg-[#FFE4E6] disabled:opacity-45 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>

          {onResetAllOffsets && savedCount > 1 && (
            <button
              type="button"
              onClick={onResetAllOffsets}
              className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white border border-[#FECDD3] text-[#881337] hover:bg-[#FFE4E6] text-xs font-extrabold cursor-pointer"
            >
              전체 초기화 ({savedCount})
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyJson}
            className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              copied
                ? 'bg-[#DCFCE7] border-[#4ADE80] text-[#166534]'
                : 'bg-white border-[#FECDD3] text-[#881337] hover:bg-[#FFE4E6]'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨!' : '좌표 복사'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="좌표 오프셋 제어 패널 닫기"
            className="w-7 h-7 rounded-lg bg-white border border-[#FECDD3] text-[#881337] hover:bg-[#FFE4E6] flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Numeric 1px Precision Input Controls (X, Y, W, H) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {AXES.map((axis) => {
          const deltaPx = offset[axis.key];
          const baseRatio = activeBaseRect[axis.rectKey];
          const finalRatio = activeAdjustedRect[axis.rectKey];
          const dimTotal =
            axis.rectKey === 'x' || axis.rectKey === 'w'
              ? imageDims.baseWidth
              : imageDims.baseHeight;
          const basePx = Math.round(baseRatio * dimTotal);
          const finalPx = basePx + deltaPx;

          return (
            <div
              key={axis.key}
              className={`rounded-xl border bg-white px-2.5 py-2 space-y-1.5 ${
                axis.primary ? 'border-[#FDA4AF]' : 'border-[#FECDD3]'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                <span className="font-sans font-extrabold text-[#881337]">
                  {axis.label}
                </span>
                <span className="tabular-nums text-[#475569]">
                  {basePx}px →{' '}
                  <strong className={deltaPx !== 0 ? 'text-[#E11D48]' : 'text-[#0F172A]'}>
                    {finalPx}px
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => commitPxDelta(axis.key, deltaPx - stepPx)}
                  aria-label={`${axis.label} ${stepPx}px 감소`}
                  title={`-${stepPx}px`}
                  className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFE4E6] hover:border-[#FDA4AF] text-[#334155] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex-1 min-w-0">
                  <input
                    type="number"
                    step={1}
                    min={-600}
                    max={600}
                    value={inputDrafts[axis.key]}
                    onChange={(e) => handleNumericInputChange(axis.key, e.target.value)}
                    onBlur={() => handleNumericInputBlur(axis.key)}
                    aria-label={`${axis.label} 픽셀 숫자 입력`}
                    className="w-full h-8 pl-2 pr-7 rounded-lg border-2 border-[#E2E8F0] focus:border-[#E11D48] bg-white text-sm font-mono font-extrabold text-right text-[#0F172A] tabular-nums focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-[#94A3B8]">
                    px
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => commitPxDelta(axis.key, deltaPx + stepPx)}
                  aria-label={`${axis.label} ${stepPx}px 증가`}
                  title={`+${stepPx}px`}
                  className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FFE4E6] hover:border-[#FDA4AF] text-[#334155] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] tabular-nums">
                <span>비율: {finalRatio.toFixed(4)}</span>
                <span className={deltaPx !== 0 ? 'text-[#E11D48] font-bold' : ''}>
                  {formatSignedPx(deltaPx)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Output Preview Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#881337] bg-white/85 rounded-xl border border-[#FECDD3] px-2.5 py-1.5">
        <span className="truncate">
          {effectiveTarget === 'focus' && finalFocus
            ? `focus: { x: ${finalFocus.x.toFixed(4)}, y: ${finalFocus.y.toFixed(4)}, w: ${finalFocus.w.toFixed(4)}, h: ${finalFocus.h.toFixed(4)} }`
            : `bbox: [${finalOuter.x.toFixed(4)}, ${finalOuter.y.toFixed(4)}, ${finalOuter.w.toFixed(4)}, ${finalOuter.h.toFixed(4)}]`}
        </span>
        <span className="tabular-nums text-[#9F1239] shrink-0">
          오프셋: x {formatSignedPx(offset.dx)} · y {formatSignedPx(offset.dy)} · w{' '}
          {formatSignedPx(offset.dw)} · h {formatSignedPx(offset.dh)}
        </span>
      </div>
    </div>
  );
};
