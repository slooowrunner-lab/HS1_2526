import React, { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import {
  buildCsvExport,
  buildJsonExport,
  buildMarkdownExport,
  downloadTextFile,
} from '../utils/exporters';

interface ExportStudioViewProps {
  filteredQuestions: ExtractedQuestion[];
  allQuestions: ExtractedQuestion[];
  transcripts: Record<string, string>;
}

export const ExportStudioView: React.FC<ExportStudioViewProps> = ({
  filteredQuestions,
  allQuestions,
  transcripts,
}) => {
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [format, setFormat] = useState<'json' | 'csv' | 'markdown'>('json');
  const [copied, setCopied] = useState<boolean>(false);

  const targetItems = useMemo(() => {
    const base = scope === 'filtered' ? filteredQuestions : allQuestions;
    return base.map((item) =>
      transcripts[item.id]
        ? { ...item, customTranscript: transcripts[item.id] }
        : item,
    );
  }, [scope, filteredQuestions, allQuestions, transcripts]);

  const previewText = useMemo(() => {
    if (format === 'json') return buildJsonExport(targetItems);
    if (format === 'csv') return buildCsvExport(targetItems);
    return buildMarkdownExport(targetItems);
  }, [format, targetItems]);

  const stats = useMemo(() => {
    const y2026 = targetItems.filter((i) => i.examYear === '2026').length;
    const y2025 = targetItems.filter((i) => i.examYear === '2025').length;
    const pts3 = targetItems.filter((i) => i.points === 3).length;
    const footnotes = targetItems.reduce(
      (acc, i) => acc + (i.footnotes?.length ?? 0),
      0,
    );
    return { y2026, y2025, pts3, footnotes };
  }, [targetItems]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked fallback
    }
  };

  const handleDownload = () => {
    const suffix = scope === 'filtered' ? 'filtered' : 'all';
    if (format === 'json') {
      downloadTextFile(
        `reading_questions_${suffix}.json`,
        previewText,
        'application/json;charset=utf-8',
      );
    } else if (format === 'csv') {
      downloadTextFile(
        `reading_questions_${suffix}.csv`,
        previewText,
        'text/csv;charset=utf-8',
      );
    } else {
      downloadTextFile(
        `reading_questions_${suffix}.md`,
        previewText,
        'text/markdown;charset=utf-8',
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">내보내기 대상</div>
          <div className="text-2xl font-extrabold text-[#2D2620] font-mono tabular-nums mt-1">
            {targetItems.length}문항
          </div>
        </div>
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">출제 연도 분포</div>
          <div className="text-lg font-extrabold text-[#2D2620] font-mono tabular-nums mt-1.5">
            2026 ({stats.y2026}) · 2025 ({stats.y2025})
          </div>
        </div>
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">3점 고난도 문항</div>
          <div className="text-2xl font-extrabold text-[#C25D44] font-mono tabular-nums mt-1">
            {stats.pts3}문항
          </div>
        </div>
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">추출된 각주 어휘</div>
          <div className="text-2xl font-extrabold text-[#4C7A34] font-mono tabular-nums mt-1">
            {stats.footnotes}단어
          </div>
        </div>
      </div>

      {/* Export Controls & Live Preview */}
      <div className="clay-card rounded-3xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b-2 border-[#EAE0D0] bg-[#FFF9EF]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#EFE6D8] rounded-xl">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                  scope === 'filtered'
                    ? 'bg-white text-[#2D2620] shadow-xs'
                    : 'text-[#6E5E52] hover:text-[#2D2620]'
                }`}
              >
                현재 필터 ({filteredQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white text-[#2D2620] shadow-xs'
                    : 'text-[#6E5E52] hover:text-[#2D2620]'
                }`}
              >
                전체 문항 ({allQuestions.length})
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#EFE6D8] rounded-xl">
              {(['json', 'csv', 'markdown'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors uppercase whitespace-nowrap shrink-0 cursor-pointer ${
                    format === fmt
                      ? 'bg-white text-[#2D2620] shadow-xs'
                      : 'text-[#6E5E52] hover:text-[#2D2620]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="clay-btn inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#2D2620] bg-white rounded-xl hover:bg-[#FFF9EF] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4C7A34]" />
                  <span>클립보드에 복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>전체 복사</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="clay-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-[#163B2D] bg-[#A8DCC8] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{format.toUpperCase()} 파일 저장</span>
            </button>
          </div>
        </div>

        <pre className="p-5 text-xs font-mono text-[#2D2620] bg-[#FFFDF8] overflow-auto max-h-[540px] leading-relaxed">
          {previewText}
        </pre>
      </div>
    </div>
  );
};
