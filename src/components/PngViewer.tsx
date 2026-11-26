import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Eraser,
  ExternalLink,
  FileImage,
  Highlighter,
  PenTool,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PAGE_ASSETS } from '../data/pages';
import { EXTRACTED_QUESTIONS } from '../data/questions';
import { QuestionRect } from '../types/question';
import {
  applyPxOffsetToRect,
  BboxOffset,
  BboxPxDelta,
  DEFAULT_IMAGE_DIMS,
  formatSignedPx,
  getCoordForPage,
  hasNonZeroDelta,
  ImagePixelDimensions,
  makeOffsetStorageKey,
} from '../utils/bboxDebug';

interface PngViewerProps {
  pages: number[];
  targetExamLabel?: string;
  targetQuestionId?: string;
  islandTheme?: 'spring' | 'lavender';
  bboxDebug?: boolean;
  bboxOffset?: BboxOffset;
  offsetsByKey?: Record<string, BboxPxDelta>;
  onActivePageChange?: (page: number) => void;
  onImageDimensionsChange?: (dims: ImagePixelDimensions) => void;
  onSelectDebugQuestion?: (questionId: string) => void;
}

type DrawTool = 'off' | 'highlight' | 'pen';

interface StrokePath {
  id: string;
  kind: 'highlight' | 'pen';
  points: [number, number][];
}

interface DebugBoxItem {
  id: string;
  globalIndex: number;
  originalItemNumber: string;
  isActive: boolean;
  rank: number;
  total: number;
  rawOuter: QuestionRect;
  rawFocus?: QuestionRect;
  outer: QuestionRect;
  focus?: QuestionRect;
  outerDelta: BboxPxDelta | null;
  focusDelta: BboxPxDelta | null;
  outerAdjusted: boolean;
  focusAdjusted: boolean;
}

function rectToCalcStyle(
  rect: QuestionRect,
  delta?: BboxPxDelta | null,
  zoomPct = 100,
): React.CSSProperties {
  const scale = zoomPct / 100;
  const dx = delta ? Math.round(delta.dx * scale * 100) / 100 : 0;
  const dy = delta ? Math.round(delta.dy * scale * 100) / 100 : 0;
  const dw = delta ? Math.round(delta.dw * scale * 100) / 100 : 0;
  const dh = delta ? Math.round(delta.dh * scale * 100) / 100 : 0;

  return {
    left:
      dx === 0
        ? `${(rect.x * 100).toFixed(3)}%`
        : `calc(${(rect.x * 100).toFixed(3)}% + ${dx}px)`,
    top:
      dy === 0
        ? `${(rect.y * 100).toFixed(3)}%`
        : `calc(${(rect.y * 100).toFixed(3)}% + ${dy}px)`,
    width:
      dw === 0
        ? `${(rect.w * 100).toFixed(3)}%`
        : `calc(${(rect.w * 100).toFixed(3)}% + ${dw}px)`,
    height:
      dh === 0
        ? `${(rect.h * 100).toFixed(3)}%`
        : `calc(${(rect.h * 100).toFixed(3)}% + ${dh}px)`,
  };
}

