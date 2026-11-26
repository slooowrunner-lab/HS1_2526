import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudFog,
  Compass,
  Crown,
  Flag,
  Flower2,
  Gift,
  Lock,
  Search,
  Signpost,
  Sparkles,
  Star,
  Target,
  Telescope,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import { ExtractedQuestion, ExamYear } from '../types/question';
import { SECTION_META } from '../data/sections';
import { DailyQuestState, MissionProgress, NodeStatus } from '../types/game';
import {
  formatItemNumber,
  getDailyQuestCatalog,
  getFoxGearCatalog,
  getWeeklyAttendance,
} from '../utils/gameStorage';
import { MascotWidget } from './MascotWidget';
import { computeZoneEnvironmentMap } from '../controllers/EnvironmentStateController';
import {
  buildZoneInteractiveObjects,
  MapInteractiveObject,
} from '../controllers/InteractiveObjectController';
import { useCharacterMovement } from '../controllers/CharacterMovementController';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';
import springIslandImg from '../assets/images/island_spring_meadow_1795522642442.jpg';
import lakeIslandImg from '../assets/images/island_garden_lake_1795522643059.jpg';

interface AdventureMapProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  nodeStatusMap: Record<string, NodeStatus>;
  dailyQuest: DailyQuestState;
  dailyGoalTarget?: number;
  attendanceDates?: string[];
  level?: number;
  equippedGearId?: string;
  onEquipGear?: (gearId: string) => void;
  onOpenTeacherMode?: () => void;
  clearedBossZones: Record<string, string>;
  collectedMapObjects: Record<string, string>;
  justCompletedQuestionId: string | null;
  justUnlockedZone: boolean;
  currentStreak: number;
  nickname: string;
  freeExploreMode: boolean;
  onToggleFreeExplore: () => void;
  onStartMission: (questionId: string) => void;
  onStartZoneBoss: (
    examYear: ExamYear,
    sectionNumber: number,
    zoneName: string,
    sectionTitle: string,
  ) => void;
  onCollectMapObject: (obj: MapInteractiveObject) => void;
  lastActiveQuestionId: string | null;
  onIslandChange?: (island: ExamYear) => void;
  onOpenVocabQuiz?: () => void;
  onOpenDirectReading?: () => void;
}

const ZONE_FLAVOR: Record<
  number,
  { zoneName: string; accentBg: string; borderColor: string }
> = {
  1: { zoneName: '산들바람 목적 언덕', accentBg: 'bg-[#9BCB83]/15', borderColor: 'border-[#9BCB83]/50' },
  2: { zoneName: '감정의 오솔길', accentBg: 'bg-[#FFE18A]/25', borderColor: 'border-[#FFE18A]/70' },
  3: { zoneName: '도표 · 안내문 전망대', accentBg: 'bg-[#A9DDF5]/25', borderColor: 'border-[#A9DDF5]/70' },
  4: { zoneName: '비밀 함의 정원', accentBg: 'bg-[#C9B9E8]/20', borderColor: 'border-[#C9B9E8]/60' },
  5: { zoneName: '어법의 돌다리', accentBg: 'bg-[#A8DCC8]/25', borderColor: 'border-[#A8DCC8]/70' },
  6: { zoneName: '어휘 나침반 숲', accentBg: 'bg-[#FFE18A]/20', borderColor: 'border-[#FFE18A]/60' },
  7: { zoneName: '빈칸 추론 동굴', accentBg: 'bg-[#F39A83]/15', borderColor: 'border-[#F39A83]/50' },
  8: { zoneName: '이야기 순서 산책로', accentBg: 'bg-[#A9DDF5]/20', borderColor: 'border-[#A9DDF5]/60' },
  9: { zoneName: '요약문 등대', accentBg: 'bg-[#9BCB83]/20', borderColor: 'border-[#9BCB83]/60' },
  10: { zoneName: '긴 글 탐험 본부', accentBg: 'bg-[#C9B9E8]/25', borderColor: 'border-[#C9B9E8]/70' },
};

const LAVENDER_ZONE_FLAVOR: Record<
  number,
  { accentBg: string; borderColor: string }
> = {
  1: { accentBg: 'bg-[#EAE4FC]/70', borderColor: 'border-[#9C86D4]/65' },
  2: { accentBg: 'bg-[#E3EFFC]/75', borderColor: 'border-[#6FA4DC]/65' },
  3: { accentBg: 'bg-[#ECE8FD]/75', borderColor: 'border-[#7E82D4]/65' },
  4: { accentBg: 'bg-[#E4F2FC]/75', borderColor: 'border-[#5D9EC0]/65' },
  5: { accentBg: 'bg-[#E9E2FA]/70', borderColor: 'border-[#8B74C9]/65' },
  6: { accentBg: 'bg-[#E5EEFD]/75', borderColor: 'border-[#6B92D6]/65' },
  7: { accentBg: 'bg-[#EDE7FC]/75', borderColor: 'border-[#7963A8]/65' },
  8: { accentBg: 'bg-[#E2F0FC]/75', borderColor: 'border-[#5D9EC0]/65' },
  9: { accentBg: 'bg-[#E9E7FC]/75', borderColor: 'border-[#777AC9]/65' },
  10: { accentBg: 'bg-[#EAE2FB]/80', borderColor: 'border-[#6A52A3]/65' },
};

const NODE_OFFSET_CLASS = [
  'sm:-translate-x-10',
  'sm:translate-x-12',
  'sm:-translate-x-5',
  'sm:translate-x-14',
  'sm:-translate-x-10',
];

