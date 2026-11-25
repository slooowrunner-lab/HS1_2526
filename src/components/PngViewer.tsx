import React, { useEffect, useState } from 'react';
import { ExternalLink, FileImage, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { PAGE_ASSETS } from '../data/pages';

interface PngViewerProps {
  pages: number[];
  targetExamLabel?: string;
}

export const PngViewer: React.FC<PngViewerProps> = ({ pages, targetExamLabel }) => {
  const [activePage, setActivePage] = useState<number>(pages[0] ?? 1);
  const [zoom, setZoom] = useState<number>(100);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    setActivePage(pages[0] ?? 1);
    setImgError(false);
  }, [pages]);

  const asset = PAGE_ASSETS.find((p) => p.page === activePage) ?? PAGE_ASSETS[0];

  return (
    <div className="flex flex-col h-full bg-white border-2 border-[#EAE0D0] rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b-2 border-[#EAE0D0] bg-[#FFF9EF]">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-xs font-extrabold text-[#2D2620] whitespace-nowrap">
            원본 시험지
          </span>
          <span className="text-[#C8B9A6]" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-mono text-[#6E5E52] tabular-nums">
            {asset.page}p / 18p
          </span>
          {targetExamLabel && (
            <>
              <span className="text-[#C8B9A6]" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-bold text-[#9B785D] truncate">
                찾을 문항: {targetExamLabel}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pages.length > 1 && (
            <div className="flex items-center gap-1 p-0.5 bg-[#EFE6D8] rounded-lg">
              {pages.map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => {
                    setActivePage(pageNum);
                    setImgError(false);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                    activePage === pageNum
                      ? 'bg-white text-[#2D2620] shadow-xs'
                      : 'text-[#6E5E52] hover:text-[#2D2620]'
                  }`}
                >
                  {pageNum}p
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center border-2 border-[#EAE0D0] rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(70, z - 15))}
              aria-label="축소"
              className="p-1.5 text-[#5C4D42] hover:text-[#2D2620] hover:bg-[#FFF9EF] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono text-[#2D2620] tabular-nums border-x border-[#EAE0D0]">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 15))}
              aria-label="확대"
              className="p-1.5 text-[#5C4D42] hover:text-[#2D2620] hover:bg-[#FFF9EF] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              aria-label="원본 배율"
              className="p-1.5 text-[#5C4D42] hover:text-[#2D2620] hover:bg-[#FFF9EF] transition-colors border-l border-[#EAE0D0] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#2D2620] bg-white border-2 border-[#EAE0D0] rounded-lg hover:bg-[#FFF9EF] transition-colors whitespace-nowrap shrink-0"
          >
            <span>새 탭</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#F5EFE4] p-4 flex items-start justify-center min-h-[400px]">
        {imgError ? (
          <div className="flex flex-col items-center justify-center p-10 text-center bg-white border-2 border-[#EAE0D0] rounded-2xl max-w-sm my-auto">
            <FileImage className="w-8 h-8 text-[#9B785D] mb-3" />
            <p className="text-sm font-bold text-[#2D2620]">
              {asset.page}페이지 이미지를 불러오지 못했습니다
            </p>
            <p className="text-xs text-[#6E5E52] mt-1 font-mono break-all">
              {asset.filename}
            </p>
          </div>
        ) : (
          <div
            style={{ width: `${zoom}%` }}
            className="transition-[width] duration-150 ease-out origin-top max-w-none"
          >
            <img
              src={asset.url}
              alt={`중학 영어 복습 독해편 ${asset.page}페이지 원본`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-auto rounded-lg border border-[#EAE0D0] bg-white shadow-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
};
