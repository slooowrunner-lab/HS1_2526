import React, { useState } from 'react';
import { FileImage } from 'lucide-react';
import { PAGE_ASSETS } from '../data/pages';
import { ExtractedQuestion } from '../types/question';

interface PngGalleryViewProps {
  questions: ExtractedQuestion[];
  onSelectQuestion: (id: string) => void;
}

export const PngGalleryView: React.FC<PngGalleryViewProps> = ({
  questions,
  onSelectQuestion,
}) => {
  const [failedPages, setFailedPages] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#2D2620]">
            원본 PNG 18페이지 전체 인덱싱
          </h2>
          <p className="text-xs text-[#6E5E52] mt-0.5">
            각 페이지에서 추출된 문항 링크를 클릭하면 해당 탐험 미션으로 바로 이동합니다.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[#6E5E52] tabular-nums">
          총 18 pages · 56 items
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PAGE_ASSETS.map((pageAsset) => {
          const getPageRect = (q: ExtractedQuestion) => {
            const c = q.coordinates?.find((item) => item.page === pageAsset.page);
            if (c) return c.focus ?? c;
            if (q.pages[0] === pageAsset.page && q.bbox) {
              return { x: q.bbox[0], y: q.bbox[1], w: q.bbox[2], h: q.bbox[3] };
            }
            return null;
          };

          const pageQuestions = questions
            .filter((q) => q.pages.includes(pageAsset.page))
            .slice()
            .sort((a, b) => {
              const ra = getPageRect(a);
              const rb = getPageRect(b);
              return (ra?.y ?? 0) - (rb?.y ?? 0);
            });
          const hasError = failedPages[pageAsset.page];

          return (
            <article
              key={pageAsset.page}
              className="clay-card rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#EAE0D0] bg-[#FFF9EF]">
                <span className="font-mono text-xs font-extrabold text-[#2D2620] tabular-nums">
                  Page {String(pageAsset.page).padStart(2, '0')}
                </span>
                <span className="text-xs text-[#6E5E52] truncate max-w-[180px]">
                  {pageAsset.sections.join(' · ')}
                </span>
              </div>

              <div className="bg-[#F5EFE4] p-3 flex items-center justify-center aspect-[3/4] overflow-hidden">
                {hasError ? (
                  <div className="flex flex-col items-center text-center p-4">
                    <FileImage className="w-6 h-6 text-[#9B785D] mb-2" />
                    <span className="text-xs text-[#5C4D42]">
                      이미지 로드 실패 ({pageAsset.page}p)
                    </span>
                  </div>
                ) : (
                  <div className="relative h-full aspect-[2481/3508] max-w-full bg-white border border-[#EAE0D0] rounded-lg overflow-hidden">
                    <img
                      src={pageAsset.url}
                      alt={`중학 영어 복습 독해편 ${pageAsset.page}페이지`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={() =>
                        setFailedPages((prev) => ({
                          ...prev,
                          [pageAsset.page]: true,
                        }))
                      }
                      className="w-full h-full object-fill block"
                    />
                    {pageQuestions.map((q) => {
                      const rect = getPageRect(q);
                      if (!rect) return null;
                      const is2026 = q.examYear === '2026';
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => onSelectQuestion(q.id)}
                          title={`${q.sourceExam} · ${q.sectionTitle}`}
                          style={{
                            left: `${(rect.x * 100).toFixed(2)}%`,
                            top: `${(rect.y * 100).toFixed(2)}%`,
                            width: `${(rect.w * 100).toFixed(2)}%`,
                            height: `${(rect.h * 100).toFixed(2)}%`,
                          }}
                          className={`absolute rounded border transition-colors cursor-pointer ${
                            is2026
                              ? 'border-[#6A52A3]/45 hover:border-[#6A52A3] hover:bg-[#7963A8]/15'
                              : 'border-[#58CC02]/50 hover:border-[#46A302] hover:bg-[#58CC02]/15'
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3.5 border-t-2 border-[#EAE0D0] space-y-2 bg-white">
                <div className="text-xs font-bold text-[#6E5E52]">
                  추출 문항 ({pageQuestions.length}건)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pageQuestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onSelectQuestion(q.id)}
                      className="px-2.5 py-1 text-xs font-bold text-[#2D2620] bg-[#FFF9EF] border border-[#EAE0D0] hover:bg-[#A8DCC8] rounded-lg transition-colors tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      #{q.globalIndex} {q.sourceExam}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
