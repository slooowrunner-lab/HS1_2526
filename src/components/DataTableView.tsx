import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { ExtractedQuestion } from '../types/question';

interface DataTableViewProps {
  questions: ExtractedQuestion[];
  selectedId: string;
  onSelectQuestion: (id: string) => void;
}

type SortKey = 'globalIndex' | 'examYear' | 'points' | 'page';

const CIRCLED = ['①', '②', '③', '④', '⑤'];

export const DataTableView: React.FC<DataTableViewProps> = ({
  questions,
  selectedId,
  onSelectQuestion,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('globalIndex');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const sorted = useMemo(() => {
    const copy = [...questions];
    copy.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'globalIndex') diff = a.globalIndex - b.globalIndex;
      else if (sortKey === 'examYear') diff = a.examYear.localeCompare(b.examYear);
      else if (sortKey === 'points') diff = a.points - b.points;
      else if (sortKey === 'page') diff = (a.pages[0] ?? 0) - (b.pages[0] ?? 0);
      return sortAsc ? diff : -diff;
    });
    return copy;
  }, [questions, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="clay-card rounded-3xl p-12 text-center">
        <p className="text-sm font-bold text-[#2D2620]">
          조건에 일치하는 문항이 없습니다
        </p>
        <p className="text-xs text-[#6E5E52] mt-1">
          검색어나 연도·단원 필터를 변경해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="clay-card rounded-3xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b-2 border-[#EAE0D0] bg-[#FFF9EF]">
        <div className="text-xs text-[#5C4D42]">
          <span className="font-extrabold text-[#2D2620]">추출 문항 데이터 시트</span>
          <span className="mx-2 text-[#C8B9A6]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums">{sorted.length}개 문항</span>
        </div>
        <span className="text-xs text-[#6E5E52]">
          행을 클릭하면 해당 탐험 미션으로 바로 이동합니다
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-[#EAE0D0] bg-white text-[#5C4D42]">
              <th className="py-2.5 px-4 font-bold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('globalIndex')}
                  className="inline-flex items-center gap-1 hover:text-[#2D2620] cursor-pointer"
                >
                  <span>연번</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap">단원</th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('examYear')}
                  className="inline-flex items-center gap-1 hover:text-[#2D2620] cursor-pointer"
                >
                  <span>출제 출처</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('page')}
                  className="inline-flex items-center gap-1 hover:text-[#2D2620] cursor-pointer"
                >
                  <span>페이지</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('points')}
                  className="inline-flex items-center gap-1 hover:text-[#2D2620] cursor-pointer"
                >
                  <span>배점</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-bold min-w-[220px]">발문</th>
              <th className="py-2.5 px-3 font-bold min-w-[260px]">핵심 요약</th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap text-right">정답</th>
              <th className="py-2.5 px-4 font-bold whitespace-nowrap text-right">각주</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2ECE1]">
            {sorted.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectQuestion(item.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#FFE18A]/35 hover:bg-[#FFE18A]/50'
                      : 'hover:bg-[#FFF9EF]'
                  }`}
                >
                  <td className="py-2.5 px-4 font-mono font-bold text-[#2D2620] tabular-nums whitespace-nowrap">
                    #{String(item.globalIndex).padStart(2, '0')}
                  </td>
                  <td className="py-2.5 px-3 text-[#5C4D42] whitespace-nowrap">
                    {item.sectionNumber}. {item.sectionTitle}
                  </td>
                  <td className="py-2.5 px-3 text-[#2D2620] whitespace-nowrap font-semibold">
                    {item.sourceExam}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#6E5E52] tabular-nums whitespace-nowrap">
                    {item.pages.map((p) => `${p}p`).join('–')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <span
                      className={
                        item.points === 3
                          ? 'font-extrabold text-[#C25D44]'
                          : 'text-[#5C4D42]'
                      }
                    >
                      {item.points}점
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#2D2620] max-w-xs truncate" title={item.prompt}>
                    {item.prompt}
                  </td>
                  <td className="py-2.5 px-3 text-[#5C4D42] max-w-sm truncate" title={item.topicSummary}>
                    {item.topicSummary}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#2D2620] tabular-nums whitespace-nowrap">
                    {CIRCLED[item.answerIndex - 1]}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#6E5E52] tabular-nums whitespace-nowrap">
                    {item.footnotes?.length ?? 0}개
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