export const AdventureMap: React.FC<AdventureMapProps> = ({
  questions,
  progressById,
  nodeStatusMap,
  dailyQuest,
  dailyGoalTarget = 3,
  attendanceDates = [],
  level = 1,
  equippedGearId = 'gear_1',
  onEquipGear,
  onOpenTeacherMode,
  clearedBossZones,
  collectedMapObjects,
  justCompletedQuestionId,
  justUnlockedZone,
  currentStreak,
  nickname,
  freeExploreMode,
  onToggleFreeExplore,
  onStartMission,
  onStartZoneBoss,
  onCollectMapObject,
  lastActiveQuestionId,
  onIslandChange,
  onOpenVocabQuiz,
  onOpenDirectReading,
}) => {
  const [selectedIsland, setSelectedIsland] = useState<ExamYear>(() => {
    if (lastActiveQuestionId) {
      const found = questions.find((q) => q.id === lastActiveQuestionId);
      if (found) return found.examYear;
    }
    return '2025';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyThreePts, setOnlyThreePts] = useState(false);
  const [lockedNoticeId, setLockedNoticeId] = useState<string | null>(null);
  const [springImgError, setSpringImgError] = useState(false);
  const [lakeImgError, setLakeImgError] = useState(false);
  const [charImgError, setCharImgError] = useState(false);
  const [charBubbleOpen, setCharBubbleOpen] = useState(false);
  const [collapsedZones, setCollapsedZones] = useState<Record<number, boolean>>(() => {
    const initialYr: ExamYear =
      (lastActiveQuestionId
        ? questions.find((q) => q.id === lastActiveQuestionId)?.examYear
        : undefined) ?? '2025';
    const initialTarget =
      (lastActiveQuestionId
        ? questions.find(
            (q) =>
              q.id === lastActiveQuestionId &&
              q.examYear === initialYr &&
              !progressById[q.id]?.completed,
          )
        : undefined) ??
      questions.find((q) => q.examYear === initialYr && !progressById[q.id]?.completed) ??
      questions.find((q) => q.examYear === initialYr);
    const activeSec = initialTarget?.sectionNumber ?? 1;
    const init: Record<number, boolean> = {};
    SECTION_META.forEach((sec) => {
      init[sec.number] = sec.number !== activeSec;
    });
    return init;
  });
  const [scrollToActiveNonce, setScrollToActiveNonce] = useState(0);

  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const isLavender = selectedIsland === '2026';
  const islandTheme = isLavender ? 'lavender' : 'spring';

  useEffect(() => {
    onIslandChange?.(selectedIsland);
  }, [selectedIsland, onIslandChange]);

  const islandStats = useMemo(() => {
    const calc = (yr: ExamYear) => {
      const items = questions.filter((q) => q.examYear === yr);
      const completed = items.filter((q) => progressById[q.id]?.completed).length;
      const totalStars = items.reduce(
        (acc, q) => acc + (progressById[q.id]?.stars ?? 0),
        0,
      );
      return {
        total: items.length,
        completed,
        totalStars,
        maxStars: items.length * 3,
        pct: items.length ? Math.round((completed / items.length) * 100) : 0,
      };
    };
    return { '2025': calc('2025'), '2026': calc('2026') };
  }, [questions, progressById]);

  const examPosById = useMemo(() => {
    const map = new Map<string, { index: number; total: number }>();
    (['2025', '2026'] as ExamYear[]).forEach((yr) => {
      const yrItems = questions.filter((q) => q.examYear === yr);
      yrItems.forEach((q, idx) => {
        map.set(q.id, { index: idx + 1, total: yrItems.length });
      });
    });
    return map;
  }, [questions]);

  const getTargetQuestionForIsland = useCallback(
    (yr: ExamYear): ExtractedQuestion | undefined => {
      if (lastActiveQuestionId) {
        const last = questions.find((q) => q.id === lastActiveQuestionId);
        if (last && last.examYear === yr && !progressById[last.id]?.completed) {
          return last;
        }
      }
      const inProg = questions.find(
        (q) => q.examYear === yr && nodeStatusMap[q.id] === 'in_progress',
      );
      if (inProg) return inProg;
      const nextUnfinished = questions.find(
        (q) => q.examYear === yr && !progressById[q.id]?.completed,
      );
      if (nextUnfinished) return nextUnfinished;
      if (lastActiveQuestionId) {
        const last = questions.find((q) => q.id === lastActiveQuestionId);
        if (last && last.examYear === yr) return last;
      }
      return questions.find((q) => q.examYear === yr) ?? questions[0];
    },
    [questions, lastActiveQuestionId, progressById, nodeStatusMap],
  );

  const activeNodeOnSelectedIsland = useMemo(
    () => getTargetQuestionForIsland(selectedIsland),
    [getTargetQuestionForIsland, selectedIsland],
  );

  const currentHeroMission = activeNodeOnSelectedIsland;

  const { characterNodeId, motionState } = useCharacterMovement(
    activeNodeOnSelectedIsland?.id ?? null,
    justCompletedQuestionId,
    justUnlockedZone,
  );

  useEffect(() => {
    if (scrollToActiveNonce <= 0) return;
    const timerId = window.setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 90);
    return () => window.clearTimeout(timerId);
  }, [scrollToActiveNonce, selectedIsland]);

  const zoneEnvMap = useMemo(
    () =>
      computeZoneEnvironmentMap(
        questions,
        progressById,
        selectedIsland,
        freeExploreMode,
      ),
    [questions, progressById, selectedIsland, freeExploreMode],
  );

  const zonesOnIsland = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const islandQuestions = questions.filter((q) => {
      if (q.examYear !== selectedIsland) return false;
      if (onlyThreePts && q.points !== 3) return false;
      if (!qLower) return true;
      return (
        q.sourceExam.toLowerCase().includes(qLower) ||
        q.sectionTitle.toLowerCase().includes(qLower) ||
        q.prompt.toLowerCase().includes(qLower) ||
        q.topicSummary.toLowerCase().includes(qLower)
      );
    });

    return SECTION_META.map((sec) => {
      const sameSectionAllYearsCount = questions.filter(
        (q) => q.sectionNumber === sec.number,
      ).length;
      const bossCount = Math.min(3, sameSectionAllYearsCount);
      return {
        section: sec,
        flavor: ZONE_FLAVOR[sec.number] ?? ZONE_FLAVOR[1],
        items: islandQuestions.filter((q) => q.sectionNumber === sec.number),
        bossCount,
      };
    }).filter((z) => z.items.length > 0);
  }, [questions, selectedIsland, searchQuery, onlyThreePts]);

  const dailyProgressList = useMemo(() => {
    const catalog = getDailyQuestCatalog(dailyGoalTarget);
    return [
      {
        ...catalog[0],
        current: Math.min(dailyQuest.solvedTodayIds.length, catalog[0].target),
        done: dailyQuest.solvedTodayIds.length >= catalog[0].target,
      },
      {
        ...catalog[1],
        current: Math.min(dailyQuest.cluesTodayCount, catalog[1].target),
        done: dailyQuest.cluesTodayCount >= catalog[1].target,
      },
      {
        ...catalog[2],
        current: Math.min(
          dailyQuest.threePtSolvedTodayIds.length,
          catalog[2].target,
        ),
        done: dailyQuest.threePtSolvedTodayIds.length >= catalog[2].target,
      },
    ];
  }, [dailyQuest, dailyGoalTarget]);

  const recommendedThree = useMemo(() => {
    const sectionWeakScore: Record<number, number> = {};
    SECTION_META.forEach((sec) => {
      const secItems = questions.filter((q) => q.sectionNumber === sec.number);
      const wrongOrRetry = secItems.reduce((acc, q) => {
        const p = progressById[q.id];
        if (!p) return acc;
        if (p.attempts > 0 && !p.completed) return acc + 3;
        if (p.attempts > 1) return acc + 1;
        return acc;
      }, 0);
      const solvedCnt = secItems.filter((q) => progressById[q.id]?.completed).length;
      sectionWeakScore[sec.number] = wrongOrRetry * 10 + (secItems.length - solvedCnt);
    });

    const pool = questions.filter((q) => !progressById[q.id]?.completed);
    const candidates = pool.length > 0 ? pool : questions;

    const scored = candidates.map((q) => {
      const prog = progressById[q.id];
      const isRetry = Boolean(prog && prog.attempts > 0 && !prog.completed);
      const isInProgress = Boolean(prog?.started && !prog?.completed);
      const sameIslandBonus = q.examYear === selectedIsland ? 25 : 0;
      const weakScore = sectionWeakScore[q.sectionNumber] ?? 0;
      const score =
        (isRetry ? 200 : 0) +
        (isInProgress ? 120 : 0) +
        sameIslandBonus +
        weakScore * 3 -
        q.globalIndex * 0.1;

      const reason = isRetry
        ? '다시 도전 추천'
        : isInProgress
          ? '풀던 문제 이어서'
          : weakScore >= 20
            ? '취약 단원 보강'
            : '오늘의 추천';

      return { question: q, score, reason };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [questions, progressById, selectedIsland]);

  const weeklyAttendance = useMemo(
    () => getWeeklyAttendance(attendanceDates),
    [attendanceDates],
  );
  const foxGearCatalog = useMemo(() => getFoxGearCatalog(level), [level]);

  const toggleZoneCollapse = (secNum: number) => {
    setCollapsedZones((prev) => ({ ...prev, [secNum]: !prev[secNum] }));
  };

  const allCollapsed =
    zonesOnIsland.length > 0 &&
    zonesOnIsland.every((z) => collapsedZones[z.section.number]);

  const handleToggleAllZones = () => {
    const nextState: Record<number, boolean> = {};
    zonesOnIsland.forEach((z) => {
      nextState[z.section.number] = !allCollapsed;
    });
    setCollapsedZones(nextState);
  };

  const handleSelectIsland = (yr: ExamYear) => {
    const target = getTargetQuestionForIsland(yr);
    setSelectedIsland(yr);
    setLockedNoticeId(null);
    setCharBubbleOpen(false);
    if (target) {
      const nextCollapsed: Record<number, boolean> = {};
      SECTION_META.forEach((sec) => {
        nextCollapsed[sec.number] = sec.number !== target.sectionNumber;
      });
      setCollapsedZones(nextCollapsed);
      if (onlyThreePts && target.points !== 3) {
        setOnlyThreePts(false);
      }
      if (searchQuery.trim()) {
        setSearchQuery('');
      }
    }
    setScrollToActiveNonce((n) => n + 1);
  };

  const handleJumpToActive = () => {
    const target = activeNodeOnSelectedIsland;
    if (!target) return;
    setCollapsedZones((prev) => ({
      ...prev,
      [target.sectionNumber]: false,
    }));
    if (onlyThreePts && target.points !== 3) {
      setOnlyThreePts(false);
    }
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
    setScrollToActiveNonce((n) => n + 1);
  };

  const handleNodeClick = (q: ExtractedQuestion, status: NodeStatus) => {
    if (status === 'locked') {
      setLockedNoticeId(q.id);
      return;
    }
    setLockedNoticeId(null);
    onStartMission(q.id);
  };

  return (
    <div className="space-y-5">
      {/* Top Hero Welcome & Island Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div
          className={`lg:col-span-5 clay-card rounded-3xl p-5 flex flex-col justify-between gap-4 ${
            isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
          }`}
        >
          {/* Compact Gamified Player Status Bar */}
          <div
            className={`rounded-2xl border px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold tabular-nums ${
              isLavender
                ? 'bg-[#F3F1FC] border-[#D3CCEE] text-[#211442]'
                : 'bg-[#FFFDF6] border-[#EAE0D0] text-[#2D2620]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-extrabold text-white ${
                  isLavender ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
                }`}
              >
                LV.{level}
              </span>
              <span className="truncate">{nickname} 탐험가</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className={isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}>
                전체 {islandStats['2025'].completed + islandStats['2026'].completed}/{questions.length}
              </span>
              <span className="text-[#B47A00]">
                ★ {islandStats['2025'].totalStars + islandStats['2026'].totalStars}
              </span>
            </div>
          </div>

          <MascotWidget
            mood={
              currentHeroMission && nodeStatusMap[currentHeroMission.id] === 'completed'
                ? 'complete'
                : 'idle'
            }
            nickname={nickname}
            currentStreak={currentStreak}
            islandTheme={islandTheme}
            level={level}
            equippedGearId={equippedGearId}
            customMessage={
              currentHeroMission
                ? `지금 ${isLavender ? '라벤더 호수 섬' : '봄빛 초원 섬'}에서 풀 곳은 "${currentHeroMission.sourceExam} · ${currentHeroMission.sectionTitle}"이야! 준비됐니?`
                : undefined
            }
          />

          {currentHeroMission && (() => {
            const hasStartedOnIsland = questions.some(
              (q) =>
                q.examYear === selectedIsland &&
                (progressById[q.id]?.started || progressById[q.id]?.completed),
            );
            return (
              <div
                className={`border-2 rounded-2xl p-4 flex items-center justify-between gap-3 ${
                  isLavender
                    ? 'bg-[#F3F1FC] border-[#C9B9E8]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0]'
                }`}
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs font-extrabold tabular-nums ${
                      isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'
                    }`}
                  >
                    {hasStartedOnIsland ? '지금 풀 차례' : '첫 번째 문제'} ·{' '}
                    {formatItemNumber(currentHeroMission.originalItemNumber)} (
                    {examPosById.get(currentHeroMission.id)?.index ?? 1} /{' '}
                    {examPosById.get(currentHeroMission.id)?.total ?? 28}문항)
                  </div>
                  <div className={`text-sm sm:text-base font-bold truncate mt-0.5 ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                    {currentHeroMission.sourceExam} · {currentHeroMission.sectionTitle}
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
                    {currentHeroMission.pages.map((p) => `${p}p`).join('–')} ·{' '}
                    {currentHeroMission.points}점
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartMission(currentHeroMission.id)}
                  className={`dq-btn-3d min-h-[46px] px-4 py-2.5 rounded-2xl border-2 font-extrabold text-xs sm:text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-white ${
                    isLavender
                      ? 'bg-[#7C5CBF] border-[#5B40A0] hover:bg-[#896ACC]'
                      : 'bg-[#58CC02] border-[#46A302] hover:bg-[#61D805]'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>{hasStartedOnIsland ? '바로 풀기' : '시작하기'}</span>
                </button>
              </div>
            );
          })()}
        </div>

        {/* Right: Dual-Island Selector Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSelectIsland('2025')}
            className={`group rq-hover-lift text-left rounded-3xl overflow-hidden transition-all cursor-pointer flex flex-col ${
              selectedIsland === '2025'
                ? 'clay-card ring-4 ring-[#9BCB83]/60 border-[#5D8A43]'
                : 'clay-card-soft opacity-95 hover:opacity-100'
            }`}
          >
            <div className="relative h-32 sm:h-36 w-full bg-[#A9DDF5] overflow-hidden">
              {springImgError ? (
                <div className="w-full h-full flex items-center justify-center bg-[#9BCB83]/40 text-[#2D2620] text-xs font-semibold">
                  2025 봄빛 초원 섬
                </div>
              ) : (
                <img
                  src={springIslandImg}
                  alt="제1탐험섬 2025 봄빛 초원 섬"
                  onError={() => setSpringImgError(true)}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
              )}
              <div className="absolute top-3 left-3 bg-[#FFF9EF]/95 border border-[#EAE0D0] px-2.5 py-1 rounded-lg text-xs font-bold text-[#2D2620] shadow-xs">
                제1시험지 · 2025
              </div>
              {selectedIsland === '2025' && (
                <div className="rq-float-gentle absolute top-3 right-3 bg-[#9BCB83] border border-[#5D8A43]/30 px-2.5 py-1 rounded-lg text-xs font-bold text-[#1F3514] flex items-center gap-1 shadow-xs">
                  <Flag className="w-3 h-3" />
                  <span>선택됨</span>
                </div>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-[#2D2620]">
                  2025년 3월 학력평가
                </h2>
                <p className="text-sm text-[#6E5E52] mt-0.5">
                  봄빛 초원 테마에서 2025년 3월 기출 28문제를 풀어요.
                </p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#5C4D42] tabular-nums">
                  <span>
                    완료 {islandStats['2025'].completed} / {islandStats['2025'].total} · ★{' '}
                    {islandStats['2025'].totalStars}/{islandStats['2025'].maxStars}
                  </span>
                  <span>{islandStats['2025'].pct}%</span>
                </div>
                <div className="h-3.5 bg-[#EFECE5] rounded-full overflow-hidden border border-[#E2DACB]">
                  <div
                    className="h-full bg-[#58CC02] rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${islandStats['2025'].pct}%` }}
                  >
                    <div className="h-1 bg-white/35 rounded-full mx-1 mt-0.5" />
                    {islandStats['2025'].pct > 0 && (
                      <div
                        aria-hidden="true"
                        className="rq-progress-glint absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-[#7D6E61] pt-0.5 tabular-nums">
                  {[25, 50, 100].map((m) => {
                    const reached = islandStats['2025'].pct >= m;
                    return (
                      <span
                        key={m}
                        className={reached ? 'text-[#3D6A27] font-extrabold' : 'opacity-70'}
                      >
                        {reached ? '✓ ' : ''}
                        {m}% 스탬프
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectIsland('2026')}
            className={`group rq-hover-lift text-left rounded-3xl overflow-hidden transition-all cursor-pointer flex flex-col ${
              selectedIsland === '2026'
                ? 'clay-card ring-4 ring-[#8E7AD6]/75 !border-[#6A52A3]'
                : 'clay-card-soft opacity-95 hover:opacity-100'
            }`}
          >
            <div className="relative h-32 sm:h-36 w-full bg-[#A9DDF5] overflow-hidden">
              {lakeImgError ? (
                <div className="w-full h-full flex items-center justify-center bg-[#C9B9E8]/50 text-[#1D1B42] text-xs font-semibold">
                  2026년 3월 학력평가
                </div>
              ) : (
                <img
                  src={lakeIslandImg}
                  alt="제2시험지 2026 라벤더 호수 테마"
                  onError={() => setLakeImgError(true)}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
              )}
              <div className="absolute top-3 left-3 bg-[#F4F2FC]/95 border border-[#C9B9E8] px-2.5 py-1 rounded-lg text-xs font-bold text-[#211442] shadow-xs">
                제2시험지 · 2026
              </div>
              {selectedIsland === '2026' && (
                <div className="rq-float-gentle absolute top-3 right-3 bg-[#C9B9E8] border border-[#6A52A3]/40 px-2.5 py-1 rounded-lg text-xs font-bold text-[#211442] flex items-center gap-1 shadow-xs">
                  <Flag className="w-3 h-3" />
                  <span>선택됨</span>
                </div>
              )}
            </div>
            <div className={`p-4 flex-1 flex flex-col justify-between ${selectedIsland === '2026' ? 'bg-[#FAF9FF]' : 'bg-white'}`}>
              <div>
                <h2 className="text-lg font-extrabold text-[#1D1B42]">
                  2026년 3월 학력평가
                </h2>
                <p className="text-sm text-[#4C497A] mt-0.5">
                  라벤더 호수 테마에서 2026년 3월 최신 기출 28문제를 풀어요.
                </p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#49467A] tabular-nums">
                  <span>
                    완료 {islandStats['2026'].completed} / {islandStats['2026'].total} · ★{' '}
                    {islandStats['2026'].totalStars}/{islandStats['2026'].maxStars}
                  </span>
                  <span>{islandStats['2026'].pct}%</span>
                </div>
                <div className="h-3.5 bg-[#E6E4F6] rounded-full overflow-hidden border border-[#D4CEF0]">
                  <div
                    className="h-full bg-gradient-to-r from-[#7C5CBF] to-[#4F8EDB] rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${islandStats['2026'].pct}%` }}
                  >
                    <div className="h-1 bg-white/35 rounded-full mx-1 mt-0.5" />
                    {islandStats['2026'].pct > 0 && (
                      <div
                        aria-hidden="true"
                        className="rq-progress-glint absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-[#636094] pt-0.5 tabular-nums">
                  {[25, 50, 100].map((m) => {
                    const reached = islandStats['2026'].pct >= m;
                    return (
                      <span
                        key={m}
                        className={reached ? 'text-[#4B3B94] font-extrabold' : 'opacity-70'}
                      >
                        {reached ? '✓ ' : ''}
                        {m}% 스탬프
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Today's Recommended 3 Questions + 1-Min Vocab Quiz Quick Launcher */}
      {recommendedThree.length > 0 && (
        <section
          className={`clay-card rounded-2xl p-4 sm:p-5 space-y-3 ${
            isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#58A700]'}`} />
              <h2 className={`text-base sm:text-lg font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                오늘의 추천 3문제
              </h2>
              <span className={`text-xs font-semibold ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
                내 기록을 바탕으로 골랐어요
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenDirectReading && (
                <button
                  type="button"
                  onClick={onOpenDirectReading}
                  className={`dq-btn-3d min-h-[40px] px-3.5 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                    isLavender
                      ? 'bg-[#D7FFB8] border-[#46A302] text-[#1E4600] hover:bg-[#C7F9A0]'
                      : 'bg-[#EEFFD9] border-[#58CC02] text-[#1E4600] hover:bg-[#D7FFB8]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-[#46A302]" />
                  <span>직독직해 연습</span>
                </button>
              )}

              {onOpenVocabQuiz && (
                <button
                  type="button"
                  onClick={onOpenVocabQuiz}
                  className={`dq-btn-3d min-h-[40px] px-3.5 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                    isLavender
                      ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#211442] hover:bg-[#DFD6FA]'
                      : 'bg-[#FFF6DA] border-[#D4A72C] text-[#4B3200] hover:bg-[#FFE18A]'
                  }`}
                >
                  <Zap className="w-4 h-4 text-[#FF9600]" />
                  <span>어휘 퀴즈</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendedThree.map(({ question: rq, reason }) => (
              <button
                key={rq.id}
                type="button"
                onClick={() => onStartMission(rq.id)}
                className={`dq-btn-3d text-left rounded-2xl border-2 p-3.5 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                  isLavender
                    ? 'bg-[#F3F1FC] border-[#C9C2E8] hover:border-[#6A52A3]'
                    : 'bg-[#FFFDF8] border-[#EAE0D0] hover:border-[#58CC02]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                  <span className={isLavender ? 'text-[#5B48A3]' : 'text-[#58A700]'}>
                    {reason}
                  </span>
                  <span className="font-mono text-[#6E5E52] tabular-nums">
                    {rq.examYear} · {formatItemNumber(rq.originalItemNumber)} · {rq.points}점
                  </span>
                </div>
                <div className={`text-sm sm:text-base font-extrabold truncate ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                  {rq.sectionTitle}
                </div>
                <p className={`text-xs line-clamp-1 ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}>
                  {rq.topicSummary}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Daily quests moved below question map so students see problem list immediately */}

      {/* Adventure Map Control Bar */}
      <div
        className={`clay-card rounded-2xl p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 ${
          isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-xs">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="단원 · 문항 번호 · 주제 검색"
              aria-label="탐험 지도 검색"
              className={`w-full min-h-[44px] pl-9 pr-9 py-2 text-xs sm:text-sm border-2 rounded-2xl focus:outline-none ${
                isLavender
                  ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#1D1B42] placeholder:text-[#7E79A8] focus:border-[#6A52A3]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620] placeholder:text-[#9D8E80] focus:border-[#1CB0F6]'
              }`}
            />
            {searchQuery.trim() !== '' && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="검색어 지우기"
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                  isLavender
                    ? 'bg-[#E5DFFA] text-[#5B48A3] hover:bg-[#D5CCF6]'
                    : 'bg-[#EFE6D6] text-[#6E5E52] hover:bg-[#E2D6C0]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOnlyThreePts((p) => !p)}
            className={`dq-btn-3d min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border-2 whitespace-nowrap shrink-0 cursor-pointer ${
              onlyThreePts
                ? isLavender
                  ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#211442]'
                  : 'bg-[#FFE18A] border-[#D4A72C] text-[#2D2620]'
                : isLavender
                  ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#49467A] hover:border-[#6A52A3]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
            }`}
          >
            3점만
          </button>

          <button
            type="button"
            onClick={handleJumpToActive}
            className={`dq-btn-3d min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border-2 bg-white whitespace-nowrap shrink-0 cursor-pointer ${
              isLavender
                ? 'border-[#9BBCEB] text-[#1D2D5E] hover:border-[#4A76C2]'
                : 'border-[#EAE0D0] text-[#2D2620] hover:border-[#1CB0F6]'
            }`}
          >
            내 위치
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleAllZones}
            className={`dq-btn-3d min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border-2 whitespace-nowrap shrink-0 cursor-pointer ${
              isLavender
                ? 'border-[#C9C2E8] bg-[#F3F1FC] text-[#49467A] hover:text-[#1D1B42]'
                : 'border-[#EAE0D0] bg-[#FFF9EF] text-[#5C4D42] hover:text-[#2D2620]'
            }`}
          >
            {allCollapsed ? '모두 펼치기' : '모두 접기'}
          </button>

          <button
            type="button"
            onClick={onToggleFreeExplore}
            className={`dq-btn-3d min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border-2 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              freeExploreMode
                ? isLavender
                  ? 'bg-[#A9DDF5] border-[#4A76C2] text-[#133554]'
                  : 'bg-[#A8DCC8] border-[#4D9479] text-[#1A4234]'
                : isLavender
                  ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#49467A]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
            }`}
          >
            {freeExploreMode ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>자유 선택</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>순서 풀기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inline Friendly Locked Notice */}
      {lockedNoticeId && (
        <div
          className={`clay-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 ${
            isLavender
              ? '!bg-[#EAE3FA] !border-[#6A52A3]'
              : 'bg-[#FFE18A]/35 border-[#D4A72C]'
          }`}
        >
          <div className={`flex items-center gap-2.5 text-sm font-medium ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
            <Lock className={`w-4 h-4 shrink-0 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`} />
            <span>
              순서대로 풀기 상태에서는 앞 문제를 먼저 풀어야 열려요. &apos;모든 문제 열림&apos;으로 바꾸면 바로 풀 수 있어요!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onToggleFreeExplore();
                setLockedNoticeId(null);
              }}
              className={`clay-btn px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                isLavender
                  ? 'bg-[#A9DDF5] text-[#133554]'
                  : 'bg-[#A8DCC8] text-[#1A4234]'
              }`}
            >
              모든 문제 열기
            </button>
            <button
              type="button"
              onClick={() => setLockedNoticeId(null)}
              className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${isLavender ? 'text-[#49467A] hover:text-[#1D1B42]' : 'text-[#5C4D42] hover:text-[#2D2620]'}`}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Scenic Winding Island Map Canvas */}
      <div
        className={`relative rounded-3xl border-2 p-4 sm:p-8 overflow-hidden ${
          isLavender
            ? 'border-[#B6B8E6] bg-gradient-to-b from-[#DFEBFB] via-[#EAE6FA] to-[#F3F5FF]'
            : 'border-[#DFD2BE] bg-gradient-to-b from-[#E4F4FC] via-[#EFF9EC] to-[#FFF9EF]'
        }`}
      >
        {zonesOnIsland.length === 0 ? (
          <div className="clay-card rounded-2xl p-10 text-center max-w-md mx-auto my-8">
            <p className="text-base font-bold text-[#2D2620]">
              검색 조건에 맞는 문제가 없어요
            </p>
            <p className="text-xs text-[#6E5E52] mt-1">
              검색어를 지우거나 3점 필터를 해제해 보세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setOnlyThreePts(false);
              }}
              className={`clay-btn mt-4 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                isLavender
                  ? 'bg-[#A9DDF5] text-[#133554]'
                  : 'bg-[#A8DCC8] text-[#1A4234]'
              }`}
            >
              전체 문제 다시 보기
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {zonesOnIsland.map((zone) => {
              const allItemsInZone = questions.filter(
                (q) =>
                  q.examYear === selectedIsland &&
                  q.sectionNumber === zone.section.number,
              );
              const completedInZone = zone.items.filter(
                (i) => progressById[i.id]?.completed,
              ).length;
              const isCollapsed =
                !searchQuery.trim() &&
                !onlyThreePts &&
                Boolean(collapsedZones[zone.section.number]);
              const zoneKey = `${selectedIsland}-${zone.section.number}`;
              const bossCleared = Boolean(clearedBossZones[zoneKey]);
              const bossMins = Math.round((zone.bossCount * 80) / 60);
              const envInfo = zoneEnvMap[zone.section.number];
              const isFoggy = envInfo?.fogState === 'foggy';
              const isMastered = envInfo?.fogState === 'mastered';
              const interactiveObjects = buildZoneInteractiveObjects(
                selectedIsland,
                zone.section.number,
                allItemsInZone,
                progressById,
                collectedMapObjects,
              );
              const lavFlavor =
                LAVENDER_ZONE_FLAVOR[zone.section.number] ?? LAVENDER_ZONE_FLAVOR[1];
              const zoneBorderBg = isMastered
                ? isLavender
                  ? 'border-[#5B52A3] bg-[#C9B9E8]/32'
                  : 'border-[#5D8A43] bg-[#9BCB83]/18'
                : isFoggy
                  ? isLavender
                    ? 'border-[#B8B6D8] bg-[#EAEAF5]/85'
                    : 'border-[#C9BFB0] bg-[#EFE9DF]/85'
                  : isLavender
                    ? `${lavFlavor.borderColor} ${lavFlavor.accentBg}`
                    : `${zone.flavor.borderColor} ${zone.flavor.accentBg}`;

              return (
                <section
                  key={zone.section.number}
                  className={`rounded-3xl border-2 transition-colors ${zoneBorderBg} p-4 sm:p-6 relative overflow-hidden`}
                >
                  {/* Decorative Soft Botanical Tree & Flower Props */}
                  <div
                    className="pointer-events-none absolute right-5 bottom-4 opacity-35 hidden lg:block"
                    aria-hidden="true"
                  >
                    <svg width="74" height="74" viewBox="0 0 74 74" fill="none">
                      <rect
                        x="33"
                        y="46"
                        width="8"
                        height="20"
                        rx="3"
                        fill={isLavender ? '#6A62A8' : '#9B785D'}
                      />
                      <circle
                        cx="37"
                        cy="34"
                        r="18"
                        fill={
                          isFoggy
                            ? isLavender
                              ? '#C4C2DC'
                              : '#C4BEB4'
                            : isLavender
                              ? '#9F8EDB'
                              : '#9BCB83'
                        }
                      />
                      <circle
                        cx="24"
                        cy="40"
                        r="12"
                        fill={
                          isFoggy
                            ? isLavender
                              ? '#D1CFE6'
                              : '#D4CEC4'
                            : isLavender
                              ? '#8BC0EC'
                              : '#A8DCC8'
                        }
                      />
                      <circle
                        cx="50"
                        cy="40"
                        r="11"
                        fill={
                          isFoggy
                            ? isLavender
                              ? '#C4C2DC'
                              : '#C4BEB4'
                            : isLavender
                              ? '#B5A4E8'
                              : '#9BCB83'
                        }
                      />
                      <circle cx="14" cy="64" r="4" fill={isLavender ? '#A9DDF5' : '#FFE18A'} />
                      <circle cx="62" cy="62" r="3.5" fill={isLavender ? '#7963A8' : '#F39A83'} />
                    </svg>
                  </div>

                  {/* Zone Signpost Accordion Header + Zone Boss Challenge Trigger */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleZoneCollapse(zone.section.number)}
                      className="flex items-center gap-3 text-left cursor-pointer flex-1 min-w-[200px]"
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-mono font-extrabold text-sm shadow-xs tabular-nums shrink-0 ${
                          isMastered
                            ? isLavender
                              ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#211442]'
                              : 'bg-[#9BCB83] border-[#5D8A43] text-[#1A3110]'
                            : isLavender
                              ? 'bg-[#F5F4FF] border-[#B9BBE6] text-[#5B4A9E]'
                              : 'bg-white border-[#EAE0D0] text-[#9B785D]'
                        }`}
                      >
                        {String(zone.section.number).padStart(2, '0')}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`text-base sm:text-lg font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                            {zone.section.title}
                          </h3>
                          <span className={`text-xs font-semibold ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
                            · {zone.flavor.zoneName}
                          </span>
                          {isMastered && (
                            <span className={`text-xs font-extrabold ${isLavender ? 'text-[#4B3B94]' : 'text-[#3D6A27]'}`}>
                              · 구역 완료 ✨
                            </span>
                          )}
                          {isFoggy && (
                            <span className={`text-xs font-bold inline-flex items-center gap-1 ${isLavender ? 'text-[#6B6A8E]' : 'text-[#7D7166]'}`}>
                              · <CloudFog className="w-3.5 h-3.5" /> 앞 문제 풀면 열림
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}>
                          {zone.section.description} · {zone.section.pages}
                        </p>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onStartZoneBoss(
                            selectedIsland,
                            zone.section.number,
                            zone.flavor.zoneName,
                            zone.section.title,
                          )
                        }
                        className={`dq-btn-3d min-h-[42px] px-3.5 py-1.5 rounded-2xl border-2 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          bossCleared
                            ? isLavender
                              ? 'bg-[#A9DDF5] border-[#4A76C2] text-[#133554]'
                              : 'bg-[#FFE18A] border-[#D4A72C] text-[#2D2620]'
                            : isLavender
                              ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#211442]'
                              : 'bg-[#F39A83] border-[#D1684E] text-[#2D2620]'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>
                          {bossCleared
                            ? '미니테스트 완료 👑'
                            : `미니테스트 · ${zone.bossCount}문제 (${bossMins}분)`}
                        </span>
                      </button>

                      <div
                        className={`border-2 rounded-2xl px-3 py-2 text-xs font-extrabold tabular-nums ${
                          isLavender
                            ? 'bg-[#F8F8FF] border-[#C6C2E8] text-[#1D1B42]'
                            : 'bg-white/95 border-[#EAE0D0] text-[#2D2620]'
                        }`}
                      >
                        클리어 {completedInZone} / {zone.items.length}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleZoneCollapse(zone.section.number)}
                        aria-label={isCollapsed ? '구역 펼치기' : '구역 접기'}
                        className={`dq-btn-3d min-w-[40px] min-h-[40px] p-1.5 rounded-2xl border-2 flex items-center justify-center cursor-pointer ${
                          isLavender
                            ? 'bg-[#F8F8FF] border-[#C6C2E8] text-[#49467A]'
                            : 'bg-white/90 border-[#EAE0D0] text-[#5C4D42]'
                        }`}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Morning Mist Banner when Foggy */}
                  {isFoggy && !isCollapsed && (
                    <div className="mt-4 rounded-2xl bg-white/75 border border-[#C9BFB0] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C4D42]">
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <CloudFog className="w-4 h-4 text-[#7D7166]" />
                        {envInfo.unlockRequirementLabel}
                      </span>
                      <button
                        type="button"
                        onClick={onToggleFreeExplore}
                        className="font-extrabold text-[#1D4861] hover:underline cursor-pointer"
                      >
                        모든 문제 바로 열기
                      </button>
                    </div>
                  )}

                  {/* Clickable Interactive World Objects Shelf */}
                  {!isCollapsed && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
                      {interactiveObjects.map((obj) => {
                        const renderObjIcon = () => {
                          if (obj.kind === 'chest')
                            return <Gift className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#B47A00]'}`} />;
                          if (obj.kind === 'flower')
                            return <Flower2 className={`w-4 h-4 ${isLavender ? 'text-[#4A76C2]' : 'text-[#4C7A34]'}`} />;
                          if (obj.kind === 'compass')
                            return <Compass className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B6B00]'}`} />;
                          return <Signpost className={`w-4 h-4 ${isLavender ? 'text-[#4A76C2]' : 'text-[#9B785D]'}`} />;
                        };

                        return (
                          <button
                            key={obj.id}
                            type="button"
                            onClick={() => onCollectMapObject(obj)}
                            className={`dq-btn-3d min-h-[54px] text-left px-3.5 py-2.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              obj.collected
                                ? isLavender
                                  ? 'bg-white/85 border-[#6E92D4] text-[#1D1B42]'
                                  : 'bg-white/80 border-[#58CC02] text-[#2D2620]'
                                : obj.unlocked
                                  ? isLavender
                                    ? 'bg-[#EAE3FA]/90 border-[#6A52A3] text-[#1E1442] hover:bg-[#DFD6FA]'
                                    : 'bg-[#FFE18A]/55 border-[#D4A72C] text-[#2D2620] hover:bg-[#FFE18A]/80'
                                  : isLavender
                                    ? 'bg-[#F4F5FF]/70 border-dashed border-[#BFC4E6] text-[#5B5B85]'
                                    : 'bg-white/60 border-dashed border-[#D6C8B4] text-[#7D6E61]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl bg-white border flex items-center justify-center shrink-0 ${isLavender ? 'border-[#C9C2E8]' : 'border-[#EAE0D0]'}`}>
                                {renderObjIcon()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold truncate">
                                  {obj.title}
                                </div>
                                <div className="text-xs truncate opacity-85">
                                  {obj.collected
                                    ? '수집 완료 · 수첩에 기록됨'
                                    : obj.unlocked
                                      ? `눌러서 보상 받기 (+${obj.xpReward} XP)`
                                      : obj.unlockHint}
                                </div>
                              </div>
                            </div>

                            <span className="text-xs font-extrabold shrink-0">
                              {obj.collected ? (
                                <span className={`inline-flex items-center gap-0.5 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#4C7A34]'}`}>
                                  <Check className="w-3.5 h-3.5" /> 완료
                                </span>
                              ) : obj.unlocked ? (
                                <span className={`font-mono ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B6B00]'}`}>
                                  +{obj.xpReward} XP
                                </span>
                              ) : (
                                <Lock className={`w-3.5 h-3.5 ${isLavender ? 'text-[#7C7AA3]' : 'text-[#9D8E80]'}`} />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Winding Adventure Path of Mission Nodes */}
                  {!isCollapsed && (
                    <div className="relative flex flex-col items-center gap-6 pt-6 pb-2">
                      <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-40 h-[calc(100%-2rem)] opacity-75"
                        preserveAspectRatio="none"
                        viewBox="0 0 120 400"
                        fill="none"
                      >
                        <path
                          d="M60 0 C 20 70, 100 130, 60 200 C 20 270, 100 330, 60 400"
                          stroke={
                            isLavender
                              ? completedInZone > 0
                                ? '#5D6EC2'
                                : '#8D89C2'
                              : completedInZone > 0
                                ? '#5D8A43'
                                : '#9B785D'
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeOpacity={completedInZone > 0 ? 0.25 : 0.18}
                        />
                        <path
                          d="M60 0 C 20 70, 100 130, 60 200 C 20 270, 100 330, 60 400"
                          stroke={
                            isLavender
                              ? isMastered
                                ? '#5B52A3'
                                : completedInZone > 0
                                  ? '#5D8BC2'
                                  : '#8D89C2'
                              : isMastered
                                ? '#5D8A43'
                                : completedInZone > 0
                                  ? '#76A957'
                                  : '#9B785D'
                          }
                          strokeWidth="3.5"
                          strokeDasharray={completedInZone > 0 ? 'none' : '8 8'}
                          strokeLinecap="round"
                        />
                      </svg>

                      {zone.items.map((item, idx) => {
                        const status = nodeStatusMap[item.id] ?? 'available';
                        const prog = progressById[item.id];
                        const stars = prog?.stars ?? 0;
                        const offsetClass =
                          NODE_OFFSET_CLASS[idx % NODE_OFFSET_CLASS.length];

                        const isCompleted = status === 'completed';
                        const isActive = status === 'in_progress';
                        const isHero = currentHeroMission?.id === item.id;
                        const isCharHere = characterNodeId === item.id;
                        const isLocked = status === 'locked';

                        let nodeSurface = isLavender
                          ? 'bg-[#F2F4FF] border-[#90ADE6] text-[#1D2852]'
                          : 'bg-[#FFF9EF] border-[#A8DCC8] text-[#2D2620]';
                        if (isCompleted) {
                          nodeSurface = isLavender
                            ? 'bg-[#A9DDF5] border-[#3E76B8] text-[#122F54]'
                            : 'bg-[#9BCB83] border-[#5D8A43] text-[#1A3110]';
                        } else if (isActive || isHero) {
                          nodeSurface = isLavender
                            ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#201342] ring-4 ring-[#A9DDF5]/85'
                            : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620] ring-4 ring-[#FFE18A]/70';
                        } else if (isLocked) {
                          nodeSurface = isLavender
                            ? 'bg-[#EAE9F4] border-[#C3C0DA] text-[#6B6A88]'
                            : 'bg-[#EAE4DA] border-[#C9BFB0] text-[#7D7166]';
                        }

                        const charAnimClass =
                          motionState === 'walking'
                            ? 'rq-char-walking'
                            : motionState === 'celebrating'
                              ? 'rq-char-celebrating'
                              : motionState === 'exploring'
                                ? 'rq-char-exploring'
                                : 'rq-char-idle';

                        return (
                          <div
                            key={item.id}
                            ref={isHero ? activeNodeRef : undefined}
                            className={`relative z-10 flex items-center gap-3.5 transition-transform duration-300 ${offsetClass} w-full max-w-md justify-center ${
                              isFoggy && isLocked ? 'opacity-70' : ''
                            }`}
                          >
                            {/* Moving Fox Detective Character Token on Current Trail Node */}
                            {isCharHere && (
                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setCharBubbleOpen((v) => !v)}
                                  aria-label="학습 도우미 안내 열기"
                                  title="클릭하면 다음 문제 안내가 열려요"
                                  className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full overflow-hidden border-[3px] shadow-md flex items-center justify-center cursor-pointer ${
                                    isLavender
                                      ? 'border-[#6A52A3] bg-[#F4F1FC]'
                                      : 'border-[#F39A83] bg-[#FFF9EF]'
                                  } ${charAnimClass}`}
                                >
                                  {charImgError ? (
                                    <Sparkles className={`w-5 h-5 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`} />
                                  ) : (
                                    <img
                                      src={mascotImage}
                                      alt="지도 위 여우 도우미"
                                      onError={() => setCharImgError(true)}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </button>

                                {charBubbleOpen && (
                                  <div
                                    className={`absolute left-0 bottom-14 z-30 w-56 clay-card rounded-2xl p-3 space-y-2 shadow-lg ${
                                      isLavender
                                        ? '!bg-[#F7F5FF] !border-[#6A52A3]'
                                        : 'bg-[#FFF9EF] border-[#D4A72C]'
                                    }`}
                                  >
                                    <div className={`text-xs font-extrabold ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`}>
                                      {nickname}님의 도우미
                                    </div>
                                    <p className={`text-xs font-semibold leading-snug ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                                      {motionState === 'celebrating'
                                        ? '멋지게 해결했어! 다음 단서도 같이 찾자!'
                                        : motionState === 'exploring'
                                          ? '새 구역 안개가 걷혔어! 주변을 살펴볼까?'
                                          : `지금 ${formatItemNumber(item.originalItemNumber)} (${item.sectionTitle}) 차례야!`}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCharBubbleOpen(false);
                                        handleNodeClick(item, status);
                                      }}
                                      className={`clay-btn w-full py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                                        isLavender
                                          ? 'bg-[#A9DDF5] text-[#133554]'
                                          : 'bg-[#F39A83] text-[#2D2620]'
                                      }`}
                                    >
                                      이 문제 바로 풀기
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleNodeClick(item, status)}
                              aria-label={`${item.sourceExam} ${item.sectionTitle} 미션`}
                              className={`clay-node relative w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full border-[3px] flex flex-col items-center justify-center shrink-0 cursor-pointer ${nodeSurface}`}
                            >
                              {isCompleted && (
                                <span
                                  aria-hidden="true"
                                  className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                                    isLavender ? 'bg-[#C9B9E8]' : 'bg-[#FFE18A]'
                                  }`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      isLavender
                                        ? 'text-[#3B2378] fill-[#3B2378]'
                                        : 'text-[#9B6B00] fill-[#9B6B00]'
                                    }`}
                                  />
                                </span>
                              )}
                              {(isActive || (isHero && !isCompleted)) && (
                                <span
                                  aria-hidden="true"
                                  className={`rq-float-gentle absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                                    isLavender ? 'bg-[#4A76C2]' : 'bg-[#F39A83]'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3 text-white" />
                                </span>
                              )}

                              {isCompleted && (
                                <span
                                  aria-hidden="true"
                                  className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                                    isLavender ? 'bg-[#4A76C2]' : 'bg-[#58CC02]'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                                </span>
                              )}

                              {isLocked ? (
                                <Lock className="w-5 h-5" />
                              ) : (
                                <>
                                  <span className="font-mono font-extrabold text-sm sm:text-base tabular-nums leading-none">
                                    {formatItemNumber(item.originalItemNumber)}
                                  </span>
                                  <span className="text-[11px] font-bold mt-1 opacity-80 tabular-nums leading-none">
                                    {examPosById.get(item.id)?.index ?? item.globalIndex}/
                                    {examPosById.get(item.id)?.total ?? 28}
                                  </span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleNodeClick(item, status)}
                              className={`dq-btn-3d flex-1 text-left rounded-2xl border-2 px-4 py-3 transition-all cursor-pointer min-w-0 ${
                                isLocked
                                  ? isLavender
                                    ? 'bg-[#F2F2FA]/90 border-[#D2D0E6] text-[#6B6A88]'
                                    : 'bg-[#F4F0E8]/90 border-[#DCD3C4] text-[#7D7166]'
                                  : isActive || (isHero && !isCompleted)
                                    ? isLavender
                                      ? 'bg-[#FAF9FF] border-[#6A52A3] shadow-sm hover:bg-[#F3F1FC]'
                                      : 'bg-white border-[#D4A72C] shadow-sm hover:bg-[#FFFDF5]'
                                    : isLavender
                                      ? isCompleted
                                        ? 'bg-[#F7FAFF] border-[#6E92D4] hover:border-[#4A76C2]'
                                        : 'bg-white/95 border-[#C6C2E8] hover:border-[#6A52A3]'
                                      : isCompleted
                                        ? 'bg-[#F5FCEC] border-[#58CC02] hover:border-[#46A302]'
                                        : 'bg-white/95 border-[#DFD2BE] hover:border-[#9B785D]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                                <span className={`truncate ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                                  {item.sourceExam} ·{' '}
                                  <span className="opacity-75 font-mono">
                                    ({examPosById.get(item.id)?.index ?? item.globalIndex}/
                                    {examPosById.get(item.id)?.total ?? 28}문항)
                                  </span>
                                </span>
                                {isCompleted ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 shrink-0"
                                    aria-label={`별 ${stars}개 획득`}
                                  >
                                    {[1, 2, 3].map((s) => (
                                      <Star
                                        key={s}
                                        className={`w-3.5 h-3.5 ${
                                          s <= stars
                                            ? isLavender
                                              ? 'text-[#5B48A3] fill-[#C9B9E8]'
                                              : 'text-[#B47A00] fill-[#FFE18A]'
                                            : isLavender
                                              ? 'text-[#D3D1EC]'
                                              : 'text-[#D6C8B4]'
                                        }`}
                                      />
                                    ))}
                                  </span>
                                ) : (
                                  <span
                                    className={`shrink-0 tabular-nums ${
                                      isActive
                                        ? isLavender
                                          ? 'text-[#5A42A6]'
                                          : 'text-[#B47A00]'
                                        : isHero
                                          ? isLavender
                                            ? 'text-[#5A42A6]'
                                            : 'text-[#B47A00]'
                                          : isLocked
                                            ? isLavender
                                              ? 'text-[#787599]'
                                              : 'text-[#8B7F73]'
                                            : isLavender
                                              ? 'text-[#3B6FB6]'
                                              : 'text-[#3C8168]'
                                    }`}
                                  >
                                    {isActive
                                      ? '풀던 중'
                                      : isHero
                                        ? '추천'
                                        : isLocked
                                          ? '잠김'
                                          : '풀기'}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs sm:text-sm font-bold line-clamp-2 mt-0.5 leading-snug ${isLavender ? 'text-[#3A3768]' : 'text-[#4B3F35]'}`}>
                                {item.prompt}
                              </p>
                              <div className={`flex items-center gap-2 text-xs font-semibold mt-1 tabular-nums ${isLavender ? 'text-[#636094]' : 'text-[#7D6E61]'}`}>
                                <span>{item.pages.map((p) => `${p}p`).join('–')}</span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    item.points === 3
                                      ? isLavender
                                        ? 'font-bold text-[#5B48A3]'
                                        : 'font-bold text-[#C25D44]'
                                      : ''
                                  }
                                >
                                  {item.points}점
                                </span>
                                {prog?.discoveredClues?.length ? (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>단서 {prog.discoveredClues.length}개</span>
                                  </>
                                ) : null}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Explorer Quests + Weekly Attendance + Gear Strip (Placed below map so problems appear immediately) */}
      <section
        className={`clay-card rounded-2xl p-4 space-y-3 ${
          isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#C25D44]'}`} />
            <h2 className={`text-sm font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
              오늘의 목표 퀘스트 · 출석 · 아이템
            </h2>
          </div>
          <span className={`text-xs font-semibold tabular-nums ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
            달성 시 보너스 XP 자동 지급
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {dailyProgressList.map((dq) => (
            <div
              key={dq.id}
              className={`rounded-xl border-2 px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                dq.done
                  ? isLavender
                    ? 'bg-[#E5EEFD] border-[#4A76C2]'
                    : 'bg-[#9BCB83]/25 border-[#5D8A43]'
                  : isLavender
                    ? 'bg-[#F3F1FC] border-[#C9C2E8]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0]'
              }`}
            >
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate flex items-center gap-1.5 ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                  {dq.done && (
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#4C7A34]'}`} />
                  )}
                  <span className="truncate">{dq.title}</span>
                </div>
                <div className={`mt-1.5 h-2.5 w-36 max-w-full bg-white rounded-full overflow-hidden border ${isLavender ? 'border-[#C9C2E8]' : 'border-[#EAE0D0]'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                      dq.done
                        ? isLavender
                          ? 'bg-[#4A76C2]'
                          : 'bg-[#58CC02]'
                        : isLavender
                          ? 'bg-[#8E7AD6]'
                          : 'bg-[#FFC800]'
                    }`}
                    style={{
                      width: `${Math.round((dq.current / dq.target) * 100)}%`,
                    }}
                  >
                    {dq.done && (
                      <div className="rq-progress-glint absolute inset-y-0 w-1/2 bg-white/40 skew-x-[-18deg]" />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 font-mono text-xs tabular-nums">
                <div className={`font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                  {dq.current}/{dq.target}
                </div>
                <div className={`text-xs font-bold ${isLavender ? 'text-[#4B3B94]' : 'text-[#4C7A34]'}`}>
                  +{dq.xpReward} XP
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          <div
            className={`lg:col-span-5 rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
              isLavender
                ? 'bg-[#F5F3FC] border-[#D2CCE8]'
                : 'bg-[#FFFDF8] border-[#EAE0D0]'
            }`}
          >
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#5C4D42]">
              <CalendarDays className="w-4 h-4 text-[#FF9600]" />
              <span>이번 주 출석</span>
            </div>
            <div className="flex items-center gap-1.5">
              {weeklyAttendance.map((day) => (
                <div
                  key={day.dateKey}
                  title={`${day.label}요일`}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-extrabold tabular-nums ${
                    day.active
                      ? 'bg-[#FF9600] border-[#D97706] text-white'
                      : day.isToday
                        ? 'bg-white border-[#58CC02] text-[#285E00]'
                        : 'bg-[#EFECE5] border-[#DFD6C7] text-[#8B7F73]'
                  }`}
                >
                  {day.label}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`lg:col-span-7 rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
              isLavender
                ? 'bg-[#F5F3FC] border-[#D2CCE8]'
                : 'bg-[#FFFDF8] border-[#EAE0D0]'
            }`}
          >
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#5C4D42]">
              <Telescope className="w-4 h-4 text-[#7963A8]" />
              <span>내 학습 아이템</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {foxGearCatalog.map((gear) => {
                const isEquipped = equippedGearId === gear.id;
                return (
                  <button
                    key={gear.id}
                    type="button"
                    disabled={!gear.unlocked || !onEquipGear}
                    onClick={() => gear.unlocked && onEquipGear?.(gear.id)}
                    title={
                      gear.unlocked
                        ? `${gear.title} 장착하기`
                        : `LV.${gear.requiredLevel} 달성 시 해금`
                    }
                    className={`min-h-[32px] px-2.5 py-1 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition-colors ${
                      !gear.unlocked
                        ? 'bg-[#F0ECE4] border-[#DCD4C6] text-[#8B7F73] cursor-not-allowed'
                        : isEquipped
                          ? 'bg-[#FFE18A] border-[#C9961A] text-[#5C3D00] cursor-pointer'
                          : 'bg-white border-[#EAE0D0] text-[#4B4B4B] hover:border-[#7963A8] cursor-pointer'
                    }`}
                  >
                    {!gear.unlocked && <Lock className="w-3 h-3" />}
                    <span>{gear.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {onOpenTeacherMode && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onOpenTeacherMode}
            className="min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-bold text-[#7D6E61] hover:text-[#2D2620] hover:bg-white/70 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>교사용 관리 모드 (PIN)</span>
          </button>
        </div>
      )}
    </div>
  );
};
