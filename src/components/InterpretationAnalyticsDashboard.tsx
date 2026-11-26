import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Gauge,
  Target,
  TrendingUp,
} from 'lucide-react';
import { HistoryEvent, MissionProgress } from '../types/game';

interface InterpretationAnalyticsDashboardProps {
  history: HistoryEvent[];
  progressById: Record<string, MissionProgress>;
  totalQuestions: number;
  streakCount: number;
  reducedMotion?: boolean;
}

type RangeMode = '7d' | '4w';

interface ChartBucketPoint {
  key: string;
  label: string;
  fullLabel: string;
  attempts: number;
  correctAttempts: number;
  accuracy: number | null;
  avgSpeedSec: number | null;
  skillScore: number | null;
  timedCount: number;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeSpeedPoints(avgSpeedSec: number | null): number {
  if (avgSpeedSec === null) return 0;
  if (avgSpeedSec <= 15) return 30;
  if (avgSpeedSec >= 75) return 6;
  return Math.round(30 - ((avgSpeedSec - 15) / 60) * 24);
}

function getSkillGrade(score: number): {
  label: string;
  colorClass: string;
  summary: string;
} {
  if (score >= 85) {
    return {
      label: '마스터 해석가',
      colorClass: 'text-[#285E00]',
      summary: '정확도와 해석 속도 모두 최상위 수준이에요.',
    };
  }
  if (score >= 70) {
    return {
      label: '유창한 직독직해',
      colorClass: 'text-[#0E74A8]',
      summary: '영어 어순대로 막힘없이 빠르게 읽고 있어요.',
    };
  }
  if (score >= 50) {
    return {
      label: '안정적 독해',
      colorClass: 'text-[#7A5200]',
      summary: '정확도가 잡히고 있어요. 속도를 조금씩 높여볼까요?',
    };
  }
  return {
    label: '입문 탐험가',
    colorClass: 'text-[#6E5E52]',
    summary: '꾸준히 문장을 풀면 정확도와 속도가 함께 올라가요.',
  };
}

function buildSampleSeries(range: RangeMode): ChartBucketPoint[] {
  if (range === '4w') {
    return [
      {
        key: 'w3',
        label: '3주 전',
        fullLabel: '3주 전 주간 기록',
        attempts: 14,
        correctAttempts: 9,
        accuracy: 64,
        avgSpeedSec: 42.5,
        skillScore: 58,
        timedCount: 14,
      },
      {
        key: 'w2',
        label: '2주 전',
        fullLabel: '2주 전 주간 기록',
        attempts: 18,
        correctAttempts: 13,
        accuracy: 72,
        avgSpeedSec: 34.8,
        skillScore: 67,
        timedCount: 18,
      },
      {
        key: 'w1',
        label: '지난주',
        fullLabel: '지난주 주간 기록',
        attempts: 22,
        correctAttempts: 18,
        accuracy: 82,
        avgSpeedSec: 26.4,
        skillScore: 78,
        timedCount: 22,
      },
      {
        key: 'w0',
        label: '이번 주',
        fullLabel: '이번 주 주간 기록',
        attempts: 20,
        correctAttempts: 18,
        accuracy: 90,
        avgSpeedSec: 19.6,
        skillScore: 88,
        timedCount: 20,
      },
    ];
  }

  const now = new Date();
  const sampleAcc = [60, 67, 75, 72, 83, 88, 92];
  const sampleSpeed = [41.0, 37.5, 33.0, 29.2, 25.4, 21.8, 18.5];
  const sampleAttempts = [5, 6, 8, 7, 9, 8, 10];

  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - idx));
    const acc = sampleAcc[idx];
    const spd = sampleSpeed[idx];
    const att = sampleAttempts[idx];
    const corr = Math.round((acc / 100) * att);
    const skill = Math.min(
      100,
      Math.round(acc * 0.5 + computeSpeedPoints(spd) + 14),
    );
    return {
      key: toLocalDateKey(d),
      label: `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`,
      fullLabel: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`,
      attempts: att,
      correctAttempts: corr,
      accuracy: acc,
      avgSpeedSec: spd,
      skillScore: skill,
      timedCount: att,
    };
  });
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: ChartBucketPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  mode: 'accuracy' | 'speed';
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  mode,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border-2 border-[#DFD2BE] bg-[#FFFDF8] px-3.5 py-2.5 shadow-md text-xs space-y-1">
      <div className="font-extrabold text-[#2D2620]">{point.fullLabel}</div>
      {point.attempts === 0 ? (
        <div className="text-[#7D6E61] font-semibold">풀이 기록 없음</div>
      ) : mode === 'accuracy' ? (
        <div className="space-y-0.5 tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#4C7A34] font-bold">정답률</span>
            <span className="font-mono font-extrabold text-[#2D2620]">
              {point.accuracy !== null ? `${point.accuracy}%` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#0E74A8] font-bold">해석 실력 점수</span>
            <span className="font-mono font-extrabold text-[#2D2620]">
              {point.skillScore !== null ? `${point.skillScore}점` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[#6E5E52]">
            <span>성공 / 시도</span>
            <span className="font-mono font-bold">
              {point.correctAttempts} / {point.attempts}회
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5 tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#B25E00] font-bold">평균 해석 속도</span>
            <span className="font-mono font-extrabold text-[#2D2620]">
              {point.avgSpeedSec !== null ? `${point.avgSpeedSec}초` : '미측정'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[#6E5E52]">
            <span>속도 측정 문항</span>
            <span className="font-mono font-bold">{point.timedCount}회</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const InterpretationAnalyticsDashboard: React.FC<
  InterpretationAnalyticsDashboardProps
> = ({
  history,
  progressById,
  totalQuestions,
  streakCount,
  reducedMotion = false,
}) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d');
  const [previewSample, setPreviewSample] = useState<boolean>(false);

  const completedQuestionsCount = useMemo(
    () => Object.values(progressById).filter((p) => p.completed).length,
    [progressById],
  );

  const realSeries = useMemo<ChartBucketPoint[]>(() => {
    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    if (rangeMode === '7d') {
      const buckets = new Map<string, HistoryEvent[]>();
      const days: Date[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(todayMidnight);
        d.setDate(todayMidnight.getDate() - i);
        days.push(d);
        buckets.set(toLocalDateKey(d), []);
      }

      history.forEach((ev) => {
        const dt = new Date(ev.timestamp);
        if (Number.isNaN(dt.getTime())) return;
        const key = toLocalDateKey(dt);
        const list = buckets.get(key);
        if (list) list.push(ev);
      });

      const consistencyBonus = Math.min(
        20,
        Math.round(
          (completedQuestionsCount / Math.max(totalQuestions, 1)) * 12 +
            Math.min(streakCount, 8),
        ),
      );

      return days.map((d) => {
        const key = toLocalDateKey(d);
        const events = buckets.get(key) ?? [];
        const attempts = events.length;
        const correctAttempts = events.filter((e) => e.isCorrect).length;
        const accuracy =
          attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : null;
        const timedEvents = events.filter(
          (e) =>
            typeof e.durationSec === 'number' &&
            Number.isFinite(e.durationSec) &&
            e.durationSec > 0,
        );
        const avgSpeedSec =
          timedEvents.length > 0
            ? Number(
                (
                  timedEvents.reduce((acc, e) => acc + (e.durationSec ?? 0), 0) /
                  timedEvents.length
                ).toFixed(1),
              )
            : null;
        const speedPts =
          avgSpeedSec !== null ? computeSpeedPoints(avgSpeedSec) : 15;
        const skillScore =
          accuracy !== null
            ? Math.min(
                100,
                Math.round(accuracy * 0.5 + speedPts + consistencyBonus),
              )
            : null;

        return {
          key,
          label: `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`,
          fullLabel: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`,
          attempts,
          correctAttempts,
          accuracy,
          avgSpeedSec,
          skillScore,
          timedCount: timedEvents.length,
        };
      });
    }

    // 4-week rolling buckets
    const weekDefs = [
      { key: 'w3', label: '3주 전', fullLabel: '3주 전 (21~27일 전)', minDays: 21, maxDays: 27 },
      { key: 'w2', label: '2주 전', fullLabel: '2주 전 (14~20일 전)', minDays: 14, maxDays: 20 },
      { key: 'w1', label: '지난주', fullLabel: '지난주 (7~13일 전)', minDays: 7, maxDays: 13 },
      { key: 'w0', label: '이번 주', fullLabel: '이번 주 (최근 7일)', minDays: 0, maxDays: 6 },
    ];

    const consistencyBonus = Math.min(
      20,
      Math.round(
        (completedQuestionsCount / Math.max(totalQuestions, 1)) * 12 +
          Math.min(streakCount, 8),
      ),
    );

    return weekDefs.map((wd) => {
      const events = history.filter((ev) => {
        const dt = new Date(ev.timestamp);
        if (Number.isNaN(dt.getTime())) return false;
        const evMidnight = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const diffDays = Math.floor(
          (todayMidnight.getTime() - evMidnight.getTime()) / 86400000,
        );
        return diffDays >= wd.minDays && diffDays <= wd.maxDays;
      });
      const attempts = events.length;
      const correctAttempts = events.filter((e) => e.isCorrect).length;
      const accuracy =
        attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : null;
      const timedEvents = events.filter(
        (e) =>
          typeof e.durationSec === 'number' &&
          Number.isFinite(e.durationSec) &&
          e.durationSec > 0,
      );
      const avgSpeedSec =
        timedEvents.length > 0
          ? Number(
              (
                timedEvents.reduce((acc, e) => acc + (e.durationSec ?? 0), 0) /
                timedEvents.length
              ).toFixed(1),
            )
          : null;
      const speedPts =
        avgSpeedSec !== null ? computeSpeedPoints(avgSpeedSec) : 15;
      const skillScore =
        accuracy !== null
          ? Math.min(
              100,
              Math.round(accuracy * 0.5 + speedPts + consistencyBonus),
            )
          : null;

      return {
        key: wd.key,
        label: wd.label,
        fullLabel: wd.fullLabel,
        attempts,
        correctAttempts,
        accuracy,
        avgSpeedSec,
        skillScore,
        timedCount: timedEvents.length,
      };
    });
  }, [history, rangeMode, completedQuestionsCount, totalQuestions, streakCount]);

  const sampleSeries = useMemo(
    () => buildSampleSeries(rangeMode),
    [rangeMode],
  );

  const activeSeries = previewSample ? sampleSeries : realSeries;

  // Overall Skill Score & Speed Summary
  const scoreSummary = useMemo(() => {
    if (previewSample) {
      return {
        skillScore: 88,
        accuracyScore: 45,
        speedScore: 26,
        consistencyScore: 17,
        avgAccuracy: 90,
        avgSpeedSec: 19.6,
        speedDeltaSec: -21.4,
        accuracyDeltaPct: 26,
        hasRealTimedData: true,
        hasAnyAttempts: true,
      };
    }

    const totalAttempts = history.length;
    const correctAttempts = history.filter((h) => h.isCorrect).length;
    const avgAccuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    const timedEvents = history.filter(
      (h) =>
        typeof h.durationSec === 'number' &&
        Number.isFinite(h.durationSec) &&
        h.durationSec > 0,
    );
    const avgSpeedSec =
      timedEvents.length > 0
        ? Number(
            (
              timedEvents.reduce((acc, e) => acc + (e.durationSec ?? 0), 0) /
              timedEvents.length
            ).toFixed(1),
          )
        : null;

    const accuracyScore = Math.round((avgAccuracy / 100) * 50);
    const speedScore =
      avgSpeedSec !== null
        ? computeSpeedPoints(avgSpeedSec)
        : totalAttempts > 0
          ? 14
          : 0;
    const directReadingCount = history.filter(
      (h) => h.activityType === 'direct_reading' || h.activityType === 'sentence_lab',
    ).length;
    const consistencyScore = Math.min(
      20,
      Math.round(
        (completedQuestionsCount / Math.max(totalQuestions, 1)) * 11 +
          Math.min(streakCount, 5) +
          Math.min(directReadingCount, 4),
      ),
    );
    const skillScore =
      totalAttempts > 0 || completedQuestionsCount > 0
        ? Math.min(100, accuracyScore + speedScore + consistencyScore)
        : 0;

    // Trend deltas across active buckets
    const activeAccBuckets = activeSeries.filter((p) => p.accuracy !== null);
    const accuracyDeltaPct =
      activeAccBuckets.length >= 2
        ? (activeAccBuckets[activeAccBuckets.length - 1].accuracy ?? 0) -
          (activeAccBuckets[0].accuracy ?? 0)
        : null;

    const activeSpeedBuckets = activeSeries.filter((p) => p.avgSpeedSec !== null);
    const speedDeltaSec =
      activeSpeedBuckets.length >= 2
        ? Number(
            (
              (activeSpeedBuckets[activeSpeedBuckets.length - 1].avgSpeedSec ?? 0) -
              (activeSpeedBuckets[0].avgSpeedSec ?? 0)
            ).toFixed(1),
          )
        : null;

    return {
      skillScore,
      accuracyScore,
      speedScore,
      consistencyScore,
      avgAccuracy,
      avgSpeedSec,
      speedDeltaSec,
      accuracyDeltaPct,
      hasRealTimedData: timedEvents.length > 0,
      hasAnyAttempts: totalAttempts > 0 || completedQuestionsCount > 0,
    };
  }, [
    previewSample,
    history,
    completedQuestionsCount,
    totalQuestions,
    streakCount,
    activeSeries,
  ]);

  const gradeInfo = getSkillGrade(scoreSummary.skillScore);
  const animDuration = reducedMotion ? 0 : 450;

  return (
    <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-5">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#58A700]" />
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2620] tracking-tight">
              문장 해석 실력 · 주간 성장 대시보드
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#5C4D42] font-medium">
            정답률과 문장당 해석 속도 변화를 함께 추적해 실력 점수로 보여드려요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="기간 선택"
            className="inline-flex items-center p-1 rounded-xl bg-[#F3ECE0] border border-[#DFD2BE]"
          >
            <button
              type="button"
              onClick={() => setRangeMode('7d')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                rangeMode === '7d'
                  ? 'bg-white text-[#2D2620] shadow-xs'
                  : 'text-[#6E5E52] hover:text-[#2D2620]'
              }`}
            >
              최근 7일
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('4w')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                rangeMode === '4w'
                  ? 'bg-white text-[#2D2620] shadow-xs'
                  : 'text-[#6E5E52] hover:text-[#2D2620]'
              }`}
            >
              최근 4주
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPreviewSample((v) => !v)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              previewSample
                ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#0D5B85]'
                : 'bg-white border-[#DFD2BE] text-[#5C4D42] hover:border-[#1CB0F6]'
            }`}
          >
            {previewSample ? '내 실제 기록 보기' : '예시 그래프 미리보기'}
          </button>
        </div>
      </div>

      {previewSample && (
        <div className="rounded-2xl border border-[#A9DDF5] bg-[#E8F7FF] px-4 py-2.5 text-xs font-bold text-[#0D5B85] flex flex-wrap items-center justify-between gap-2">
          <span>
            7일간 꾸준히 학습했을 때의 예시 추이 그래프를 보고 있어요.
          </span>
          <button
            type="button"
            onClick={() => setPreviewSample(false)}
            className="underline font-extrabold cursor-pointer"
          >
            내 실제 기록으로 돌아가기
          </button>
        </div>
      )}

      {/* Sentence Interpretation Skill Score Card */}
      <div className="rounded-2xl border-2 border-[#EAE0D0] bg-[#FFF9EF] p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#6E5E52]">
            <Award className="w-4 h-4 text-[#C68900]" />
            <span>종합 문장 해석 실력 점수</span>
            <span aria-hidden="true">·</span>
            <span className={`font-extrabold ${gradeInfo.colorClass}`}>
              {gradeInfo.label}
            </span>
          </div>

          <div className="flex items-baseline gap-2.5 tabular-nums">
            <span className="text-4xl sm:text-5xl font-extrabold text-[#2D2620] font-mono tracking-tight">
              {scoreSummary.skillScore}
            </span>
            <span className="text-base font-extrabold text-[#7D6E61]">/ 100점</span>
            {scoreSummary.accuracyDeltaPct !== null &&
              scoreSummary.accuracyDeltaPct !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-extrabold ${
                    scoreSummary.accuracyDeltaPct > 0
                      ? 'text-[#3E8E00]'
                      : 'text-[#C25D44]'
                  }`}
                >
                  {scoreSummary.accuracyDeltaPct > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  정답률 {scoreSummary.accuracyDeltaPct > 0 ? '+' : ''}
                  {scoreSummary.accuracyDeltaPct}%p
                </span>
              )}
          </div>

          <p className="text-xs sm:text-sm font-semibold text-[#5C4D42]">
            {scoreSummary.hasAnyAttempts
              ? gradeInfo.summary
              : '문제를 풀거나 직독직해 연습을 시작하면 실력 점수가 자동으로 계산돼요.'}
          </p>
        </div>

        {/* 3 Transparent Sub-Scores */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white border border-[#EAE0D0] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5C4D42]">
              <span>정확도</span>
              <span className="font-mono font-extrabold text-[#3E8E00] tabular-nums">
                {scoreSummary.accuracyScore} / 50
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#EFE9DD] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#58CC02] transition-all duration-300"
                style={{ width: `${(scoreSummary.accuracyScore / 50) * 100}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold text-[#7D6E61] tabular-nums">
              평균 정답률 {scoreSummary.avgAccuracy}%
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#EAE0D0] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5C4D42]">
              <span>해석 속도</span>
              <span className="font-mono font-extrabold text-[#B25E00] tabular-nums">
                {scoreSummary.speedScore} / 30
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#EFE9DD] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF9600] transition-all duration-300"
                style={{ width: `${(scoreSummary.speedScore / 30) * 100}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold text-[#7D6E61] tabular-nums">
              {scoreSummary.avgSpeedSec !== null
                ? `문장당 ${scoreSummary.avgSpeedSec}초`
                : '측정 기록 대기 중'}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#EAE0D0] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5C4D42]">
              <span>꾸준함 · 숙련</span>
              <span className="font-mono font-extrabold text-[#5B48A3] tabular-nums">
                {scoreSummary.consistencyScore} / 20
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#EFE9DD] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#7963A8] transition-all duration-300"
                style={{ width: `${(scoreSummary.consistencyScore / 20) * 100}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold text-[#7D6E61] tabular-nums">
              완료 {completedQuestionsCount}/{totalQuestions} · {streakCount}연속
            </div>
          </div>
        </div>
      </div>

      {/* Empty Hint Banner when no real attempts yet */}
      {!previewSample && history.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-[#DFD2BE] bg-[#FFFDF8] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-extrabold text-[#2D2620]">
              아직 그래프에 표시할 풀이 기록이 없어요
            </div>
            <div className="text-xs font-medium text-[#6E5E52]">
              직독직해 모드나 독해 문제를 1문제만 풀어도 정답률과 해석 속도가 즉시 기록됩니다.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreviewSample(true)}
            className="dq-btn-3d min-h-[40px] px-4 py-2 rounded-xl bg-[#FFF6DA] border-2 border-[#D4A72C] text-xs font-extrabold text-[#4B3200] cursor-pointer whitespace-nowrap"
          >
            예시 그래프로 미리보기
          </button>
        </div>
      )}

      {/* Dual Chart Grid: Weekly Accuracy + Speed Change */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Weekly Accuracy & Skill Score */}
        <div className="rounded-2xl border-2 border-[#EAE0D0] bg-white p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#2D2620]">
                <Target className="w-4 h-4 text-[#58CC02]" />
                <span>주간 정답률 & 해석 실력 변화</span>
              </div>
              <div className="text-xs text-[#6E5E52] font-medium mt-0.5 tabular-nums">
                초록 영역: 정답률(%) · 파란 선: 해석 점수(점)
              </div>
            </div>
            <div className="text-xs font-mono font-extrabold text-[#3E8E00] tabular-nums">
              목표 80%
            </div>
          </div>

          <div className="w-full h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={activeSeries}
                margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rqAccFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#58CC02" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#58CC02" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EFE8DC"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6E5E52', fontWeight: 600 }}
                  axisLine={{ stroke: '#E2DACB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: '#6E5E52', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip content={<CustomChartTooltip mode="accuracy" />} />
                <ReferenceLine
                  y={80}
                  stroke="#9BCB83"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="accuracy"
                  name="정답률"
                  stroke="#58CC02"
                  strokeWidth={2.5}
                  fill="url(#rqAccFill)"
                  connectNulls
                  dot={{ r: 4, fill: '#58CC02', stroke: '#FFFFFF', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  animationDuration={animDuration}
                />
                <Line
                  type="monotone"
                  dataKey="skillScore"
                  name="해석 점수"
                  stroke="#1CB0F6"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 3.5, fill: '#1CB0F6', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5 }}
                  animationDuration={animDuration}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Interpretation Speed Change */}
        <div className="rounded-2xl border-2 border-[#EAE0D0] bg-white p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#2D2620]">
                <Gauge className="w-4 h-4 text-[#FF9600]" />
                <span>문장당 해석 속도 변화 (초)</span>
              </div>
              <div className="text-xs text-[#6E5E52] font-medium mt-0.5 tabular-nums">
                막대가 낮아질수록 문장을 더 빠르게 해석하고 있어요
              </div>
            </div>
            <div className="text-xs font-extrabold tabular-nums">
              {scoreSummary.speedDeltaSec !== null ? (
                <span
                  className={`inline-flex items-center gap-1 ${
                    scoreSummary.speedDeltaSec <= 0
                      ? 'text-[#3E8E00]'
                      : 'text-[#B25E00]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  {scoreSummary.speedDeltaSec <= 0
                    ? `${Math.abs(scoreSummary.speedDeltaSec)}초 단축`
                    : `+${scoreSummary.speedDeltaSec}초 변동`}
                </span>
              ) : (
                <span className="text-[#7D6E61]">목표 25초</span>
              )}
            </div>
          </div>

          <div className="w-full h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={activeSeries}
                margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EFE8DC"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6E5E52', fontWeight: 600 }}
                  axisLine={{ stroke: '#E2DACB' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#6E5E52', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  unit="초"
                />
                <Tooltip content={<CustomChartTooltip mode="speed" />} />
                <ReferenceLine
                  y={25}
                  stroke="#C9B9E8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Bar
                  dataKey="avgSpeedSec"
                  name="평균 속도"
                  fill="#FF9600"
                  radius={[8, 8, 2, 2]}
                  maxBarSize={34}
                  animationDuration={animDuration}
                />
                <Line
                  type="monotone"
                  dataKey="avgSpeedSec"
                  name="속도 추세"
                  stroke="#7963A8"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 3.5, fill: '#7963A8', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5 }}
                  animationDuration={animDuration}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
