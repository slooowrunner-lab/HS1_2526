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

interface PngViewerProps {
  pages: number[];
  targetExamLabel?: string;
  targetQuestionId?: string;
  islandTheme?: 'spring' | 'lavender';
}

type DrawTool = 'off' | 'highlight' | 'pen';

interface StrokePath {
  id: string;
  kind: 'highlight' | 'pen';
  points: [number, number][];
}

export const PngViewer: React.FC<PngViewerProps> = ({
  pages,
  targetExamLabel,
  targetQuestionId,
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const [activePage, setActivePage] = useState<number>(pages[0] ?? 1);
  const [zoom, setZoom] = useState<number>(100);
  const [imgError, setImgError] = useState<boolean>(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('off');
  const [strokesByKey, setStrokesByKey] = useState<Record<string, StrokePath[]>>({});
  const [activeStroke, setActiveStroke] = useState<StrokePath | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setActivePage(pages[0] ?? 1);
    setImgError(false);
    setActiveStroke(null);
  }, [pages, targetQuestionId]);

  const asset = PAGE_ASSETS.find((p) => p.page === activePage) ?? PAGE_ASSETS[0];
  const strokeStorageKey = `${targetQuestionId ?? 'sheet'}-p${activePage}`;
  const currentStrokes = strokesByKey[strokeStorageKey] ?? [];

  const anchorInfo = useMemo(() => {
    if (!targetQuestionId) return null;
    const pageQuestions = EXTRACTED_QUESTIONS.filter((q) => q.pages.includes(activePage));
    const idx = pageQuestions.findIndex((q) => q.id === targetQuestionId);
    if (idx < 0) return null;
    const targetQ = pageQuestions[idx];
    let ratio = 0.05;
    if (targetQ.pages.length > 1) {
      ratio = activePage === targetQ.pages[0] ? 0.62 : 0.05;
    } else if (pageQuestions.length === 1) {
      ratio = 0.04;
    } else if (pageQuestions.length === 2) {
      ratio = idx === 0 ? 0.04 : 0.48;
    } else {
      ratio = Math.min(0.7, 0.04 + (idx / Math.max(1, pageQuestions.length - 1)) * 0.62);
    }
    return {
      ratio,
      rank: idx + 1,
      total: pageQuestions.length,
    };
  }, [activePage, targetQuestionId]);

  const scrollToQuestionAnchor = useCallback(
    (smooth = true) => {
      const el = scrollRef.current;
      if (!el || !anchorInfo) return;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetTop = Math.min(maxScroll, Math.round(el.scrollHeight * anchorInfo.ratio));
      el.scrollTo({
        top: targetTop,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [anchorInfo],
  );

  useEffect(() => {
    if (!anchorInfo) return;
    const t = window.setTimeout(() => {
      scrollToQuestionAnchor(true);
    }, 120);
    return () => window.clearTimeout(t);
  }, [anchorInfo, activePage, targetQuestionId, zoom, scrollToQuestionAnchor]);

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
      className={`flex flex-col h-full bg-white border-2 rounded-2xl overflow-hidden shadow-xs ${
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
            원본 시험지
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
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                isLavender
                  ? 'bg-[#EDE9FE] border-[#7963A8] text-[#2F1F63] hover:bg-[#DFD7FA]'
                  : 'bg-[#FFE18A]/55 border-[#D4A72C] text-[#4B3200] hover:bg-[#FFE18A]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>문항 위치</span>
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
        className={`flex-1 overflow-auto p-4 flex items-start justify-center min-h-[440px] ${
          isLavender ? 'bg-[#ECEAF8]' : 'bg-[#F5EFE4]'
        }`}
      >
        {imgError ? (
          <div className="flex flex-col items-center justify-center p-10 text-center bg-white border-2 border-[#EAE0D0] rounded-2xl max-w-sm my-auto">
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
            className="relative transition-[width] duration-150 ease-out origin-top max-w-none select-none"
          >
            <img
              src={asset.url}
              alt={`중학 영어 복습 독해편 ${asset.page}페이지 원본`}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => scrollToQuestionAnchor(false)}
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

            {anchorInfo && (
              <div
                aria-hidden="true"
                style={{ top: `${Math.round(anchorInfo.ratio * 100)}%`, height: '24%' }}
                className={`pointer-events-none absolute inset-x-1 rounded-xl border-2 border-dashed ${
                  isLavender
                    ? 'border-[#6E569E]/75 bg-[#8E77D0]/10'
                    : 'border-[#D4A72C]/85 bg-[#FFE18A]/12'
                }`}
              >
                <span
                  className={`inline-block m-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-xs ${
                    isLavender
                      ? 'bg-[#5B48A3] text-white'
                      : 'bg-[#D4A72C] text-[#1E1915]'
                  }`}
                >
                  이 문항 위치 ({anchorInfo.rank}/{anchorInfo.total})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
