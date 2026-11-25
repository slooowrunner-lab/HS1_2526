import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Compass,
  Flame,
  RotateCcw,
  Star,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { MissionProgress } from '../types/game';

interface ReviewMissionsViewProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  onStartMission: (questionId: string) => void;
}

type ReviewQueue = 'retry' | 'belowThreeStars' | 'threePoints' | 'visuals' | 'unsolved';

export const ReviewMissionsView: React.FC<ReviewMissionsViewProps> = ({
  questions,
  progressById,
  onStartMission,
}) => {
  const [queue, setQueue] = useState<ReviewQueue>('threePoints');

  const lists = useMemo(() => {
    const retry = questions.filter((q) => {
      const p = progressById[q.id];
      return p && p.attempts > 0 && !p.completed;
    });
    const belowThreeStars = questions.filter((q) => {
      const p = progressById[q.id];
      return p && p.completed && p.stars < 3;
    });
    const threePoints = questions.filter((q) => q.points === 3);
    const visuals = questions.filter((q) => Boolean(q.chart || q.table));
    const unsolved = questions.filter((q) => !progressById[q.id]?.completed);
    return { retry, belowThreeStars, threePoints, visuals, unsolved };
  }, [questions, progressById]);

  const activeItems = lists[queue];

  return (
    <div className="space-y-6">
      <div className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div>
          <div className="text-xs font-extrabold text-[#9B785D]">
            REVIEW MISSIONS
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#2D2620] mt-0.5">
            맞춤형 집중 복습 & 별 3개 도전
          </h1>
          <p className="text-xs sm:text-sm text-[#5C4D42] mt-0.5">
            틀렸던 문항, 별 3개 미만 문항, 3점 고난도 문항만 골라 빠르게 ★3 마스터리에 도전하세요.
          </p>
        </div>

        {/* Queue Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(
            [
              {
                id: 'retry',
                label: '오답 재도전',
                count: lists.retry.length,
                icon: RotateCcw,
                tone: 'bg-[#F39A83]/25 border-[#D1684E]',
              },
              {
                id: 'belowThreeStars',
                label: '★3 미달 도전',
                count: lists.belowThreeStars.length,
                icon: Star,
                tone: 'bg-[#FFE18A]/50 border-[#D4A72C]',
              },
              {
                id: 'threePoints',
                label: '3점 고난도',
                count: lists.threePoints.length,
                icon: Flame,
                tone: 'bg-[#F39A83]/20 border-[#D1684E]',
              },
              {
                id: 'visuals',
                label: '도표 · 안내문',
                count: lists.visuals.length,
                icon: BarChart3,
                tone: 'bg-[#A9DDF5]/35 border-[#5D9EC0]',
              },
              {
                id: 'unsolved',
                label: '남은 미션',
                count: lists.unsolved.length,
                icon: Compass,
                tone: 'bg-[#A8DCC8]/35 border-[#4D9479]',
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = queue === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQueue(tab.id)}
                className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? `${tab.tone} shadow-xs`
                    : 'bg-[#FFF9EF] border-[#EAE0D0] hover:border-[#9B785D]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="w-4 h-4 text-[#2D2620]" />
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-[#2D2620] tabular-nums">
                    {tab.count}문항
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-[#2D2620] mt-2">
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue List */}
      {activeItems.length === 0 ? (
        <div className="clay-card rounded-3xl p-10 text-center">
          <p className="text-base font-extrabold text-[#2D2620]">
            해당 복습 대기 문항이 비어 있어요!
          </p>
          <p className="text-xs sm:text-sm text-[#5C4D42] mt-1">
            모든 문항을 멋지게 해결했거나, 다른 복습 테마를 선택해 탐험을 이어갈 수 있어요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeItems.map((item) => {
            const prog = progressById[item.id];
            const stars = prog?.stars ?? 0;
            return (
              <div
                key={item.id}
                className="clay-card rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#9B785D] tabular-nums">
                    <span>
                      #{String(item.globalIndex).padStart(2, '0')} · {item.sourceExam} ·{' '}
                      {item.sectionTitle}
                    </span>
                    <span
                      className={
                        item.points === 3 ? 'text-[#C25D44]' : 'text-[#5C4D42]'
                      }
                    >
                      {item.points}점
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#2D2620] mt-1.5 leading-snug">
                    {item.prompt}
                  </h3>
                  <p className="text-xs text-[#5C4D42] mt-1 line-clamp-2">
                    {item.topicSummary}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6E5E52] tabular-nums">
                    {prog?.completed ? (
                      <span className="inline-flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= stars
                                ? 'text-[#B47A00] fill-[#FFE18A]'
                                : 'text-[#D6C8B4]'
                            }`}
                          />
                        ))}
                      </span>
                    ) : prog?.started ? (
                      <span>진행 중</span>
                    ) : (
                      <span>미도전</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartMission(item.id)}
                    className="clay-btn px-4 py-2 rounded-xl bg-[#A8DCC8] text-xs font-extrabold text-[#163B2D] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>도전하기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
