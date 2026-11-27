import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Compass,
  Edit3,
  Flame,
  HelpCircle,
  Lock,
  Map as MapIcon,
  Music,
  Settings,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { EXTRACTED_QUESTIONS } from './data/questions';
import { ExamYear, ExtractedQuestion } from './types/question';
import {
  FontScaleMode,
  HistoryEvent,
  LearningStage,
  MissionProgress,
  QuestGameState,
} from './types/game';
import {
  BADGE_CATALOG,
  computeEarnedStars,
  computeLevelInfo,
  computeNodeStatusMap,
  createEmptyDailyQuest,
  createEmptyProgress,
  createInitialGameState,
  evaluateEarnedBadges,
  formatItemNumber,
  getComboBonusXp,
  getDailyQuestCatalog,
  getTodayDateKey,
  loadGameState,
  saveGameState,
} from './utils/gameStorage';
import {
  playBadgeFanfare,
  playClueChime,
  playSuccessChime,
  playTryAgainSoft,
} from './utils/soundEffects';
import { AdventureMap } from './components/AdventureMap';
import { DetectiveWorkspace } from './components/DetectiveWorkspace';
import { DirectReadingView } from './components/DirectReadingView';
import { CollectiblesView } from './components/CollectiblesView';
import { LearningHistoryView } from './components/LearningHistoryView';
import { ReviewMissionsView } from './components/ReviewMissionsView';
import { TeacherAdminView } from './components/TeacherAdminView';
import { ZoneBossModal } from './components/ZoneBossModal';
import { WelcomeOnboardingModal } from './components/WelcomeOnboardingModal';
import { FloatingToolkit } from './components/FloatingToolkit';
import {
  AudioManager,
  AudioSettings,
  loadAudioSettings,
} from './controllers/AudioManager';
import { computeZoneEnvironmentMap } from './controllers/EnvironmentStateController';
import {
  loadCollectedObjects,
  MapInteractiveObject,
  saveCollectedObjects,
} from './controllers/InteractiveObjectController';
import {
  RewardAnimationController,
  RewardCelebrationEvent,
} from './controllers/RewardAnimationController';
import { SENTENCE_LAB_STORAGE_KEY } from './controllers/SentenceLabStorage';
import mascotImage from './assets/images/mascot_fox_detective_1795522642644.jpg';

type ActiveView =
  | 'map'
  | 'workspace'
  | 'directReading'
  | 'collectibles'
  | 'reviewHistory'
  | 'teacher';