export const PngViewer: React.FC<PngViewerProps> = ({
  pages,
  targetExamLabel,
  targetQuestionId,
  islandTheme = 'spring',
  bboxDebug = false,
  bboxOffset,
  offsetsByKey,
  onActivePageChange,
  onImageDimensionsChange,
  onSelectDebugQuestion,
}) => {
  const isLavender = islandTheme === 'lavender';
  const [activePage, setActivePage] = useState<number>(pages[0] ?? 1);
  const [zoom, setZoom] = useState<number>(100);
  const [imgError, setImgError] = useState<boolean>(false);
  const [imgDims, setImgDims] = useState<ImagePixelDimensions>(DEFAULT_IMAGE_DIMS);
  const [drawTool, setDrawTool] = useState<DrawTool>('off');
  const [strokesByKey, setStrokesByKey] = useState<Record<string, StrokePath[]>>({});
  const [activeStroke, setActiveStroke] = useState<StrokePath | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);

  const measureImageDims = useCallback(() => {
    const imgEl = imgRef.current;
    if (!imgEl || imgEl.clientWidth <= 0 || imgEl.clientHeight <= 0) return;
    const scale = zoom / 100;
    const next: ImagePixelDimensions = {
      baseWidth: Math.round((imgEl.clientWidth / scale) * 10) / 10,
      baseHeight: Math.round((imgEl.clientHeight / scale) * 10) / 10,
      naturalWidth: imgEl.naturalWidth || DEFAULT_IMAGE_DIMS.naturalWidth,
      naturalHeight: imgEl.naturalHeight || DEFAULT_IMAGE_DIMS.naturalHeight,
    };
    setImgDims((prev) => {
      if (
        Math.abs(prev.baseWidth - next.baseWidth) < 0.5 &&
        Math.abs(prev.baseHeight - next.baseHeight) < 0.5 &&
        prev.naturalWidth === next.naturalWidth
      ) {
        return prev;
      }
      return next;
    });
    onImageDimensionsChange?.(next);
  }, [zoom, onImageDimensionsChange]);

  useEffect(() => {
    const imgEl = imgRef.current;
    if (!imgEl) return;
    measureImageDims();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureImageDims());
    ro.observe(imgEl);
    return () => ro.disconnect();
  }, [activePage, zoom, imgError, measureImageDims]);

  useEffect(() => {
    const nextPage = pages[0] ?? 1;
    setActivePage(nextPage);
    setImgError(false);
    setActiveStroke(null);
  }, [pages, targetQuestionId]);

  useEffect(() => {
    onActivePageChange?.(activePage);
  }, [activePage, onActivePageChange]);

  const asset = PAGE_ASSETS.find((p) => p.page === activePage) ?? PAGE_ASSETS[0];
  const strokeStorageKey = `${targetQuestionId ?? 'sheet'}-p${activePage}`;
  const currentStrokes = strokesByKey[strokeStorageKey] ?? [];

  const pageDebugBoxes = useMemo<DebugBoxItem[]>(() => {
    const pageQuestions = EXTRACTED_QUESTIONS.filter((q) => q.pages.includes(activePage))
      .slice()
      .sort((a, b) => {
        const ca = getCoordForPage(a, activePage);
        const cb = getCoordForPage(b, activePage);
        const ya = ca?.focus?.y ?? ca?.y ?? 0;
        const yb = cb?.focus?.y ?? cb?.y ?? 0;
        return ya - yb;
      });

    const total = Math.max(1, pageQuestions.length);

    return pageQuestions.map((q, idx) => {
      const exact = getCoordForPage(q, activePage);
      const rawOuter: QuestionRect = {
        x: exact?.x ?? q.bbox?.[0] ?? 0.066,
        y: exact?.y ?? q.bbox?.[1] ?? 0.04,
        w: exact?.w ?? q.bbox?.[2] ?? 0.866,
        h: exact?.h ?? q.bbox?.[3] ?? 0.24,
      };
      const rawFocus: QuestionRect | undefined = exact?.focus
        ? {
            x: exact.focus.x,
            y: exact.focus.y,
            w: exact.focus.w,
            h: exact.focus.h,
          }
        : undefined;

      const isActive = q.id === targetQuestionId;

      let outerDelta: BboxPxDelta | null = null;
      let focusDelta: BboxPxDelta | null = null;

      if (offsetsByKey) {
        const savedOuter = offsetsByKey[makeOffsetStorageKey(q.id, activePage, 'outer')];
        if (savedOuter && hasNonZeroDelta(savedOuter)) {
          outerDelta = savedOuter;
        }
        if (rawFocus) {
          const savedFocus = offsetsByKey[makeOffsetStorageKey(q.id, activePage, 'focus')];
          if (savedFocus && hasNonZeroDelta(savedFocus)) {
            focusDelta = savedFocus;
          }
        }
      }

      if (bboxOffset && hasNonZeroDelta(bboxOffset)) {
        const effectiveTarget: 'outer' | 'focus' =
          bboxOffset.target === 'focus' && rawFocus ? 'focus' : 'outer';
        if (bboxOffset.scope === 'page' || isActive) {
          const activeDelta: BboxPxDelta = {
            dx: bboxOffset.dx,
            dy: bboxOffset.dy,
            dw: bboxOffset.dw,
            dh: bboxOffset.dh,
          };
          if (effectiveTarget === 'outer') {
            outerDelta = activeDelta;
          } else if (rawFocus) {
            focusDelta = activeDelta;
          }
        }
      }

      const outerAdjusted = hasNonZeroDelta(outerDelta);
      const focusAdjusted = Boolean(rawFocus) && hasNonZeroDelta(focusDelta);

      return {
        id: q.id,
        globalIndex: q.globalIndex,
        originalItemNumber: q.originalItemNumber,
        isActive,
        rank: idx + 1,
        total,
        rawOuter,
        rawFocus,
        outer: outerAdjusted ? applyPxOffsetToRect(rawOuter, outerDelta, imgDims) : rawOuter,
        focus: rawFocus
          ? focusAdjusted
            ? applyPxOffsetToRect(rawFocus, focusDelta, imgDims)
            : rawFocus
          : undefined,
        outerDelta,
        focusDelta,
        outerAdjusted,
        focusAdjusted,
      };
    });
  }, [activePage, targetQuestionId, bboxOffset, offsetsByKey, imgDims]);

  const activeDebugBox = useMemo(
    () => pageDebugBoxes.find((b) => b.isActive) ?? null,
    [pageDebugBoxes],
  );

  const anchorInfo = useMemo(() => {
    if (!activeDebugBox) return null;
    return {
      rawOuter: activeDebugBox.rawOuter,
      rawFocus: activeDebugBox.rawFocus,
      outerDelta: activeDebugBox.outerDelta,
      focusDelta: activeDebugBox.focusDelta,
      x: activeDebugBox.outer.x,
      y: activeDebugBox.outer.y,
      w: activeDebugBox.outer.w,
      h: activeDebugBox.outer.h,
      focus: activeDebugBox.focus,
      rank: activeDebugBox.rank,
      total: activeDebugBox.total,
    };
  }, [activeDebugBox]);

  const scrollTargetRef = useRef<{ y: number; focusY?: number } | null>(null);
  scrollTargetRef.current = anchorInfo
    ? { y: anchorInfo.y, focusY: anchorInfo.focus?.y }
    : null;

  const scrollToQuestionAnchor = useCallback((smooth = true) => {
    const el = scrollRef.current;
    const imgEl = imgRef.current;
    const target = scrollTargetRef.current;
    if (!el || !imgEl || !target) return;
    const imgRect = imgEl.getBoundingClientRect();
    if (imgRect.height <= 0) return;
    const containerRect = el.getBoundingClientRect();
    const imgTopInScroll = imgRect.top - containerRect.top + el.scrollTop;
    const targetRatioY =
      target.focusY !== undefined && imgRect.height > el.clientHeight * 1.15
        ? Math.max(target.y, target.focusY - 0.18)
        : target.y;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const targetTop = Math.min(
      maxScroll,
      Math.max(
        0,
        Math.round(imgTopInScroll + imgRect.height * Math.max(0, targetRatioY - 0.025)),
      ),
    );
    el.scrollTo({
      top: targetTop,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (!scrollTargetRef.current) return;
    const t = window.setTimeout(() => {
      scrollToQuestionAnchor(true);
    }, 180);
    return () => window.clearTimeout(t);
  }, [activePage, targetQuestionId, zoom, scrollToQuestionAnchor]);

  const getNormalizedPoint = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = svgOverlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
    const x = Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000));
    const y = Math.max(0, Math.min(1414, ((e.clientY - rect.top) / rect.height) * 1414));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawTool === 'off') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    setActiveStroke({
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: drawTool,
      points: [pt],
    });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeStroke || drawTool === 'off') return;
    e.preventDefault();
    const pt = getNormalizedPoint(e);
    setActiveStroke((prev) => {
      if (!prev) return null;
      const last = prev.points[prev.points.length - 1];
      if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 2.2) return prev;
      return { ...prev, points: [...prev.points, pt] };
    });
  };

  const finishStroke = () => {
    if (!activeStroke) return;
    const finalized =
      activeStroke.points.length === 1
        ? { ...activeStroke, points: [activeStroke.points[0], [activeStroke.points[0][0] + 1, activeStroke.points[0][1]]] as [number, number][] }
        : activeStroke;
    setStrokesByKey((prev) => ({
      ...prev,
      [strokeStorageKey]: [...(prev[strokeStorageKey] ?? []), finalized],
    }));
    setActiveStroke(null);
  };

  const handleUndoStroke = () => {
    setStrokesByKey((prev) => {
      const list = prev[strokeStorageKey] ?? [];
      if (list.length === 0) return prev;
      return { ...prev, [strokeStorageKey]: list.slice(0, -1) };
    });
  };

  const handleClearStrokes = () => {
    setStrokesByKey((prev) => {
      const next = { ...prev };
      delete next[strokeStorageKey];
      return next;
    });
  };

  const toPolylinePoints = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div
      className={`flex flex-col h-full min-w-0 bg-white border-2 rounded-2xl overflow-hidden shadow-xs ${
        isLavender ? 'border-[#C6BEE8]' : 'border-[#EAE0D0]'
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b-2 ${
          isLavender
            ? 'border-[#D5CFF0] bg-[#F4F2FC]'
            : 'border-[#EAE0D0] bg-[#FFF9EF]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-sm sm:text-base font-extrabold whitespace-nowrap ${
              isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'
            }`}
          >
            시험지
          </span>
          <span className={isLavender ? 'text-[#B4AFDA]' : 'text-[#C8B9A6]'} aria-hidden="true">
            ·
          </span>
          <span
            className={`text-sm font-mono font-bold tabular-nums ${
              isLavender ? 'text-[#4A467A]' : 'text-[#5C4D42]'
            }`}
          >
            {asset.page}p / 18p
          </span>
          {targetExamLabel && (
            <>
              <span className={isLavender ? 'text-[#B4AFDA]' : 'text-[#C8B9A6]'} aria-hidden="true">
                ·
              </span>
              <span
                className={`text-sm font-extrabold truncate ${
                  isLavender ? 'text-[#5B48A3]' : 'text-[#8C6445]'
                }`}
              >
                {targetExamLabel}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {pages.length > 1 && (
            <div
              className={`flex items-center gap-1 p-1 rounded-xl ${
                isLavender ? 'bg-[#E5E1F8]' : 'bg-[#EFE6D8]'
              }`}
            >
              {pages.map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => {
                    setActivePage(pageNum);
                    setImgError(false);
                  }}
                  className={`min-h-[36px] px-2.5 py-1 text-xs sm:text-sm font-extrabold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                    activePage === pageNum
                      ? 'bg-white text-[#1D1B42] shadow-xs'
                      : isLavender
                        ? 'text-[#4A467A] hover:text-[#1D1B42]'
                        : 'text-[#5C4D42] hover:text-[#2D2620]'
                  }`}
                >
                  {pageNum}p
                </button>
              ))}
            </div>
          )}

          {anchorInfo && (
            <button
              type="button"
              onClick={() => scrollToQuestionAnchor(true)}
              title="이 문항 위치로 바로 이동"
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                isLavender
                  ? 'bg-[#EDE9FE] border-[#7963A8] text-[#2F1F63] hover:bg-[#DFD7FA]'
                  : 'bg-[#FFE18A]/55 border-[#D4A72C] text-[#4B3200] hover:bg-[#FFE18A]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>위치</span>
            </button>
          )}

          {/* Lightweight Highlighter / Underline Pen Controls */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
              isLavender ? 'bg-white border-[#C6BEE8]' : 'bg-white border-[#EAE0D0]'
            }`}
          >
            <button
              type="button"
              onClick={() => setDrawTool((t) => (t === 'highlight' ? 'off' : 'highlight'))}
              title="형광펜으로 단서 표시 (다시 누르면 스크롤 모드)"
              aria-pressed={drawTool === 'highlight'}
              className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                drawTool === 'highlight'
                  ? 'bg-[#FFE18A] text-[#4B3200]'
                  : 'text-[#5C4D42] hover:bg-[#F6F5FC]'
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden md:inline">형광펜</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawTool((t) => (t === 'pen' ? 'off' : 'pen'))}
              title="밑줄·메모 펜 (다시 누르면 스크롤 모드)"
              aria-pressed={drawTool === 'pen'}
              className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                drawTool === 'pen'
                  ? 'bg-[#DDF4FF] text-[#143752]'
                  : 'text-[#5C4D42] hover:bg-[#F6F5FC]'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="hidden md:inline">밑줄</span>
            </button>
            {currentStrokes.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleUndoStroke}
                  title="마지막 표시 되돌리기"
                  aria-label="마지막 표시 되돌리기"
                  className="min-h-[32px] px-1.5 py-1 rounded-lg text-[#5C4D42] hover:bg-[#F6F5FC] cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearStrokes}
                  title="표시 모두 지우기"
                  aria-label="표시 모두 지우기"
                  className="min-h-[32px] px-1.5 py-1 rounded-lg text-[#C25D44] hover:bg-[#FFDFE0] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <div
            className={`hidden sm:flex items-center gap-1 p-1 rounded-xl ${
              isLavender ? 'bg-[#E5E1F8]' : 'bg-[#EFE6D8]'
            }`}
          >
            {[100, 135, 165].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setZoom(preset)}
                className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-extrabold tabular-nums cursor-pointer transition-colors ${
                  zoom === preset
                    ? 'bg-white text-[#1D1B42] shadow-xs'
                    : isLavender
                      ? 'text-[#4A467A] hover:text-[#1D1B42]'
                      : 'text-[#5C4D42] hover:text-[#2D2620]'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>

          <div
            className={`flex items-center border-2 rounded-xl bg-white overflow-hidden ${
              isLavender ? 'border-[#C6BEE8]' : 'border-[#EAE0D0]'
            }`}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(70, z - 15))}
              aria-label="축소"
              className="min-h-[36px] min-w-[34px] p-1.5 text-[#4A443E] hover:text-[#1D1B42] hover:bg-[#F6F5FC] transition-colors cursor-pointer flex items-center justify-center"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span
              className={`px-2 text-xs font-mono font-bold tabular-nums border-x ${
                isLavender
                  ? 'text-[#1D1B42] border-[#D5CFF0]'
                  : 'text-[#2D2620] border-[#EAE0D0]'
              }`}
            >
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 15))}
              aria-label="확대"
              className="min-h-[36px] min-w-[34px] p-1.5 text-[#4A443E] hover:text-[#1D1B42] hover:bg-[#F6F5FC] transition-colors cursor-pointer flex items-center justify-center"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              aria-label="원본 배율"
              className={`min-h-[36px] min-w-[34px] p-1.5 text-[#4A443E] hover:text-[#1D1B42] hover:bg-[#F6F5FC] transition-colors border-l cursor-pointer flex items-center justify-center ${
                isLavender ? 'border-[#D5CFF0]' : 'border-[#EAE0D0]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className={`min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold bg-white border-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
              isLavender
                ? 'text-[#1D1B42] border-[#C6BEE8] hover:bg-[#EFEBF9]'
                : 'text-[#2D2620] border-[#EAE0D0] hover:bg-[#FFF9EF]'
            }`}
          >
            <span>새 탭</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {bboxDebug && (
        <div className="px-4 py-1.5 text-[11px] font-mono font-bold border-b border-[#FDA4AF] bg-[#FFF1F2] text-[#9F1239] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-[#E11D48] text-white font-extrabold">
              BBOX DEBUG
            </span>
            <span>
              {asset.page}p · 문항 {pageDebugBoxes.length}개
            </span>
            {activeDebugBox && (
              <span className="text-[#881337]">
                · 활성: {activeDebugBox.id} ({activeDebugBox.originalItemNumber})
              </span>
            )}
          </div>
          {onSelectDebugQuestion && (
            <span className="text-[#9F1239]/80">
              파란 테두리 클릭 시 해당 문항으로 이동
            </span>
          )}
        </div>
      )}

      {drawTool !== 'off' && (
        <div
          className={`px-4 py-1.5 text-xs font-bold border-b flex items-center justify-between gap-2 ${
            isLavender
              ? 'bg-[#EAE3FA] border-[#C9C2E8] text-[#26184D]'
              : 'bg-[#FFF6DA] border-[#E0B94B] text-[#5C3D00]'
          }`}
        >
          <span>
            {drawTool === 'highlight'
              ? '형광펜 모드 켜짐 — 시험지 위 단서에 드래그해 표시하세요'
              : '밑줄 펜 모드 켜짐 — 핵심 어구에 밑줄을 그어 보세요'}
          </span>
          <button
            type="button"
            onClick={() => setDrawTool('off')}
            className="underline font-extrabold cursor-pointer shrink-0"
          >
            스크롤 모드로 전환
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto p-4 min-h-[440px] ${
          isLavender ? 'bg-[#ECEAF8]' : 'bg-[#F5EFE4]'
        }`}
      >
        {imgError ? (
          <div className="flex flex-col items-center justify-center p-10 text-center bg-white border-2 border-[#EAE0D0] rounded-2xl max-w-sm mx-auto my-auto">
            <FileImage className="w-8 h-8 text-[#9B785D] mb-3" />
            <p className="text-base font-bold text-[#2D2620]">
              {asset.page}페이지 이미지를 불러오지 못했습니다
            </p>
            <p className="text-sm text-[#6E5E52] mt-1 font-mono break-all">
              {asset.filename}
            </p>
          </div>
        ) : (
          <div
            style={{ width: `${zoom}%` }}
            className="relative mx-auto transition-[width] duration-150 ease-out origin-top max-w-none select-none"
          >
            <img
              ref={imgRef}
              src={asset.url}
              alt={`중학 영어 복습 독해편 ${asset.page}페이지 원본`}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => {
                measureImageDims();
                scrollToQuestionAnchor(false);
              }}
              onError={() => setImgError(true)}
              className="w-full h-auto rounded-lg border border-[#EAE0D0] bg-white shadow-xs block"
            />

            {/* Zoom-Synchronized SVG Annotation Overlay */}
            <svg
              ref={svgOverlayRef}
              viewBox="0 0 1000 1414"
              preserveAspectRatio="none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              className={`absolute inset-0 w-full h-full rounded-lg ${
                drawTool !== 'off'
                  ? 'pointer-events-auto cursor-crosshair touch-none z-10'
                  : 'pointer-events-none z-10'
              }`}
            >
              {[...currentStrokes, ...(activeStroke ? [activeStroke] : [])].map((st) => (
                <polyline
                  key={st.id}
                  fill="none"
                  stroke={st.kind === 'highlight' ? '#FFE14D' : '#1CB0F6'}
                  strokeOpacity={st.kind === 'highlight' ? 0.45 : 0.85}
                  strokeWidth={st.kind === 'highlight' ? 22 : 4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={toPolylinePoints(st.points)}
                />
              ))}
            </svg>

            {bboxDebug ? (
              <div aria-hidden={!onSelectDebugQuestion} className="pointer-events-none absolute inset-0 z-20">
                {/* Margin & Column Alignment Hairlines (6.6%, 50%, 93.2%) */}
                <div
                  style={{ left: '6.6%' }}
                  className="absolute inset-y-0 border-l border-dashed border-[#0EA5E9]/45"
                />
                <div
                  style={{ left: '50%' }}
                  className="absolute inset-y-0 border-l border-dashed border-[#64748B]/35"
                />
                <div
                  style={{ left: '93.2%' }}
                  className="absolute inset-y-0 border-l border-dashed border-[#0EA5E9]/45"
                />

                {pageDebugBoxes.map((box) => {
                  const hasOuterGhost = box.outerAdjusted;
                  const hasFocusGhost = box.focusAdjusted && Boolean(box.rawFocus);
                  const clickable =
                    drawTool === 'off' && Boolean(onSelectDebugQuestion) && !box.isActive;

                  return (
                    <React.Fragment key={box.id}>
                      {/* Original unadjusted ghost outline for visual diff */}
                      {hasOuterGhost && (
                        <div
                          style={{
                            left: `${(box.rawOuter.x * 100).toFixed(3)}%`,
                            top: `${(box.rawOuter.y * 100).toFixed(3)}%`,
                            width: `${(box.rawOuter.w * 100).toFixed(3)}%`,
                            height: `${(box.rawOuter.h * 100).toFixed(3)}%`,
                          }}
                          className="pointer-events-none absolute rounded-lg border border-dashed border-slate-500/75 bg-slate-400/[0.04]"
                        />
                      )}

                      {hasFocusGhost && box.rawFocus && (
                        <div
                          style={{
                            left: `${(box.rawFocus.x * 100).toFixed(3)}%`,
                            top: `${(box.rawFocus.y * 100).toFixed(3)}%`,
                            width: `${(box.rawFocus.w * 100).toFixed(3)}%`,
                            height: `${(box.rawFocus.h * 100).toFixed(3)}%`,
                          }}
                          className="pointer-events-none absolute rounded-md border border-dashed border-slate-600/80 bg-slate-500/[0.05]"
                        />
                      )}

                      {/* Outer Bounding Box */}
                      <div
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={
                          clickable
                            ? () => onSelectDebugQuestion?.(box.id)
                            : undefined
                        }
                        onKeyDown={
                          clickable
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onSelectDebugQuestion?.(box.id);
                                }
                              }
                            : undefined
                        }
                        style={rectToCalcStyle(box.rawOuter, box.outerDelta, zoom)}
                        className={`absolute rounded-lg transition-colors ${
                          clickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                        } ${
                          box.isActive
                            ? box.focus
                              ? 'border-2 border-dashed border-[#D97706] bg-[#F59E0B]/[0.07]'
                              : 'border-2 border-[#E11D48] bg-[#E11D48]/[0.12] shadow-[0_0_0_1px_rgba(255,255,255,0.6)]'
                            : 'border-2 border-[#0284C7]/80 bg-[#0284C7]/[0.06] hover:bg-[#0284C7]/[0.14]'
                        }`}
                      >
                        {/* Corner alignment crosshairs for active outer box */}
                        {box.isActive && !box.focus && (
                          <>
                            <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 border-t-[3px] border-l-[3px] border-[#E11D48]" />
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 border-t-[3px] border-r-[3px] border-[#E11D48]" />
                            <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 border-b-[3px] border-l-[3px] border-[#E11D48]" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-b-[3px] border-r-[3px] border-[#E11D48]" />
                          </>
                        )}

                        <span
                          className={`absolute left-1 ${
                            box.outer.y < 0.04 ? 'top-1' : '-top-5'
                          } inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold tabular-nums whitespace-nowrap shadow-xs ${
                            box.isActive
                              ? box.focus
                                ? 'bg-[#D97706] text-white'
                                : 'bg-[#E11D48] text-white'
                              : 'bg-[#0284C7]/90 text-white'
                          }`}
                        >
                          <span>
                            #{box.globalIndex} {box.originalItemNumber}
                          </span>
                          <span className="opacity-90">
                            x:{box.outer.x.toFixed(3)} y:{box.outer.y.toFixed(3)} w:{box.outer.w.toFixed(3)} h:{box.outer.h.toFixed(3)}
                          </span>
                          {box.outerAdjusted && box.outerDelta && (
                            <span className="bg-black/25 px-1 rounded">
                              ({formatSignedPx(box.outerDelta.dx)}, {formatSignedPx(box.outerDelta.dy)})
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Focus Sub-Rect for Shared-Passage Sets */}
                      {box.focus && box.rawFocus && (
                        <div
                          style={rectToCalcStyle(box.rawFocus, box.focusDelta, zoom)}
                          className={`pointer-events-none absolute rounded-md border-2 ${
                            box.isActive
                              ? 'border-[#E11D48] bg-[#E11D48]/[0.14]'
                              : 'border-dashed border-[#0369A1]/80 bg-[#0EA5E9]/[0.07]'
                          }`}
                        >
                          {box.isActive && (
                            <>
                              <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 border-t-[3px] border-l-[3px] border-[#E11D48]" />
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 border-t-[3px] border-r-[3px] border-[#E11D48]" />
                              <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 border-b-[3px] border-l-[3px] border-[#E11D48]" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-b-[3px] border-r-[3px] border-[#E11D48]" />
                            </>
                          )}
                          <span
                            className={`absolute right-1 -top-4 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold tabular-nums whitespace-nowrap shadow-xs ${
                              box.isActive
                                ? 'bg-[#E11D48] text-white'
                                : 'bg-[#0369A1] text-white'
                            }`}
                          >
                            <span>focus</span>
                            <span>
                              x:{box.focus.x.toFixed(3)} y:{box.focus.y.toFixed(3)} w:{box.focus.w.toFixed(3)} h:{box.focus.h.toFixed(3)}
                            </span>
                            {box.focusAdjusted && box.focusDelta && (
                              <span className="bg-black/25 px-1 rounded">
                                ({formatSignedPx(box.focusDelta.dx)}, {formatSignedPx(box.focusDelta.dy)})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              anchorInfo && (
                <>
                  <div
                    aria-hidden="true"
                    style={rectToCalcStyle(anchorInfo.rawOuter, anchorInfo.outerDelta, zoom)}
                    className={`pointer-events-none absolute rounded-xl border-2 border-dashed ${
                      anchorInfo.focus
                        ? isLavender
                          ? 'border-[#6A52A3]/55 bg-[#7963A8]/[0.03]'
                          : 'border-[#58CC02]/55 bg-[#58CC02]/[0.03]'
                        : isLavender
                          ? 'border-[#6A52A3]/85 bg-[#7963A8]/[0.06]'
                          : 'border-[#58CC02]/85 bg-[#58CC02]/[0.06]'
                    }`}
                  >
                    {!anchorInfo.focus && (
                      <span
                        className={`absolute right-1.5 ${
                          anchorInfo.y < 0.055 ? 'top-1.5' : '-top-3'
                        } px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-xs ${
                          isLavender
                            ? 'bg-[#6A52A3] text-white'
                            : 'bg-[#58CC02] text-white'
                        }`}
                      >
                        현재 문항 ({anchorInfo.rank}/{anchorInfo.total})
                      </span>
                    )}
                  </div>

                  {anchorInfo.focus && anchorInfo.rawFocus && (
                    <div
                      aria-hidden="true"
                      style={rectToCalcStyle(anchorInfo.rawFocus, anchorInfo.focusDelta, zoom)}
                      className={`pointer-events-none absolute rounded-lg border-2 ${
                        isLavender
                          ? 'border-[#6A52A3] bg-[#7963A8]/[0.10]'
                          : 'border-[#58CC02] bg-[#58CC02]/[0.10]'
                      }`}
                    >
                      <span
                        className={`absolute right-1.5 -top-3 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold shadow-xs ${
                          isLavender
                            ? 'bg-[#6A52A3] text-white'
                            : 'bg-[#58CC02] text-white'
                        }`}
                      >
                        현재 문항 ({anchorInfo.rank}/{anchorInfo.total})
                      </span>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
