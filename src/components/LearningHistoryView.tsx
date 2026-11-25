import React, { useMemo } from 'react';
import { CheckCircle2, Clock, RotateCcw, TrendingUp } from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { SECTION_META } from '../data/sections';
import { HistoryEvent, MissionProgress } from '../types/game';
import { computeLevelInfo } from '../utils/gameStorage';

interface LearningHistoryViewProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  history: HistoryEvent[];
  xp: number;
  streakCount: number;
  onStartMission: (questionId: string) => void;
}

export const LearningHistoryView: React.FC<LearningHistoryViewProps> = ({
  questions,
  progressById,
  history,
  xp,
  streakCount,
  onStartMission,
}) => {
  const levelInfo = computeLevelInfo(xp);

  const stats = useMemo(() => {
    const completed = Object.values(progressById).filter((p) => p.completed).length;
    const totalAttempts = history.length;
    const correctAttempts = history.filter((h) => h.isCorrect).length;
    const accuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    return { completed, totalAttempts, correctAttempts, accuracy };
  }, [progressById, history]);

  const sectionProgress = useMemo(() => {
    return SECTION_META.map((sec) => {
      const items = questions.filter((q) => q.sectionNumber === sec.number);
      const done = items.filter((q) => progressById[q.id]?.completed).length;
      return {
        section: sec,
        total: items.length,
        done,
        pct: items.length ? Math.round((done / items.length) * 100) : 0,
      };
    });
  }, [questions, progressById]);

  return (
    <div className="space-y-6">
      {/* Top Level & Accuracy Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">현재 탐정 레벨</div>
          <div className="text-2xl font-extrabold text-[#2D2620] font-mono tabular-nums mt-1">
            LV.{levelInfo.level}
          </div>
          <div className="text-xs text-[#9B785D] font-semibold mt-0.5">
            {levelInfo.title}
          </div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">완료한 미션</div>
          <div className="text-2xl font-extrabold text-[#4C7A34] font-mono tabular-nums mt-1">
            {stats.completed} / {questions.length}
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5">전체 탐험 진행</div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">실전 도전 정답률</div>
          <div className="text-2xl font-extrabold text-[#2D2620] font-mono tabular-nums mt-1">
            {stats.accuracy}%
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5 tabular-nums">
            {stats.correctAttempts} / {stats.totalAttempts}회 성공
          </div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">최고 연속 정답</div>
          <div className="text-2xl font-extrabold text-[#C25D44] font-mono tabular-nums mt-1">
            {streakCount}연속
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5 tabular-nums">
            보유 {xp} XP
          </div>
        </div>
      </div>

      {/* Section Mastery Grid */}
      <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#9B785D]" />
          <h2 className="text-lg font-extrabold text-[#2D2620]">
            10개 단원별 탐험 숙련도
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sectionProgress.map((sp) => (
            <div
              key={sp.section.number}
              className="rounded-2xl border-2 border-[#EAE0D0] bg-[#FFF9EF] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className="text-[#2D2620]">
                  {String(sp.section.number).padStart(2, '0')}. {sp.section.title}
                </span>
                <span className="font-mono text-[#5C4D42] tabular-nums">
                  {sp.done} / {sp.total} ({sp.pct}%)
                </span>
              </div>
              <div className="h-2.5 bg-white rounded-full overflow-hidden border border-[#EAE0D0]">
                <div
                  className="h-full bg-[#9BCB83] rounded-full transition-all"
                  style={{ width: `${sp.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Chronological Activity Log */}
      <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#9B785D]" />
          <h2 className="text-lg font-extrabold text-[#2D2620]">
            최근 탐험 활동 기록
          </h2>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#DFD2BE] bg-[#FFF9EF] p-8 text-center">
            <p className="text-sm font-bold text-[#2D2620]">
              아직 도전 기록이 없어요
            </p>
            <p className="text-xs text-[#6E5E52] mt-1">
              탐험 지도에서 첫 번째 미션에 도전해 실전 문제를 풀면 기록이 차곡차곡 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.slice(0, 30).map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onStartMission(ev.questionId)}
                className="w-full text-left rounded-2xl border-2 border-[#EAE0D0] bg-[#FFF9EF] hover:border-[#9B785D] px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {ev.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-[#4C7A34] shrink-0" />
                  ) : (
                    <RotateCcw className="w-5 h-5 text-[#C25D44] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#2D2620] truncate">
                      {ev.sourceExam} · {ev.sectionTitle}
                    </div>
                    <div className="text-xs text-[#5C4D42] truncate">
                      {ev.note}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono shrink-0 tabular-nums">
                  {ev.xpDelta > 0 && (
                    <span className="font-extrabold text-[#4C7A34]">
                      +{ev.xpDelta} XP
                    </span>
                  )}
                  <span className="text-[#7D6E61]">
                    {new Date(ev.timestamp).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