const TRANSCRIPTS_STORAGE_KEY = 'reading_workbook_transcripts_v1';
const PRE_RESET_BACKUP_KEY = 'reading_quest_pre_reset_backup_v1';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('map');
  const [collectiblesTab, setCollectiblesTab] = useState<'badges' | 'vocab' | 'quiz'>('badges');
  const [reviewHistoryTab, setReviewHistoryTab] = useState<'review' | 'history'>('review');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    EXTRACTED_QUESTIONS[0].id,
  );
  const [gameState, setGameState] = useState<QuestGameState>(() =>
    loadGameState(),
  );
  const [activeMapIsland, setActiveMapIsland] = useState<ExamYear>(() => {
    const lastId = loadGameState().profile.lastActiveQuestionId;
    const found = lastId
      ? EXTRACTED_QUESTIONS.find((q) => q.id === lastId)
      : null;
    return found?.examYear ?? '2025';
  });
  const [transcripts, setTranscripts] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(TRANSCRIPTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(
    () => loadGameState().profile.nickname,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);

  const [bossSession, setBossSession] = useState<{
    zoneKey: string;
    zoneName: string;
    sectionTitle: string;
    items: ExtractedQuestion[];
  } | null>(null);

  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
  const [lastDailyBonusXp, setLastDailyBonusXp] = useState(0);
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const [avatarImgErr, setAvatarImgErr] = useState(false);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    loadAudioSettings(loadGameState().profile.soundEnabled),
  );
  const [collectedMapObjects, setCollectedMapObjects] = useState<
    Record<string, string>
  >(() => loadCollectedObjects());
  const [justCompletedQuestionId, setJustCompletedQuestionId] = useState<
    string | null
  >(null);
  const [justUnlockedZone, setJustUnlockedZone] = useState(false);
  const [rewardCelebration, setRewardCelebration] =
    useState<RewardCelebrationEvent | null>(null);
  const [hasPreResetSnapshot, setHasPreResetSnapshot] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(PRE_RESET_BACKUP_KEY));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    saveGameState(gameState);
  }, [gameState]);

  useEffect(() => {
    document.documentElement.dataset.fontScale =
      gameState.profile.fontScale ?? 'md';
  }, [gameState.profile.fontScale]);

  useEffect(() => {
    saveCollectedObjects(collectedMapObjects);
  }, [collectedMapObjects]);

  useEffect(() => {
    AudioManager.updateSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    if (activeView === 'map') {
      AudioManager.setScene('map');
    } else if (activeView === 'workspace' || activeView === 'directReading') {
      AudioManager.setScene('workspace');
    } else if (activeView === 'teacher') {
      AudioManager.setScene('none');
    } else {
      AudioManager.setScene('map');
    }
  }, [activeView]);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSCRIPTS_STORAGE_KEY, JSON.stringify(transcripts));
    } catch {
      // Ignore storage quota errors
    }
  }, [transcripts]);

  useEffect(() => {
    if (!toastNotification) return;
    const t = window.setTimeout(() => setToastNotification(null), 4200);
    return () => window.clearTimeout(t);
  }, [toastNotification]);

  useEffect(() => {
    if (!rewardCelebration) return;
    const t = window.setTimeout(() => setRewardCelebration(null), 5000);
    return () => window.clearTimeout(t);
  }, [rewardCelebration]);

  const nodeStatusMap = useMemo(
    () =>
      computeNodeStatusMap(
        EXTRACTED_QUESTIONS,
        gameState.progressById,
        gameState.profile.freeExploreMode,
      ),
    [gameState.progressById, gameState.profile.freeExploreMode],
  );

  const earnedBadgeIds = useMemo(
    () => evaluateEarnedBadges(gameState, EXTRACTED_QUESTIONS),
    [gameState],
  );

  const levelInfo = useMemo(
    () => computeLevelInfo(gameState.profile.xp),
    [gameState.profile.xp],
  );

  const clearedZoneKeysSnapshot = useMemo(() => {
    const keys: string[] = [];
    (['2025', '2026'] as const).forEach((yr) => {
      const env = computeZoneEnvironmentMap(
        EXTRACTED_QUESTIONS,
        gameState.progressById,
        yr,
        false,
      );
      Object.values(env).forEach((info) => {
        if (info.isFogCleared) keys.push(info.zoneKey);
      });
    });
    return keys;
  }, [gameState.progressById]);

  const prevLevelRef = useRef<number>(levelInfo.level);
  const prevClearedZonesRef = useRef<Set<string>>(
    new Set(clearedZoneKeysSnapshot),
  );

  useEffect(() => {
    if (levelInfo.level > prevLevelRef.current) {
      AudioManager.playLevelUp();
      setRewardCelebration({
        id: `lvl-${levelInfo.level}-${Date.now()}`,
        kind: 'level_up',
        title: `레벨 업! LV.${levelInfo.level} ${levelInfo.title}`,
        subtitle: `새 학습 아이템 "${levelInfo.gearName}"을(를) 얻었어요!`,
      });
    }
    prevLevelRef.current = levelInfo.level;
  }, [levelInfo.level, levelInfo.title, levelInfo.gearName]);

  useEffect(() => {
    const newlyOpened = clearedZoneKeysSnapshot.filter(
      (k) => !prevClearedZonesRef.current.has(k),
    );
    if (newlyOpened.length > 0) {
      AudioManager.playZoneUnlock();
      setJustUnlockedZone(true);
      setRewardCelebration({
        id: `zone-${newlyOpened[0]}-${Date.now()}`,
        kind: 'zone_unlock',
        title: '새로운 탐험 구역 개방!',
        subtitle: '지도 위 안개가 걷히고 새 탐험 경로와 보물 상자가 열렸어요!',
      });
      const t = window.setTimeout(() => setJustUnlockedZone(false), 3000);
      prevClearedZonesRef.current = new Set(clearedZoneKeysSnapshot);
      return () => window.clearTimeout(t);
    }
    prevClearedZonesRef.current = new Set(clearedZoneKeysSnapshot);
  }, [clearedZoneKeysSnapshot]);

  const currentQuestion = useMemo(
    () =>
      EXTRACTED_QUESTIONS.find((q) => q.id === selectedQuestionId) ??
      EXTRACTED_QUESTIONS[0],
    [selectedQuestionId],
  );

  const currentProgress: MissionProgress = useMemo(
    () =>
      gameState.progressById[currentQuestion.id] ??
      createEmptyProgress(currentQuestion.id),
    [gameState.progressById, currentQuestion.id],
  );

  const nextMissionOnSameIsland = useMemo(() => {
    const islandItems = EXTRACTED_QUESTIONS.filter(
      (q) => q.examYear === currentQuestion.examYear,
    );
    const idx = islandItems.findIndex((q) => q.id === currentQuestion.id);
    if (idx >= 0 && idx < islandItems.length - 1) {
      return islandItems[idx + 1];
    }
    const globalIdx = EXTRACTED_QUESTIONS.findIndex(
      (q) => q.id === currentQuestion.id,
    );
    if (globalIdx >= 0 && globalIdx < EXTRACTED_QUESTIONS.length - 1) {
      return EXTRACTED_QUESTIONS[globalIdx + 1];
    }
    return null;
  }, [currentQuestion]);

  const nextMissionLabel = useMemo(() => {
    if (!nextMissionOnSameIsland) return undefined;
    return `${nextMissionOnSameIsland.examYear}년 ${formatItemNumber(nextMissionOnSameIsland.originalItemNumber)}`;
  }, [nextMissionOnSameIsland]);

  const applyStateUpdate = (
    updater: (prev: QuestGameState) => QuestGameState,
  ) => {
    setGameState((prev) => {
      const beforeBadges = new Set(
        evaluateEarnedBadges(prev, EXTRACTED_QUESTIONS),
      );
      let next = updater(prev);

      const today = getTodayDateKey();
      let dq =
        next.dailyQuest.dateKey === today
          ? { ...next.dailyQuest }
          : createEmptyDailyQuest(today);

      const questCatalog = getDailyQuestCatalog(next.profile.dailyGoalTarget ?? 3);
      let dailyBonusXp = 0;
      const claimed = new Set(dq.claimedRewardIds);

      if (
        dq.solvedTodayIds.length >= questCatalog[0].target &&
        !claimed.has(questCatalog[0].id)
      ) {
        claimed.add(questCatalog[0].id);
        dailyBonusXp += questCatalog[0].xpReward;
      }
      if (
        dq.cluesTodayCount >= questCatalog[1].target &&
        !claimed.has(questCatalog[1].id)
      ) {
        claimed.add(questCatalog[1].id);
        dailyBonusXp += questCatalog[1].xpReward;
      }
      if (
        dq.threePtSolvedTodayIds.length >= questCatalog[2].target &&
        !claimed.has(questCatalog[2].id)
      ) {
        claimed.add(questCatalog[2].id);
        dailyBonusXp += questCatalog[2].xpReward;
      }

      const prevAttendance = next.profile.attendanceDates ?? [];
      const madeLearningActivity =
        dq.cluesTodayCount > prev.dailyQuest.cluesTodayCount ||
        dq.solvedTodayIds.length > prev.dailyQuest.solvedTodayIds.length ||
        next.profile.xp > prev.profile.xp;
      const nextAttendance =
        madeLearningActivity && !prevAttendance.includes(today)
          ? [...prevAttendance, today]
          : prevAttendance;

      if (dailyBonusXp > 0) {
        dq = { ...dq, claimedRewardIds: Array.from(claimed) };
        next = {
          ...next,
          profile: {
            ...next.profile,
            xp: next.profile.xp + dailyBonusXp,
            attendanceDates: nextAttendance,
          },
          dailyQuest: dq,
        };
        setLastDailyBonusXp((prevBonus) => prevBonus + dailyBonusXp);
        if (activeView !== 'workspace') {
          setToastNotification({
            title: '오늘의 탐험 퀘스트 달성!',
            subtitle: `보너스 +${dailyBonusXp} XP를 획득했어요!`,
          });
        }
      } else {
        next = {
          ...next,
          profile: {
            ...next.profile,
            attendanceDates: nextAttendance,
          },
          dailyQuest: dq,
        };
      }

      const afterBadges = evaluateEarnedBadges(next, EXTRACTED_QUESTIONS);
      const unlocked = afterBadges.filter((id) => !beforeBadges.has(id));
      if (unlocked.length > 0) {
        const titles = unlocked
          .map((id) => BADGE_CATALOG.find((b) => b.id === id)?.title)
          .filter((t): t is string => Boolean(t));
        setNewlyUnlockedBadges(titles);
        if (activeView !== 'workspace') {
          setToastNotification({
            title: `새 배지 획득: ${titles[0]}`,
            subtitle: '수집품 박물관에 멋지게 진열되었어요!',
          });
        }
        playBadgeFanfare(next.profile.soundEnabled);
      }

      return next;
    });
  };

  const navigateToStudentView = (view: Exclude<ActiveView, 'teacher'>) => {
    setTeacherUnlocked(false);
    setSettingsOpen(false);
    setActiveView(view);
  };

  const handleStartMission = (questionId: string) => {
    setTeacherUnlocked(false);
    setSettingsOpen(false);
    setSelectedQuestionId(questionId);
    const missionQuestion = EXTRACTED_QUESTIONS.find((q) => q.id === questionId);
    if (missionQuestion) {
      setActiveMapIsland(missionQuestion.examYear);
    }
    setNewlyUnlockedBadges([]);
    setLastDailyBonusXp(0);
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[questionId] ?? createEmptyProgress(questionId);
      return {
        ...prev,
        profile: {
          ...prev.profile,
          lastActiveQuestionId: questionId,
        },
        progressById: {
          ...prev.progressById,
          [questionId]: {
            ...existing,
            started: true,
          },
        },
      };
    });
    setActiveView('workspace');
  };

  const handleStageChange = (stage: LearningStage) => {
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      return {
        ...prev,
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            currentStage: stage,
          },
        },
      };
    });
  };

  const handleRecordGuess = (guessIdx: number, isReal?: boolean) => {
    if (isReal === true) {
      playSuccessChime(gameState.profile.soundEnabled);
    } else if (isReal === false) {
      playTryAgainSoft(gameState.profile.soundEnabled);
    } else {
      playClueChime(gameState.profile.soundEnabled);
    }
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      const firstTime = existing.guessChoiceIndex === null;
      const xpGain = firstTime ? 10 : 0;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpGain,
        },
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            guessChoiceIndex: guessIdx,
            earnedXp: existing.earnedXp + xpGain,
          },
        },
      };
    });
  };

  const handleCollectClue = (clueKey: string) => {
    const existingProg = gameState.progressById[currentQuestion.id];
    if (existingProg?.discoveredClues.includes(clueKey)) return;
    playClueChime(gameState.profile.soundEnabled);

    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      if (existing.discoveredClues.includes(clueKey)) return prev;
      const xpGain = 5;
      const updatedClues = [...existing.discoveredClues, clueKey];
      const upgradedStars = existing.completed
        ? computeEarnedStars(
            currentQuestion,
            updatedClues.length,
            existing.attempts <= 1,
            existing.stars,
          )
        : existing.stars;

      const today = getTodayDateKey();
      const dq =
        prev.dailyQuest.dateKey === today
          ? prev.dailyQuest
          : createEmptyDailyQuest(today);

      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpGain,
        },
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            stars: upgradedStars,
            discoveredClues: updatedClues,
            earnedXp: existing.earnedXp + xpGain,
          },
        },
        dailyQuest: {
          ...dq,
          cluesTodayCount: dq.cluesTodayCount + 1,
        },
      };
    });
  };

  const handleCompleteStoryBuild = () => {
    playSuccessChime(gameState.profile.soundEnabled);
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      if (existing.storyChecked) return prev;
      const xpGain = 15;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpGain,
        },
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            storyChecked: true,
            earnedXp: existing.earnedXp + xpGain,
          },
        },
      };
    });
  };

  const handleCompleteSentenceLab = (meta?: {
    durationSec?: number;
    chunkCount?: number;
  }) => {
    playSuccessChime(gameState.profile.soundEnabled);
    const xpGain = 20;
    const durationSec = meta?.durationSec;
    const chunkCount = meta?.chunkCount;
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      const event: HistoryEvent = {
        id: `lab-${currentQuestion.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        questionId: currentQuestion.id,
        sourceExam: currentQuestion.sourceExam,
        sectionTitle: currentQuestion.sectionTitle,
        examYear: currentQuestion.examYear,
        isCorrect: true,
        xpDelta: xpGain,
        note:
          durationSec !== undefined
            ? `문장 해석 워크숍 완료 (${durationSec}초)`
            : '문장 해석 워크숍 완료',
        durationSec,
        activityType: 'sentence_lab',
        chunkCount,
      };
      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpGain,
        },
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            earnedXp: existing.earnedXp + xpGain,
          },
        },
        history: [event, ...prev.history].slice(0, 120),
      };
    });
    setToastNotification({
      title: '의미 단위 문장 해석 완료!',
      subtitle: `+${xpGain} XP를 획득했어요!`,
    });
  };

  const handleRecordDirectReadingAttempt = (entry: {
    question: ExtractedQuestion;
    isCorrect: boolean;
    durationSec: number;
    chunkCount: number;
    xpDelta: number;
  }) => {
    applyStateUpdate((prev) => {
      const event: HistoryEvent = {
        id: `dr-${entry.question.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        questionId: entry.question.id,
        sourceExam: entry.question.sourceExam,
        sectionTitle: entry.question.sectionTitle,
        examYear: entry.question.examYear,
        isCorrect: entry.isCorrect,
        xpDelta: entry.xpDelta,
        note: entry.isCorrect
          ? `직독직해 성공 (${entry.chunkCount}조각 · ${entry.durationSec}초)`
          : `직독직해 재도전 (${entry.chunkCount}조각 · ${entry.durationSec}초)`,
        durationSec: entry.durationSec,
        activityType: 'direct_reading',
        chunkCount: entry.chunkCount,
      };
      return {
        ...prev,
        history: [event, ...prev.history].slice(0, 120),
      };
    });
  };

  const handleSubmitBossAnswer = (
    choiceIdx: number,
    cleanSolveThisSession: boolean,
    durationSec?: number,
  ): {
    isCorrect: boolean;
    xpDelta: number;
    perfectBonus: boolean;
    comboBonus: number;
    earnedStars: 0 | 1 | 2 | 3;
  } => {
    const isCorrect = choiceIdx === currentQuestion.answerIndex;
    const prevProg =
      gameState.progressById[currentQuestion.id] ??
      createEmptyProgress(currentQuestion.id);
    const firstClear = isCorrect && !prevProg.completed;
    const perfectBonus = firstClear && prevProg.attempts === 0;

    const nextLiveStreak = isCorrect
      ? firstClear
        ? gameState.profile.currentStreak + 1
        : Math.max(1, gameState.profile.currentStreak)
      : 0;
    const comboBonus = firstClear ? getComboBonusXp(nextLiveStreak) : 0;
    const baseXp = currentQuestion.points === 3 ? 45 : 30;
    const xpDelta = firstClear ? baseXp + (perfectBonus ? 15 : 0) + comboBonus : 0;

    const earnedStars = isCorrect
      ? computeEarnedStars(
          currentQuestion,
          prevProg.discoveredClues.length,
          cleanSolveThisSession && (prevProg.attempts === 0 || prevProg.completed),
          prevProg.stars,
        )
      : prevProg.stars;

    if (isCorrect) {
      playSuccessChime(gameState.profile.soundEnabled);
      setJustCompletedQuestionId(currentQuestion.id);
    } else {
      playTryAgainSoft(gameState.profile.soundEnabled);
    }

    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
      const today = getTodayDateKey();
      const dq =
        prev.dailyQuest.dateKey === today
          ? prev.dailyQuest
          : createEmptyDailyQuest(today);

      const nextSolvedIds =
        isCorrect && !dq.solvedTodayIds.includes(currentQuestion.id)
          ? [...dq.solvedTodayIds, currentQuestion.id]
          : dq.solvedTodayIds;

      const nextThreePtIds =
        isCorrect &&
        currentQuestion.points === 3 &&
        !dq.threePtSolvedTodayIds.includes(currentQuestion.id)
          ? [...dq.threePtSolvedTodayIds, currentQuestion.id]
          : dq.threePtSolvedTodayIds;

      const event: HistoryEvent = {
        id: `${currentQuestion.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        questionId: currentQuestion.id,
        sourceExam: currentQuestion.sourceExam,
        sectionTitle: currentQuestion.sectionTitle,
        examYear: currentQuestion.examYear,
        isCorrect,
        xpDelta,
        note: isCorrect
          ? `${choiceIdx}번 정답 확인 (★${earnedStars}${perfectBonus ? ' · 원샷 퍼펙트' : ''})`
          : `${choiceIdx}번 선택 후 재도전`,
        durationSec,
        activityType: 'reading_quiz',
      };

      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpDelta,
          currentStreak: nextLiveStreak,
          streakCount: Math.max(prev.profile.streakCount, nextLiveStreak),
        },
        progressById: {
          ...prev.progressById,
          [currentQuestion.id]: {
            ...existing,
            started: true,
            completed: existing.completed || isCorrect,
            stars: earnedStars,
            bossChoiceIndex: choiceIdx,
            isCorrect,
            attempts: existing.attempts + 1,
            earnedXp: existing.earnedXp + xpDelta,
            completedAt:
              existing.completedAt ??
              (isCorrect ? new Date().toISOString() : null),
          },
        },
        history: [event, ...prev.history].slice(0, 120),
        dailyQuest: {
          ...dq,
          solvedTodayIds: nextSolvedIds,
          threePtSolvedTodayIds: nextThreePtIds,
        },
      };
    });

    return { isCorrect, xpDelta, perfectBonus, comboBonus, earnedStars };
  };

  // Start a Zone Boss Time-Attack Challenge (picks 2~3 questions for the section)
  const handleStartZoneBoss = (
    examYear: ExamYear,
    sectionNumber: number,
    zoneName: string,
    sectionTitle: string,
  ) => {
    const primary = EXTRACTED_QUESTIONS.filter(
      (q) => q.examYear === examYear && q.sectionNumber === sectionNumber,
    );
    const secondary = EXTRACTED_QUESTIONS.filter(
      (q) => q.examYear !== examYear && q.sectionNumber === sectionNumber,
    );
    const combined = [...primary, ...secondary].slice(0, 3);
    if (combined.length === 0) return;

    setBossSession({
      zoneKey: `${examYear}-${sectionNumber}`,
      zoneName,
      sectionTitle,
      items: combined,
    });
  };

  const handleRecordBossQuestionResult = (
    question: ExtractedQuestion,
    isCorrect: boolean,
    choiceIdx: number,
  ) => {
    if (isCorrect) {
      playSuccessChime(gameState.profile.soundEnabled);
    } else {
      playTryAgainSoft(gameState.profile.soundEnabled);
    }

    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[question.id] ?? createEmptyProgress(question.id);
      const nextStreak = isCorrect ? prev.profile.currentStreak + 1 : 0;
      const firstClear = isCorrect && !existing.completed;
      const xpGain = firstClear ? 25 : 0;
      const stars = isCorrect
        ? Math.max(existing.stars, 1) as 0 | 1 | 2 | 3
        : existing.stars;

      const event: HistoryEvent = {
        id: `boss-${question.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        questionId: question.id,
        sourceExam: question.sourceExam,
        sectionTitle: question.sectionTitle,
        examYear: question.examYear,
        isCorrect,
        xpDelta: xpGain,
        note: isCorrect
          ? `실전 미니테스트 정답 (${choiceIdx}번)`
          : `실전 미니테스트 오답 (${choiceIdx}번)`,
      };

      return {
        ...prev,
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + xpGain,
          currentStreak: nextStreak,
          streakCount: Math.max(prev.profile.streakCount, nextStreak),
        },
        progressById: {
          ...prev.progressById,
          [question.id]: {
            ...existing,
            started: true,
            completed: existing.completed || isCorrect,
            stars,
            attempts: existing.attempts + 1,
            earnedXp: existing.earnedXp + xpGain,
            completedAt:
              existing.completedAt ??
              (isCorrect ? new Date().toISOString() : null),
          },
        },
        history: [event, ...prev.history].slice(0, 120),
      };
    });
  };

  const handleBossZoneCleared = (zoneKey: string, bonusXp: number) => {
    playBadgeFanfare(gameState.profile.soundEnabled);
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        xp: prev.profile.xp + bonusXp,
      },
      clearedBossZones: {
        ...prev.clearedBossZones,
        [zoneKey]: new Date().toISOString(),
      },
    }));
    setToastNotification({
      title: '실전 미니테스트 통과!',
      subtitle: `왕관 깃발과 보너스 +${bonusXp} XP를 획득했어요!`,
    });
  };

  const handleUpdateTranscript = (id: string, value: string) => {
    setTranscripts((prev) => {
      const next = { ...prev };
      if (!value.trim()) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  };

  const handleAwardQuizXp = (xpDelta: number) => {
    if (xpDelta <= 0) return;
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        xp: prev.profile.xp + xpDelta,
      },
    }));
  };

  const handleCollectMapObject = (obj: MapInteractiveObject) => {
    if (!obj.unlocked) {
      AudioManager.playTryAgain(gameState.profile.soundEnabled);
      setToastNotification({
        title: `${obj.title} 잠김`,
        subtitle: obj.unlockHint,
      });
      return;
    }
    if (collectedMapObjects[obj.id]) {
      setToastNotification({
        title: `${obj.title}`,
        subtitle: '이미 발견해서 탐험 수첩에 기록된 보물이에요!',
      });
      return;
    }

    AudioManager.playObjectDiscover();
    setCollectedMapObjects((prev) => ({
      ...prev,
      [obj.id]: new Date().toISOString(),
    }));
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        xp: prev.profile.xp + obj.xpReward,
      },
    }));
    setRewardCelebration({
      id: `obj-${obj.id}-${Date.now()}`,
      kind: 'object_reward',
      title: `${obj.title} 발견!`,
      subtitle: obj.description,
      xpBonus: obj.xpReward,
    });
  };

  const handleSaveNickname = () => {
    const clean = nicknameDraft.trim() || '영어 탐험가';
    setNicknameDraft(clean);
    setEditingNickname(false);
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        nickname: clean,
      },
    }));
  };

  const handleChangeFontScale = (nextScale: FontScaleMode) => {
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        fontScale: nextScale,
      },
    }));
  };

  const handleContinueLearning = () => {
    const targetId =
      gameState.profile.lastActiveQuestionId ??
      EXTRACTED_QUESTIONS.find((q) => nodeStatusMap[q.id] === 'in_progress')
        ?.id ??
      EXTRACTED_QUESTIONS.find((q) => !gameState.progressById[q.id]?.completed)
        ?.id ??
      EXTRACTED_QUESTIONS[0].id;
    handleStartMission(targetId);
  };

  const handleCompleteOnboarding = (
    nickname: string,
    startImmediately: boolean,
    preferredYear?: ExamYear,
    dailyGoal?: number,
  ) => {
    setNicknameDraft(nickname);
    if (preferredYear) {
      setActiveMapIsland(preferredYear);
    }
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        nickname,
        onboarded: true,
        dailyGoalTarget: dailyGoal ?? prev.profile.dailyGoalTarget ?? 3,
      },
    }));
    if (startImmediately) {
      if (preferredYear) {
        const islandFirst =
          EXTRACTED_QUESTIONS.find(
            (q) =>
              q.examYear === preferredYear &&
              !gameState.progressById[q.id]?.completed,
          ) ??
          EXTRACTED_QUESTIONS.find((q) => q.examYear === preferredYear) ??
          EXTRACTED_QUESTIONS[0];
        handleStartMission(islandFirst.id);
      } else {
        handleContinueLearning();
      }
    }
  };

  const handleToggleBookmark = (questionId: string) => {
    applyStateUpdate((prev) => {
      const existing = prev.profile.bookmarkedIds ?? [];
      const has = existing.includes(questionId);
      return {
        ...prev,
        profile: {
          ...prev.profile,
          bookmarkedIds: has
            ? existing.filter((id) => id !== questionId)
            : [...existing, questionId],
        },
      };
    });
  };

  const handleEquipGear = (gearId: string) => {
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        equippedGearId: gearId,
      },
    }));
  };

  const completedTotal = useMemo(
    () =>
      Object.values(gameState.progressById).filter((p) => p.completed).length,
    [gameState.progressById],
  );

  const isLavenderTheme =
    (activeView === 'workspace' && currentQuestion.examYear === '2026') ||
    ((activeView === 'map' || activeView === 'directReading') &&
      activeMapIsland === '2026');

  return (
    <div
      className={`relative min-h-screen flex flex-col overflow-x-clip transition-colors duration-500 ${
        isLavenderTheme
          ? 'bg-[#F2F4FD] text-[#1F2142]'
          : 'bg-[#FFF9EF] text-[#2D2620]'
      } ${gameState.profile.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* Subtle Ambient Atmospheric Background Layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div
          className={`rq-ambient-orb absolute -top-28 -left-24 w-80 h-80 sm:w-[440px] sm:h-[440px] rounded-full blur-3xl transition-colors duration-700 ${
            isLavenderTheme ? 'bg-[#C9B9E8]/32' : 'bg-[#FFE18A]/32'
          }`}
        />
        <div
          className={`rq-ambient-orb absolute top-1/3 -right-28 w-72 h-72 sm:w-[420px] sm:h-[420px] rounded-full blur-3xl transition-colors duration-700 ${
            isLavenderTheme ? 'bg-[#A9DDF5]/28' : 'bg-[#9BCB83]/22'
          }`}
          style={{ animationDelay: '-6s' }}
        />
        <div
          className={`rq-ambient-orb absolute -bottom-24 left-1/3 w-72 h-72 sm:w-[360px] sm:h-[360px] rounded-full blur-3xl transition-colors duration-700 ${
            isLavenderTheme ? 'bg-[#DED6FA]/30' : 'bg-[#A9DDF5]/24'
          }`}
          style={{ animationDelay: '-11s' }}
        />
      </div>

      {/* Top Cozy Adventure HUD (Hidden during Focus Lesson Mode in Workspace & Direct Reading) */}
      {activeView !== 'workspace' && activeView !== 'directReading' && (
        <header
          className={`sticky top-0 z-30 backdrop-blur-md border-b-2 px-4 lg:px-8 py-2.5 transition-colors duration-300 shadow-[0_3px_12px_rgba(45,38,32,0.04)] ${
            isLavenderTheme
              ? 'bg-[#F9F9FF]/92 border-[#C9C2E8]'
              : 'bg-[#FFFDF8]/92 border-[#EAE0D0]'
          }`}
        >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigateToStudentView('map')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
          >
            <div
              className={`w-9 h-9 rounded-2xl border-2 flex items-center justify-center shadow-xs ${
                isLavenderTheme
                  ? 'bg-[#DED6FA] border-[#7E67BF]'
                  : 'bg-[#FFE18A] border-[#D4A72C]'
              }`}
            >
              <Compass
                className={`w-5 h-5 ${
                  isLavenderTheme ? 'text-[#2C2457]' : 'text-[#2D2620]'
                }`}
              />
            </div>
            <div>
              <div
                className={`text-base sm:text-lg font-extrabold tracking-tight leading-none ${
                  isLavenderTheme ? 'text-[#1F2142]' : 'text-[#2D2620]'
                }`}
              >
                READING QUEST
              </div>
              <div
                className={`text-xs font-semibold mt-0.5 ${
                  isLavenderTheme ? 'text-[#5A598A]' : 'text-[#7D6E61]'
                }`}
              >
                {levelInfo.gearName} · 중학 영어 독해
              </div>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 relative">
            <div
              className={`clay-card-soft flex items-center gap-2 bg-white border-2 rounded-2xl px-3 min-h-[42px] ${
                isLavenderTheme ? '!border-[#C9C2E8]' : '!border-[#EAE0D0]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl overflow-hidden bg-[#FFF9EF] border shrink-0 flex items-center justify-center ${
                  isLavenderTheme ? 'border-[#C9C2E8]' : 'border-[#EAE0D0]'
                }`}
              >
                {avatarImgErr ? (
                  <Sparkles className="w-4 h-4 text-[#9B785D]" />
                ) : (
                  <img
                    src={mascotImage}
                    alt="학습자 프로필"
                    onError={() => setAvatarImgErr(true)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {editingNickname ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveNickname();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    maxLength={14}
                    aria-label="학생 닉네임"
                    className="w-24 px-2 py-1 text-xs font-bold bg-[#FFF9EF] border border-[#9B785D] rounded-lg text-[#2D2620] focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    aria-label="닉네임 저장"
                    className="p-1.5 rounded-lg bg-[#58CC02] text-white cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNicknameDraft(gameState.profile.nickname);
                    setEditingNickname(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[#2D2620] hover:text-[#1CB0F6] cursor-pointer whitespace-nowrap"
                  title="닉네임 수정하기"
                >
                  <span>{gameState.profile.nickname}</span>
                  <Edit3 className="w-3.5 h-3.5 text-[#777777]" />
                </button>
              )}
            </div>

            {/* Live Streak Indicator */}
            {gameState.profile.currentStreak >= 1 && (
              <div className="clay-card-soft inline-flex items-center gap-1 !bg-[#FFF2DF] !border-[#FF9600] rounded-2xl px-3 min-h-[42px] text-xs sm:text-sm font-extrabold text-[#B25E00] tabular-nums whitespace-nowrap">
                <Flame className="w-4 h-4 text-[#FF9600] fill-[#FF9600] rq-float-gentle" />
                <span>{gameState.profile.currentStreak}연속</span>
              </div>
            )}

            <div
              className={`clay-card-soft hidden sm:flex items-center gap-2.5 bg-white border-2 rounded-2xl px-3.5 min-h-[42px] ${
                isLavenderTheme ? '!border-[#C9C2E8]' : '!border-[#EAE0D0]'
              }`}
            >
              <span
                className={`text-xs font-extrabold font-mono tabular-nums ${
                  isLavenderTheme ? 'text-[#5E48A3]' : 'text-[#58A700]'
                }`}
              >
                LV.{levelInfo.level}
              </span>
              <div
                className={`w-20 h-2.5 rounded-full overflow-hidden relative ${
                  isLavenderTheme ? 'bg-[#E5E2F4]' : 'bg-[#E5E5E5]'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all relative overflow-hidden ${
                    isLavenderTheme ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
                  }`}
                  style={{ width: `${levelInfo.progressPct}%` }}
                >
                  {!gameState.profile.reducedMotion && (
                    <div
                      aria-hidden="true"
                      className="rq-progress-glint absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                    />
                  )}
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#2D2620] font-mono tabular-nums">
                {gameState.profile.xp} XP
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setCollectiblesTab('badges');
                navigateToStudentView('collectibles');
              }}
              className="dq-btn-3d inline-flex items-center gap-1.5 bg-[#FFF6DA] border-2 border-[#FFC800] rounded-2xl px-3.5 min-h-[42px] text-xs font-extrabold text-[#6B4A00] cursor-pointer tabular-nums whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-[#C68900]" />
              <span>
                배지 {earnedBadgeIds.length} · {completedTotal}/56
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setTutorialOpen(true);
              }}
              aria-label="문제 푸는 법 튜토리얼 보기"
              title="문제 푸는 법 튜토리얼"
              className="dq-btn-3d inline-flex items-center gap-1.5 bg-[#EEFFD9] border-2 border-[#58CC02] rounded-2xl px-3.5 min-h-[42px] text-xs font-extrabold text-[#285E00] hover:bg-[#D7FFB8] cursor-pointer whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4 text-[#46A302]" />
              <span>튜토리얼</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setAudioSettings((s) => ({
                  ...s,
                  masterMuted: !s.masterMuted,
                }))
              }
              aria-label={audioSettings.masterMuted ? '전체 소리 켜기' : '전체 음소거'}
              title={audioSettings.masterMuted ? '소리 켜기' : '전체 음소거'}
              className={`dq-btn-3d min-w-[42px] min-h-[42px] px-2.5 rounded-2xl border-2 flex items-center justify-center cursor-pointer ${
                audioSettings.masterMuted
                  ? 'border-[#FF4B4B] bg-[#FFDFE0] text-[#9A1B1B]'
                  : isLavenderTheme
                    ? 'border-[#C9C2E8] bg-white text-[#49467A] hover:border-[#6A52A3]'
                    : 'border-[#EAE0D0] bg-white text-[#5C4D42] hover:border-[#1CB0F6]'
              }`}
            >
              {audioSettings.masterMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="설정 열기"
              className={`dq-btn-3d min-w-[42px] min-h-[42px] px-2.5 rounded-2xl border-2 bg-white flex items-center justify-center cursor-pointer ${
                isLavenderTheme
                  ? 'border-[#C9C2E8] text-[#49467A] hover:border-[#6A52A3]'
                  : 'border-[#EAE0D0] text-[#5C4D42] hover:border-[#1CB0F6]'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-12 w-72 clay-card rounded-2xl p-4 space-y-3 z-40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2D2620]">
                    사운드 · 화면 설정
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="p-1 text-[#6E5E52] hover:text-[#2D2620] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Master Mute */}
                <button
                  type="button"
                  onClick={() =>
                    setAudioSettings((s) => ({
                      ...s,
                      masterMuted: !s.masterMuted,
                    }))
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    audioSettings.masterMuted
                      ? 'bg-[#F39A83]/20 border-[#D1684E] text-[#7A2D1C]'
                      : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {audioSettings.masterMuted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#4C7A34]" />
                    )}
                    전체 소리
                  </span>
                  <span>{audioSettings.masterMuted ? '음소거됨' : '켜짐'}</span>
                </button>

                {/* BGM ON/OFF + Volume */}
                <div className="rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setAudioSettings((s) => ({
                          ...s,
                          bgmEnabled: !s.bgmEnabled,
                        }))
                      }
                      className="flex items-center gap-1.5 text-xs font-bold text-[#2D2620] cursor-pointer"
                    >
                      <Music className="w-3.5 h-3.5 text-[#9B785D]" />
                      <span>배경음악 (BGM)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAudioSettings((s) => ({
                          ...s,
                          bgmEnabled: !s.bgmEnabled,
                        }))
                      }
                      className="text-xs font-extrabold text-[#9B785D] cursor-pointer"
                    >
                      {audioSettings.bgmEnabled ? '켜짐' : '꺼짐'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="bgm-vol-slider"
                      className="text-xs font-semibold text-[#6E5E52] shrink-0"
                    >
                      음량
                    </label>
                    <input
                      id="bgm-vol-slider"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(audioSettings.bgmVolume * 100)}
                      onChange={(e) =>
                        setAudioSettings((s) => ({
                          ...s,
                          bgmVolume: Number(e.target.value) / 100,
                        }))
                      }
                      className="w-full accent-[#9BCB83] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-[#5C4D42] w-10 text-right tabular-nums">
                      {Math.round(audioSettings.bgmVolume * 100)}%
                    </span>
                  </div>
                </div>

                {/* SFX ON/OFF + Volume */}
                <div className="rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        const nextSfx = !audioSettings.sfxEnabled;
                        setAudioSettings((s) => ({
                          ...s,
                          sfxEnabled: nextSfx,
                        }));
                        applyStateUpdate((prev) => ({
                          ...prev,
                          profile: {
                            ...prev.profile,
                            soundEnabled: nextSfx,
                          },
                        }));
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#2D2620] cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#9B785D]" />
                      <span>효과음 (SFX)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSfx = !audioSettings.sfxEnabled;
                        setAudioSettings((s) => ({
                          ...s,
                          sfxEnabled: nextSfx,
                        }));
                        applyStateUpdate((prev) => ({
                          ...prev,
                          profile: {
                            ...prev.profile,
                            soundEnabled: nextSfx,
                          },
                        }));
                      }}
                      className="text-xs font-extrabold text-[#9B785D] cursor-pointer"
                    >
                      {audioSettings.sfxEnabled ? '켜짐' : '꺼짐'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="sfx-vol-slider"
                      className="text-xs font-semibold text-[#6E5E52] shrink-0"
                    >
                      음량
                    </label>
                    <input
                      id="sfx-vol-slider"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(audioSettings.sfxVolume * 100)}
                      onChange={(e) =>
                        setAudioSettings((s) => ({
                          ...s,
                          sfxVolume: Number(e.target.value) / 100,
                        }))
                      }
                      className="w-full accent-[#F39A83] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-[#5C4D42] w-10 text-right tabular-nums">
                      {Math.round(audioSettings.sfxVolume * 100)}%
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    applyStateUpdate((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        reducedMotion: !prev.profile.reducedMotion,
                      },
                    }))
                  }
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-xs font-bold text-[#2D2620] cursor-pointer"
                >
                  <span>부드러운 화면 효과</span>
                  <span className="text-[#9B785D]">
                    {gameState.profile.reducedMotion ? '줄이기' : '켜짐'}
                  </span>
                </button>

                <div className="pt-1 border-t border-[#EAE0D0] space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setSetupModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-xs font-bold text-[#2D2620] hover:border-[#1CB0F6] cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-[#1CB0F6]" />
                      <span>닉네임 · 시험지 설정</span>
                    </span>
                    <span className="text-xs text-[#6E5E52]">열기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setActiveView('teacher');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#DFD2BE] text-xs font-bold text-[#5C4D42] hover:text-[#2D2620] cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>교사용 관리 모드</span>
                    </span>
                    <span className="text-xs text-[#8B7F73]">PIN 필요</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Instant Floating Toast Notification */}
      {toastNotification && (
        <div className="rq-feedback-rise fixed top-20 right-4 z-50 clay-card rounded-2xl bg-[#FFE18A] border-[#C9961A] px-4 py-3 flex items-center gap-3 max-w-xs">
          <div className="w-9 h-9 rounded-xl bg-white border-2 border-[#D4A72C] flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-[#9B6B00] fill-[#FFE18A] animate-star-pop" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-extrabold text-[#2D2620] truncate">
              {toastNotification.title}
            </div>
            <div className="text-xs font-semibold text-[#5C4D42]">
              {toastNotification.subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            aria-label="알림 닫기"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5C4D42] hover:text-[#2D2620] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main
        className={`relative z-10 flex-1 w-full min-w-0 mx-auto px-3 sm:px-5 lg:px-8 py-5 ${
          activeView === 'workspace'
            ? 'max-w-[1640px] pb-24'
            : 'max-w-[1440px] pb-28'
        }`}
      >
        <div
          key={activeView}
          className={!gameState.profile.reducedMotion ? 'rq-view-enter' : ''}
        >
        {activeView === 'map' && (
          <AdventureMap
            questions={EXTRACTED_QUESTIONS}
            progressById={gameState.progressById}
            nodeStatusMap={nodeStatusMap}
            dailyQuest={gameState.dailyQuest}
            dailyGoalTarget={gameState.profile.dailyGoalTarget ?? 3}
            attendanceDates={gameState.profile.attendanceDates ?? []}
            level={levelInfo.level}
            equippedGearId={gameState.profile.equippedGearId ?? 'gear_1'}
            onEquipGear={handleEquipGear}
            onOpenTeacherMode={() => {
              setSettingsOpen(false);
              setActiveView('teacher');
            }}
            clearedBossZones={gameState.clearedBossZones}
            collectedMapObjects={collectedMapObjects}
            justCompletedQuestionId={justCompletedQuestionId}
            justUnlockedZone={justUnlockedZone}
            currentStreak={gameState.profile.currentStreak}
            nickname={gameState.profile.nickname}
            freeExploreMode={gameState.profile.freeExploreMode}
            onToggleFreeExplore={() =>
              applyStateUpdate((prev) => ({
                ...prev,
                profile: {
                  ...prev.profile,
                  freeExploreMode: !prev.profile.freeExploreMode,
                },
              }))
            }
            onStartMission={handleStartMission}
            onStartZoneBoss={handleStartZoneBoss}
            onCollectMapObject={handleCollectMapObject}
            lastActiveQuestionId={gameState.profile.lastActiveQuestionId}
            activeIsland={activeMapIsland}
            onIslandChange={setActiveMapIsland}
            onOpenVocabQuiz={() => {
              setCollectiblesTab('quiz');
              navigateToStudentView('collectibles');
            }}
            onOpenDirectReading={() => navigateToStudentView('directReading')}
          />
        )}

        {activeView === 'directReading' && (
          <DirectReadingView
            questions={EXTRACTED_QUESTIONS}
            initialExamYear={activeMapIsland}
            nickname={gameState.profile.nickname}
            totalXp={gameState.profile.xp}
            currentStreak={gameState.profile.currentStreak}
            soundEnabled={gameState.profile.soundEnabled}
            reducedMotion={gameState.profile.reducedMotion}
            onAwardXp={handleAwardQuizXp}
            onRecordSentenceAttempt={handleRecordDirectReadingAttempt}
            onBackToMap={() => navigateToStudentView('map')}
          />
        )}

        {activeView === 'workspace' && (
          <DetectiveWorkspace
            question={currentQuestion}
            allQuestions={EXTRACTED_QUESTIONS}
            progress={currentProgress}
            progressById={gameState.progressById}
            totalXp={gameState.profile.xp}
            level={levelInfo.level}
            equippedGearId={gameState.profile.equippedGearId ?? 'gear_1'}
            currentStreak={gameState.profile.currentStreak}
            reducedMotion={gameState.profile.reducedMotion}
            nickname={gameState.profile.nickname}
            customTranscript={transcripts[currentQuestion.id] ?? ''}
            onUpdateTranscript={handleUpdateTranscript}
            onBackToMap={() => navigateToStudentView('map')}
            onStageChange={handleStageChange}
            onRecordGuess={handleRecordGuess}
            onCollectClue={handleCollectClue}
            onCompleteStoryBuild={handleCompleteStoryBuild}
            onCompleteSentenceLab={handleCompleteSentenceLab}
            onSubmitBossAnswer={handleSubmitBossAnswer}
            onGoNextMission={() => {
              if (nextMissionOnSameIsland) {
                handleStartMission(nextMissionOnSameIsland.id);
              }
            }}
            hasNextMission={Boolean(nextMissionOnSameIsland)}
            nextMissionLabel={nextMissionLabel}
            onSelectQuestion={handleStartMission}
            isBookmarked={(gameState.profile.bookmarkedIds ?? []).includes(
              currentQuestion.id,
            )}
            onToggleBookmark={() => handleToggleBookmark(currentQuestion.id)}
            masterMuted={audioSettings.masterMuted}
            onToggleMute={() =>
              setAudioSettings((s) => ({
                ...s,
                masterMuted: !s.masterMuted,
              }))
            }
            dailyQuestBonusXp={lastDailyBonusXp}
            onClearCelebrationMeta={() => {
              setNewlyUnlockedBadges([]);
              setLastDailyBonusXp(0);
            }}
            onOpenReview={() => {
              setReviewHistoryTab('review');
              navigateToStudentView('reviewHistory');
            }}
            onOpenTutorial={() => setTutorialOpen(true)}
            newlyUnlockedBadgeTitles={newlyUnlockedBadges}
          />
        )}

        {activeView === 'collectibles' && (
          <CollectiblesView
            questions={EXTRACTED_QUESTIONS}
            progressById={gameState.progressById}
            earnedBadgeIds={earnedBadgeIds}
            initialTab={collectiblesTab}
            onStartMission={handleStartMission}
            onAwardQuizXp={handleAwardQuizXp}
          />
        )}

        {activeView === 'reviewHistory' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReviewHistoryTab('review')}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer ${
                  reviewHistoryTab === 'review'
                    ? 'bg-[#FFE18A] border-[#D4A72C] text-[#2D2620]'
                    : 'bg-white border-[#EAE0D0] text-[#5C4D42]'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>복습 미션</span>
              </button>
              <button
                type="button"
                onClick={() => setReviewHistoryTab('history')}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer ${
                  reviewHistoryTab === 'history'
                    ? 'bg-[#A9DDF5]/60 border-[#5D9EC0] text-[#1D4861]'
                    : 'bg-white border-[#EAE0D0] text-[#5C4D42]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>학습 기록</span>
              </button>
            </div>

            {reviewHistoryTab === 'review' ? (
              <ReviewMissionsView
                questions={EXTRACTED_QUESTIONS}
                progressById={gameState.progressById}
                bookmarkedIds={gameState.profile.bookmarkedIds ?? []}
                onStartMission={handleStartMission}
              />
            ) : (
              <LearningHistoryView
                questions={EXTRACTED_QUESTIONS}
                progressById={gameState.progressById}
                history={gameState.history}
                xp={gameState.profile.xp}
                streakCount={gameState.profile.streakCount}
                gameState={gameState}
                transcripts={transcripts}
                onRestoreBackup={(restoredState, restoredTranscripts) => {
                  setGameState(restoredState);
                  setTranscripts(restoredTranscripts);
                  setNicknameDraft(restoredState.profile.nickname);
                }}
                onStartMission={handleStartMission}
              />
            )}
          </div>
        )}

        {activeView === 'teacher' && (
          <TeacherAdminView
            allQuestions={EXTRACTED_QUESTIONS}
            selectedId={selectedQuestionId}
            transcripts={transcripts}
            gameState={gameState}
            isUnlocked={teacherUnlocked}
            onUnlockSuccess={() => setTeacherUnlocked(true)}
            onLockAndExit={() => navigateToStudentView('map')}
            onSelectQuestionForPlay={handleStartMission}
            onToggleFreeExplore={() =>
              applyStateUpdate((prev) => ({
                ...prev,
                profile: {
                  ...prev.profile,
                  freeExploreMode: !prev.profile.freeExploreMode,
                },
              }))
            }
            onRestoreBackup={(restoredState, restoredTranscripts) => {
              setGameState(restoredState);
              setTranscripts(restoredTranscripts);
              setNicknameDraft(restoredState.profile.nickname);
            }}
            onRestartKeepData={() => {
              applyStateUpdate((prev) => {
                const nextProgress: Record<string, MissionProgress> = {};
                for (const [id, prog] of Object.entries(prev.progressById)) {
                  nextProgress[id] = {
                    ...prog,
                    currentStage: 0,
                  };
                }
                return {
                  ...prev,
                  profile: {
                    ...prev.profile,
                    lastActiveQuestionId: EXTRACTED_QUESTIONS[0].id,
                  },
                  progressById: nextProgress,
                };
              });
              setSelectedQuestionId(EXTRACTED_QUESTIONS[0].id);
              setToastNotification({
                title: '기존 기록 유지 · 새 회차 준비 완료',
                subtitle: 'XP·별·배지·노트는 그대로 유지하고 1번 문제부터 다시 풀 수 있어요!',
              });
            }}
            hasPreResetSnapshot={hasPreResetSnapshot}
            onRestorePreResetSnapshot={() => {
              try {
                const raw = localStorage.getItem(PRE_RESET_BACKUP_KEY);
                if (!raw) return;
                const snap = JSON.parse(raw) as {
                  gameState?: QuestGameState;
                  transcripts?: Record<string, string>;
                  collectedMapObjects?: Record<string, string>;
                  sentenceLabRaw?: string | null;
                };
                if (snap.gameState) {
                  setGameState(snap.gameState);
                  setNicknameDraft(snap.gameState.profile.nickname);
                }
                if (snap.transcripts) {
                  setTranscripts(snap.transcripts);
                }
                if (snap.collectedMapObjects) {
                  setCollectedMapObjects(snap.collectedMapObjects);
                }
                if (snap.sentenceLabRaw) {
                  localStorage.setItem(
                    SENTENCE_LAB_STORAGE_KEY,
                    snap.sentenceLabRaw,
                  );
                }
                setToastNotification({
                  title: '기존 데이터 복구 완료!',
                  subtitle: '초기화 전 학습 진도와 단서·노트를 모두 되돌렸어요.',
                });
              } catch {
                // Ignore storage errors
              }
            }}
            onResetProgress={() => {
              try {
                const snapshot = {
                  savedAt: new Date().toISOString(),
                  gameState,
                  transcripts,
                  collectedMapObjects,
                  sentenceLabRaw: localStorage.getItem(SENTENCE_LAB_STORAGE_KEY),
                };
                localStorage.setItem(
                  PRE_RESET_BACKUP_KEY,
                  JSON.stringify(snapshot),
                );
                setHasPreResetSnapshot(true);
              } catch {
                // Ignore storage errors
              }
              const fresh = createInitialGameState();
              setGameState(fresh);
              setNicknameDraft(fresh.profile.nickname);
              setCollectedMapObjects({});
              try {
                localStorage.removeItem(SENTENCE_LAB_STORAGE_KEY);
              } catch {
                // Ignore storage errors
              }
            }}
          />
        )}
        </div>
      </main>

      {/* Zone Boss Time-Attack Modal */}
      {bossSession && (
        <ZoneBossModal
          zoneKey={bossSession.zoneKey}
          zoneName={bossSession.zoneName}
          sectionTitle={bossSession.sectionTitle}
          items={bossSession.items}
          alreadyCleared={Boolean(gameState.clearedBossZones[bossSession.zoneKey])}
          onClose={() => setBossSession(null)}
          onRecordBossQuestionResult={handleRecordBossQuestionResult}
          onBossZoneCleared={handleBossZoneCleared}
          onJumpToQuestion={handleStartMission}
        />
      )}

      {/* Level-Up / Zone-Unlock / Interactive Object Reward Celebration */}
      <RewardAnimationController
        event={rewardCelebration}
        reducedMotion={gameState.profile.reducedMotion}
        onDismiss={() => setRewardCelebration(null)}
      />

      {/* First-visit quick nickname & instant tutorial modal */}
      {!gameState.profile.onboarded && activeView !== 'teacher' && (
        <WelcomeOnboardingModal
          initialNickname={gameState.profile.nickname}
          mode="onboarding"
          initialStep={1}
          onComplete={handleCompleteOnboarding}
        />
      )}

      {/* Re-openable Nickname & Exam Sheet Setup Modal */}
      {setupModalOpen && gameState.profile.onboarded && (
        <WelcomeOnboardingModal
          initialNickname={gameState.profile.nickname}
          initialPreferredYear={activeMapIsland}
          mode="setup"
          initialStep={1}
          onClose={() => setSetupModalOpen(false)}
          onComplete={(nickname, startImmediately, preferredYear, dailyGoal) => {
            setSetupModalOpen(false);
            handleCompleteOnboarding(
              nickname,
              startImmediately,
              preferredYear,
              dailyGoal,
            );
          }}
        />
      )}

      {/* Re-openable Problem-Solving Tutorial Modal */}
      {tutorialOpen && gameState.profile.onboarded && (
        <WelcomeOnboardingModal
          initialNickname={gameState.profile.nickname}
          mode="tutorial"
          initialStep={2}
          onClose={() => setTutorialOpen(false)}
          onComplete={(nickname, startImmediately, preferredYear, dailyGoal) => {
            setTutorialOpen(false);
            handleCompleteOnboarding(
              nickname,
              startImmediately,
              preferredYear,
              dailyGoal,
            );
          }}
        />
      )}

      {/* Bottom-Right Floating Toolkit (Font Expander 13pt~17pt + Quick Problem Search) */}
      {activeView !== 'teacher' && activeView !== 'directReading' && (
        <FloatingToolkit
          questions={EXTRACTED_QUESTIONS}
          progressById={gameState.progressById}
          bookmarkedIds={gameState.profile.bookmarkedIds ?? []}
          currentQuestionId={
            activeView === 'workspace' ? currentQuestion.id : undefined
          }
          isInWorkspace={activeView === 'workspace'}
          isLavenderTheme={isLavenderTheme}
          fontScale={gameState.profile.fontScale ?? 'md'}
          onChangeFontScale={handleChangeFontScale}
          onSelectQuestion={handleStartMission}
          onOpenHintSheet={
            activeView === 'workspace'
              ? () => window.dispatchEvent(new CustomEvent('rq-open-beginner-hint'))
              : undefined
          }
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenDirectReading={() => navigateToStudentView('directReading')}
        />
      )}

      {/* Clean 4-Item Student Bottom Dock (Hidden during Focus Lesson Mode in Workspace & Direct Reading) */}
      {activeView !== 'workspace' && activeView !== 'directReading' && (
        <nav
          aria-label="학습 메뉴"
          className={`fixed bottom-0 inset-x-0 z-30 backdrop-blur-xs border-t-2 px-2.5 sm:px-3 py-2 transition-colors duration-300 ${
            isLavenderTheme
              ? 'bg-[#F9F9FF]/95 border-[#C9C2E8]'
              : 'bg-[#FFFDF8]/95 border-[#EAE0D0]'
          }`}
        >
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => navigateToStudentView('map')}
            className={`dq-btn-3d min-h-[48px] px-1.5 sm:px-3 py-2 rounded-2xl text-xs font-extrabold inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 border-2 whitespace-nowrap cursor-pointer ${
              activeView === 'map'
                ? isLavenderTheme
                  ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#211442]'
                  : 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                : isLavenderTheme
                  ? 'bg-white border-[#D4D1EC] text-[#49467A] hover:border-[#6A52A3]'
                  : 'bg-white border-[#E5E5E5] text-[#5C4D42] hover:border-[#1CB0F6]'
            }`}
          >
            <MapIcon className="w-4 h-4 shrink-0" />
            <span>전체 문제</span>
          </button>

          <button
            type="button"
            onClick={handleContinueLearning}
            className="dq-btn-3d min-h-[48px] px-1.5 sm:px-3 py-2 rounded-2xl text-xs font-extrabold inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 border-2 whitespace-nowrap cursor-pointer bg-[#1CB0F6] border-[#1899D6] text-white"
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>
              {!gameState.profile.lastActiveQuestionId && completedTotal === 0
                ? '첫 문제 풀기'
                : '이어서 풀기'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCollectiblesTab('badges');
              navigateToStudentView('collectibles');
            }}
            className={`dq-btn-3d min-h-[48px] px-1.5 sm:px-3 py-2 rounded-2xl text-xs font-extrabold inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 border-2 whitespace-nowrap cursor-pointer ${
              activeView === 'collectibles'
                ? 'bg-[#EAE3FA] border-[#7963A8] text-[#2E204D]'
                : isLavenderTheme
                  ? 'bg-white border-[#D4D1EC] text-[#49467A] hover:border-[#7963A8]'
                  : 'bg-white border-[#E5E5E5] text-[#5C4D42] hover:border-[#7963A8]'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>단어 · 배지</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToStudentView('reviewHistory')}
            className={`dq-btn-3d min-h-[48px] px-1.5 sm:px-3 py-2 rounded-2xl text-xs font-extrabold inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 border-2 whitespace-nowrap cursor-pointer ${
              activeView === 'reviewHistory'
                ? 'bg-[#FFF6DA] border-[#FFC800] text-[#6B4A00]'
                : isLavenderTheme
                  ? 'bg-white border-[#D4D1EC] text-[#49467A] hover:border-[#FFC800]'
                  : 'bg-white border-[#E5E5E5] text-[#5C4D42] hover:border-[#FFC800]'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>오답 · 복습</span>
          </button>
        </div>
      </nav>
      )}
    </div>
  );
}
