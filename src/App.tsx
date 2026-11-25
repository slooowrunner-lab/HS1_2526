import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Compass,
  Edit3,
  Flame,
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
  HistoryEvent,
  LearningStage,
  MissionProgress,
  QuestGameState,
} from './types/game';
import {
  BADGE_CATALOG,
  DAILY_QUEST_CATALOG,
  computeEarnedStars,
  computeLevelInfo,
  computeNodeStatusMap,
  createEmptyDailyQuest,
  createEmptyProgress,
  createInitialGameState,
  evaluateEarnedBadges,
  getComboBonusXp,
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
import { CollectiblesView } from './components/CollectiblesView';
import { LearningHistoryView } from './components/LearningHistoryView';
import { ReviewMissionsView } from './components/ReviewMissionsView';
import { TeacherAdminView } from './components/TeacherAdminView';
import { ZoneBossModal } from './components/ZoneBossModal';
import { WelcomeOnboardingModal } from './components/WelcomeOnboardingModal';
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
  | 'collectibles'
  | 'reviewHistory'
  | 'teacher';

const TRANSCRIPTS_STORAGE_KEY = 'reading_workbook_transcripts_v1';
const PRE_RESET_BACKUP_KEY = 'reading_quest_pre_reset_backup_v1';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('map');
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
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);

  const [bossSession, setBossSession] = useState<{
    zoneKey: string;
    zoneName: string;
    sectionTitle: string;
    items: ExtractedQuestion[];
  } | null>(null);

  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
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
    saveCollectedObjects(collectedMapObjects);
  }, [collectedMapObjects]);

  useEffect(() => {
    AudioManager.updateSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    if (activeView === 'map') {
      AudioManager.setScene('map');
    } else if (activeView === 'workspace') {
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
        subtitle: `새 탐정 장비 "${levelInfo.gearName}"을(를) 얻었어요!`,
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

      let dailyBonusXp = 0;
      const claimed = new Set(dq.claimedRewardIds);

      if (
        dq.solvedTodayIds.length >= DAILY_QUEST_CATALOG[0].target &&
        !claimed.has(DAILY_QUEST_CATALOG[0].id)
      ) {
        claimed.add(DAILY_QUEST_CATALOG[0].id);
        dailyBonusXp += DAILY_QUEST_CATALOG[0].xpReward;
      }
      if (
        dq.cluesTodayCount >= DAILY_QUEST_CATALOG[1].target &&
        !claimed.has(DAILY_QUEST_CATALOG[1].id)
      ) {
        claimed.add(DAILY_QUEST_CATALOG[1].id);
        dailyBonusXp += DAILY_QUEST_CATALOG[1].xpReward;
      }
      if (
        dq.threePtSolvedTodayIds.length >= DAILY_QUEST_CATALOG[2].target &&
        !claimed.has(DAILY_QUEST_CATALOG[2].id)
      ) {
        claimed.add(DAILY_QUEST_CATALOG[2].id);
        dailyBonusXp += DAILY_QUEST_CATALOG[2].xpReward;
      }

      if (dailyBonusXp > 0) {
        dq = { ...dq, claimedRewardIds: Array.from(claimed) };
        next = {
          ...next,
          profile: {
            ...next.profile,
            xp: next.profile.xp + dailyBonusXp,
          },
          dailyQuest: dq,
        };
        setToastNotification({
          title: '오늘의 탐험 퀘스트 달성!',
          subtitle: `보너스 +${dailyBonusXp} XP를 획득했어요!`,
        });
      } else {
        next = { ...next, dailyQuest: dq };
      }

      const afterBadges = evaluateEarnedBadges(next, EXTRACTED_QUESTIONS);
      const unlocked = afterBadges.filter((id) => !beforeBadges.has(id));
      if (unlocked.length > 0) {
        const titles = unlocked
          .map((id) => BADGE_CATALOG.find((b) => b.id === id)?.title)
          .filter((t): t is string => Boolean(t));
        setNewlyUnlockedBadges(titles);
        setToastNotification({
          title: `새 배지 획득: ${titles[0]}`,
          subtitle: '수집품 박물관에 멋지게 진열되었어요!',
        });
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

  const handleCompleteSentenceLab = () => {
    playSuccessChime(gameState.profile.soundEnabled);
    const xpGain = 20;
    applyStateUpdate((prev) => {
      const existing =
        prev.progressById[currentQuestion.id] ??
        createEmptyProgress(currentQuestion.id);
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
      };
    });
    setToastNotification({
      title: '의미 단위 문장 해석 완료!',
      subtitle: `+${xpGain} XP를 획득했어요!`,
    });
  };

  const handleSubmitBossAnswer = (
    choiceIdx: number,
    cleanSolveThisSession: boolean,
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
          ? `보스 타임어택 정답 (${choiceIdx}번)`
          : `보스 타임어택 오답 (${choiceIdx}번)`,
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
      title: '구역 보스 정복 완료!',
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
    const clean = nicknameDraft.trim() || '꼬마 탐정';
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
  ) => {
    setNicknameDraft(nickname);
    applyStateUpdate((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        nickname,
        onboarded: true,
      },
    }));
    if (startImmediately) {
      handleContinueLearning();
    }
  };

  const completedTotal = useMemo(
    () =>
      Object.values(gameState.progressById).filter((p) => p.completed).length,
    [gameState.progressById],
  );

  const isLavenderTheme =
    (activeView === 'workspace' && currentQuestion.examYear === '2026') ||
    (activeView === 'map' && activeMapIsland === '2026');

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isLavenderTheme
          ? 'bg-[#F2F4FD] text-[#1F2142]'
          : 'bg-[#FFF9EF] text-[#2D2620]'
      } ${gameState.profile.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* Top Cozy Adventure HUD */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-xs border-b-2 px-4 lg:px-8 py-2.5 transition-colors duration-300 ${
          isLavenderTheme
            ? 'bg-[#F9F9FF]/95 border-[#C9C2E8]'
            : 'bg-[#FFFDF8]/95 border-[#EAE0D0]'
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
                className={`text-[11px] font-semibold mt-0.5 ${
                  isLavenderTheme ? 'text-[#5A598A]' : 'text-[#7D6E61]'
                }`}
              >
                {levelInfo.gearName} · 중학 영어 독해
              </div>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 relative">
            <div className="flex items-center gap-2 bg-white border-2 border-[#EAE0D0] rounded-2xl px-2.5 py-1.5">
              <div className="w-7 h-7 rounded-xl overflow-hidden bg-[#FFF9EF] border border-[#EAE0D0] shrink-0 flex items-center justify-center">
                {avatarImgErr ? (
                  <Sparkles className="w-4 h-4 text-[#9B785D]" />
                ) : (
                  <img
                    src={mascotImage}
                    alt="탐정 프로필"
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
                    className="w-24 px-1.5 py-0.5 text-xs font-bold bg-[#FFF9EF] border border-[#9B785D] rounded-md text-[#2D2620] focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    aria-label="닉네임 저장"
                    className="p-1 rounded-md bg-[#9BCB83] text-[#1A3110] cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNicknameDraft(gameState.profile.nickname);
                    setEditingNickname(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#2D2620] hover:text-[#9B785D] cursor-pointer"
                  title="닉네임 수정하기"
                >
                  <span>{gameState.profile.nickname}</span>
                  <Edit3 className="w-3 h-3 text-[#9B785D]" />
                </button>
              )}
            </div>

            {/* Live Streak Indicator */}
            {gameState.profile.currentStreak >= 1 && (
              <div className="inline-flex items-center gap-1 bg-[#F39A83]/25 border-2 border-[#D1684E] rounded-2xl px-2.5 py-1.5 text-xs font-extrabold text-[#7A2D1C] tabular-nums">
                <Flame className="w-3.5 h-3.5 text-[#C25D44]" />
                <span>{gameState.profile.currentStreak}연속</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2.5 bg-white border-2 border-[#EAE0D0] rounded-2xl px-3 py-1.5">
              <span className="text-xs font-extrabold text-[#9B785D] font-mono tabular-nums">
                LV.{levelInfo.level}
              </span>
              <div className="w-20 h-2 bg-[#F2ECE1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#9BCB83] rounded-full transition-all"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-[#2D2620] font-mono tabular-nums">
                {gameState.profile.xp} XP
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigateToStudentView('collectibles')}
              className="inline-flex items-center gap-1.5 bg-[#FFE18A]/50 border-2 border-[#E0B94B] rounded-2xl px-3 py-1.5 text-xs font-extrabold text-[#2D2620] cursor-pointer tabular-nums"
            >
              <Award className="w-3.5 h-3.5 text-[#9B6B00]" />
              <span>
                배지 {earnedBadgeIds.length} · {completedTotal}/56
              </span>
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
              className={`p-2 rounded-xl border-2 cursor-pointer ${
                audioSettings.masterMuted
                  ? 'border-[#F39A83] bg-[#F39A83]/20 text-[#7A2D1C]'
                  : 'border-[#EAE0D0] bg-white text-[#5C4D42] hover:text-[#2D2620] hover:border-[#9B785D]'
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
              className="p-2 rounded-xl border-2 border-[#EAE0D0] bg-white text-[#5C4D42] hover:text-[#2D2620] hover:border-[#9B785D] cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setActiveView('teacher');
              }}
              aria-label="교사용 관리 모드 (비밀번호 필요)"
              className={`px-2.5 py-2 rounded-xl border-2 text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeView === 'teacher'
                  ? 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                  : 'bg-white border-[#EAE0D0] text-[#6E5E52] hover:text-[#2D2620]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">교사용</span>
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
                      className="text-[11px] font-semibold text-[#6E5E52] shrink-0"
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
                    <span className="text-[11px] font-mono text-[#5C4D42] w-8 text-right tabular-nums">
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
                      className="text-[11px] font-semibold text-[#6E5E52] shrink-0"
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
                    <span className="text-[11px] font-mono text-[#5C4D42] w-8 text-right tabular-nums">
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
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Instant Floating Toast Notification */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 clay-card rounded-2xl bg-[#FFE18A] border-[#C9961A] px-4 py-3 flex items-center gap-3 max-w-xs">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#D4A72C] flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-[#9B6B00] fill-[#FFE18A] animate-star-pop" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-[#2D2620] truncate">
              {toastNotification.title}
            </div>
            <div className="text-[11px] font-semibold text-[#5C4D42]">
              {toastNotification.subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            aria-label="알림 닫기"
            className="text-[#5C4D42] hover:text-[#2D2620] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 pb-28">
        {activeView === 'map' && (
          <AdventureMap
            questions={EXTRACTED_QUESTIONS}
            progressById={gameState.progressById}
            nodeStatusMap={nodeStatusMap}
            dailyQuest={gameState.dailyQuest}
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
            onIslandChange={setActiveMapIsland}
          />
        )}

        {activeView === 'workspace' && (
          <DetectiveWorkspace
            question={currentQuestion}
            allQuestions={EXTRACTED_QUESTIONS}
            progress={currentProgress}
            totalXp={gameState.profile.xp}
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
            onOpenReview={() => {
              setReviewHistoryTab('review');
              navigateToStudentView('reviewHistory');
            }}
            newlyUnlockedBadgeTitles={newlyUnlockedBadges}
          />
        )}

        {activeView === 'collectibles' && (
          <CollectiblesView
            questions={EXTRACTED_QUESTIONS}
            progressById={gameState.progressById}
            earnedBadgeIds={earnedBadgeIds}
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
                onStartMission={handleStartMission}
              />
            ) : (
              <LearningHistoryView
                questions={EXTRACTED_QUESTIONS}
                progressById={gameState.progressById}
                history={gameState.history}
                xp={gameState.profile.xp}
                streakCount={gameState.profile.streakCount}
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
        />
      )}

      {/* Level-Up / Zone-Unlock / Interactive Object Reward Celebration */}
      <RewardAnimationController
        event={rewardCelebration}
        reducedMotion={gameState.profile.reducedMotion}
        onDismiss={() => setRewardCelebration(null)}
      />

      {/* First-visit quick nickname & instant start modal */}
      {!gameState.profile.onboarded && activeView !== 'teacher' && (
        <WelcomeOnboardingModal
          initialNickname={gameState.profile.nickname}
          onComplete={handleCompleteOnboarding}
        />
      )}

      {/* Clean 4-Item Student Bottom Dock */}
      <nav
        aria-label="탐험 메뉴"
        className="fixed bottom-0 inset-x-0 z-30 bg-[#FFFDF8]/95 backdrop-blur-xs border-t-2 border-[#EAE0D0] px-3 py-2"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigateToStudentView('map')}
            className={`px-2 sm:px-4 py-2 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 border-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'map'
                ? 'bg-[#9BCB83]/35 border-[#5D8A43] text-[#1A3110]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
            }`}
          >
            <MapIcon className="w-4 h-4 shrink-0" />
            <span>탐험 지도</span>
          </button>

          <button
            type="button"
            onClick={handleContinueLearning}
            className={`clay-btn px-2 sm:px-4 py-2 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeView === 'workspace'
                ? 'bg-[#FFE18A] text-[#2D2620]'
                : 'bg-[#F39A83] text-[#2D2620]'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>
              {!gameState.profile.lastActiveQuestionId && completedTotal === 0
                ? '첫 문제 풀기'
                : activeView === 'workspace'
                  ? '문제 풀이 중'
                  : '이어 풀기'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateToStudentView('collectibles')}
            className={`px-2 sm:px-4 py-2 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 border-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'collectibles'
                ? 'bg-[#C9B9E8]/40 border-[#7963A8] text-[#2E204D]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>배지 · 단어장</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToStudentView('reviewHistory')}
            className={`px-2 sm:px-4 py-2 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 border-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'reviewHistory'
                ? 'bg-[#FFE18A]/50 border-[#D4A72C] text-[#2D2620]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>오답 · 기록</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
