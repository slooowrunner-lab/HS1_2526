import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns2,
  FileImage,
  Flame,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ScanSearch,
  Search,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { LearningStage, MascotMood, MissionProgress } from '../types/game';
import { formatItemNumber, STAGE_META } from '../utils/gameStorage';
import { isTtsSupported, speakEnglish } from '../utils/tts';
import {
  BboxDebugScope,
  BboxDebugTarget,
  BboxOffset,
  BboxPxDelta,
  DEFAULT_IMAGE_DIMS,
  getCoordForPage,
  hasNonZeroDelta,
  ImagePixelDimensions,
  makeOffsetStorageKey,
  ZERO_OFFSET_DELTA,
} from '../utils/bboxDebug';
import { MascotWidget } from './MascotWidget';
import { PngViewer } from './PngViewer';
import { BboxDebugPanel } from './BboxDebugPanel';
import { FlowBuilderPanel } from './FlowBuilderPanel';
import { SentenceChunkWorkshop } from './SentenceChunkWorkshop';
import { KeyFocusWordCards } from './KeyFocusWordCards';
import { FoxFireworksCelebration } from './FoxFireworksCelebration';
import { BeginnerHintModal } from './BeginnerHintModal';
import { SENTENCE_ANALYSIS_BY_ID } from '../data/sentenceAnalyses';
import {
  getQuestionLabDraft,
  loadSentenceLabStore,
  QuestionLabDraft,
  saveSentenceLabStore,
  SentenceLabStore,
} from '../controllers/SentenceLabStorage';
import discoveryMuseumImg from '../assets/images/discovery_museum_badge_1795522643337.jpg';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface DetectiveWorkspaceProps {
  question: ExtractedQuestion;
  allQuestions: ExtractedQuestion[];
  progress: MissionProgress;
  progressById?: Record<string, MissionProgress>;
  totalXp: number;
  level?: number;
  equippedGearId?: string;
  currentStreak: number;
  reducedMotion: boolean;
  nickname: string;
  customTranscript: string;
  onUpdateTranscript: (id: string, value: string) => void;
  onBackToMap: () => void;
  onStageChange: (stage: LearningStage) => void;
  onRecordGuess: (guessIdx: number, isReal?: boolean) => void;
  onCollectClue: (clueKey: string) => void;
  onCompleteStoryBuild: () => void;
  onCompleteSentenceLab?: () => void;
  onSubmitBossAnswer: (
    choiceIdx: number,
    cleanSolveThisSession: boolean,
  ) => {
    isCorrect: boolean;
    xpDelta: number;
    perfectBonus: boolean;
    comboBonus: number;
    earnedStars: 0 | 1 | 2 | 3;
  };
  onGoNextMission: () => void;
  hasNextMission: boolean;
  nextMissionLabel?: string;
  onSelectQuestion?: (questionId: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  masterMuted?: boolean;
  onToggleMute?: () => void;
  dailyQuestBonusXp?: number;
  onClearCelebrationMeta?: () => void;
  onOpenReview?: () => void;
  onOpenTutorial?: () => void;
  newlyUnlockedBadgeTitles: string[];
}

const CIRCLED = ['①', '②', '③', '④', '⑤'];

const FORMAT_KO: Record<ExtractedQuestion['format'], string> = {
  'multiple-choice': '5지선다 독해',
  'in-passage-choice': '지문 번호 선택',
  'chart-analysis': '도표 수치 분석',
  'notice-table': '안내문 · 표',
  'sentence-insertion': '문장 삽입 추론',
  'paragraph-ordering': '글의 순서 배열',
  'summary-completion': '요약문 완성',
  'long-passage-set': '긴 글 세트',
};

type WorkspacePageKey = 'clue' | 'flow' | 'sentence' | 'boss' | 'discovery';

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getChoiceWrongHint(
  question: ExtractedQuestion,
  chosenIdx: number | null,
): string {
  const numLabel = chosenIdx ? `${chosenIdx}번 보기` : '고른 보기';
  if (question.format === 'chart-analysis' || question.chart) {
    return `${numLabel}의 수치·증감·비율 표현을 왼쪽 도표 막대의 숫자와 한 번 더 정확히 대조해 보세요.`;
  }
  if (question.format === 'notice-table' || question.table) {
    return `${numLabel}의 날짜·시간·요금·조건 중 안내문 표와 다른 내용이 있는지 확인해 보세요.`;
  }
  if (question.underlinedTargets && question.underlinedTargets.length > 0) {
    return `${numLabel}이 가리키는 대상이나 문맥상 쓰임(${question.underlinedTargets[0]})을 앞뒤 문장과 다시 연결해 보세요.`;
  }
  if (question.structureOutline.length >= 2) {
    return `${numLabel}은 글의 흐름("${question.structureOutline[0]}")과 어긋나는지 핵심 단서(${question.keyFocus})와 비교해 보세요.`;
  }
  return `${numLabel}이 지문의 핵심 내용(${question.keyFocus})과 맞는지 다시 확인해 보세요!`;
}

export const DetectiveWorkspace: React.FC<DetectiveWorkspaceProps> = ({
  question,
  allQuestions,
  progress,
  progressById = {},
  totalXp,
  level = 1,
  equippedGearId = 'gear_1',
  currentStreak,
  reducedMotion,
  nickname,
  customTranscript,
  onUpdateTranscript,
  onBackToMap,
  onStageChange,
  onRecordGuess,
  onCollectClue,
  onCompleteStoryBuild,
  onCompleteSentenceLab,
  onSubmitBossAnswer,
  onGoNextMission,
  hasNextMission,
  nextMissionLabel,
  onSelectQuestion,
  isBookmarked = false,
  onToggleBookmark,
  masterMuted = false,
  onToggleMute,
  dailyQuestBonusXp = 0,
  onClearCelebrationMeta,
  onOpenReview,
  onOpenTutorial,
  newlyUnlockedBadgeTitles,
}) => {
  const ttsAvailable = isTtsSupported();
  const [splitPngOpen, setSplitPngOpen] = useState(true);
  const [examPanePct, setExamPanePct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('rq_exam_pane_pct_v1'));
      if (Number.isFinite(saved) && saved >= 28 && saved <= 64) return saved;
    } catch {
      // Ignore storage access errors
    }
    return 46;
  });
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [mobileInlinePng, setMobileInlinePng] = useState(false);
  const [pngModalOpen, setPngModalOpen] = useState(false);
  const [bboxDebugOpen, setBboxDebugOpen] = useState(false);
  const [activePngPage, setActivePngPage] = useState<number>(question.pages[0] ?? 1);
  const [imageDims, setImageDims] = useState<ImagePixelDimensions>(DEFAULT_IMAGE_DIMS);
  const [debugScope, setDebugScope] = useState<BboxDebugScope>('current');
  const [debugTarget, setDebugTarget] = useState<BboxDebugTarget>(() =>
    getCoordForPage(question, question.pages[0] ?? 1)?.focus ? 'focus' : 'outer',
  );
  const [debugDeltaByKey, setDebugDeltaByKey] = useState<Record<string, BboxPxDelta>>(() => {
    try {
      const raw = localStorage.getItem('rq_bbox_px_offsets_v1');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, BboxPxDelta>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pageDelta, setPageDelta] = useState<BboxPxDelta>(ZERO_OFFSET_DELTA);
  const [beginnerHintOpen, setBeginnerHintOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [foxErr, setFoxErr] = useState(false);

  const [selectedBossChoice, setSelectedBossChoice] = useState<number | null>(
    progress.bossChoiceIndex,
  );
  const [hadWrongThisVisit, setHadWrongThisVisit] = useState(false);
  const [bossFeedback, setBossFeedback] = useState<{
    submitted: boolean;
    isCorrect: boolean;
    xpDelta: number;
    perfectBonus: boolean;
    comboBonus: number;
    earnedStars: 0 | 1 | 2 | 3;
  } | null>(
    progress.isCorrect !== null
      ? {
          submitted: true,
          isCorrect: progress.isCorrect,
          xpDelta: 0,
          perfectBonus: false,
          comboBonus: 0,
          earnedStars: progress.stars,
        }
      : null,
  );
  const [timerActive, setTimerActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(90);

  // Discovery XP 500ms smooth count-up
  const [displayXpCount, setDisplayXpCount] = useState(progress.earnedXp);

  // Persistent Stage 1 Flow + Beginner Sentence Lab Store
  const [labStore, setLabStore] = useState<SentenceLabStore>(() =>
    loadSentenceLabStore(),
  );
  const claimedXpIdsRef = useRef<Set<string>>(
    new Set(
      Object.entries(loadSentenceLabStore())
        .filter(([, v]) => v.sentenceXpClaimed)
        .map(([k]) => k),
    ),
  );
  const [museumImgError, setMuseumImgError] = useState(false);
  const [safeReplayNotice, setSafeReplayNotice] = useState(false);
  const [stage1SubPage, setStage1SubPage] = useState<'flow' | 'sentence'>('flow');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<'2025' | '2026'>(question.examYear);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [foxCelebration, setFoxCelebration] = useState<{
    xpDelta: number;
    earnedStars: 0 | 1 | 2 | 3;
  } | null>(null);

  useEffect(() => {
    saveSentenceLabStore(labStore);
  }, [labStore]);

  const currentLabDraft = useMemo(
    () => getQuestionLabDraft(labStore, question.id),
    [labStore, question.id],
  );

  const updateCurrentLabDraft = (
    updater: (prev: QuestionLabDraft) => QuestionLabDraft,
  ) => {
    setLabStore((prevStore) => {
      const prevDraft = getQuestionLabDraft(prevStore, question.id);
      return {
        ...prevStore,
        [question.id]: updater(prevDraft),
      };
    });
  };

  useEffect(() => {
    setShowHint(false);
    setBeginnerHintOpen(false);
    setSelectedBossChoice(progress.bossChoiceIndex);
    setHadWrongThisVisit(false);
    setBossFeedback(
      progress.isCorrect !== null
        ? {
            submitted: true,
            isCorrect: progress.isCorrect,
            xpDelta: 0,
            perfectBonus: false,
            comboBonus: 0,
            earnedStars: progress.stars,
          }
        : null,
    );
    setTimerActive(false);
    setSecondsLeft(90);
    setSafeReplayNotice(false);
    setStage1SubPage('flow');
    setPickerOpen(false);
    setPickerYear(question.examYear);
    setFoxCelebration(null);
  }, [question.id, question.examYear, progress.bossChoiceIndex, progress.isCorrect, progress.stars]);

  useEffect(() => {
    const firstPage = question.pages[0] ?? 1;
    setActivePngPage(firstPage);
    setDebugTarget(getCoordForPage(question, firstPage)?.focus ? 'focus' : 'outer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen]);

  useEffect(() => {
    const onOpenHint = () => setBeginnerHintOpen(true);
    window.addEventListener('rq-open-beginner-hint', onOpenHint);
    return () => window.removeEventListener('rq-open-beginner-hint', onOpenHint);
  }, []);

  // 0.5s XP Count-up only on entering Stage 3 (MY DISCOVERY)
  const rawStage = progress.currentStage;
  useEffect(() => {
    if (rawStage !== 3) return;
    const target = progress.earnedXp;
    if (reducedMotion || target <= 0) {
      setDisplayXpCount(target);
      return;
    }
    let rafId = 0;
    const startTime = performance.now();
    const duration = 500;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayXpCount(Math.round(target * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    setDisplayXpCount(0);
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [rawStage, progress.earnedXp, reducedMotion]);

  useEffect(() => {
    if (!timerActive || rawStage !== 2) return;
    if (secondsLeft <= 0) {
      setTimerActive(false);
      return;
    }
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerActive, secondsLeft, rawStage]);

  const guessOptions = useMemo(() => {
    const distractors = allQuestions
      .filter(
        (other) =>
          other.id !== question.id && other.topicSummary !== question.topicSummary,
      )
      .sort((a, b) => {
        const aSame = a.sectionNumber === question.sectionNumber ? 0 : 1;
        const bSame = b.sectionNumber === question.sectionNumber ? 0 : 1;
        return aSame - bSame;
      })
      .slice(0, 6);

    const seed = hashSeed(question.id);
    const d1 =
      distractors[seed % distractors.length]?.topicSummary ?? '일상 속 작은 습관의 변화';
    const d2 =
      distractors[(seed + 3) % distractors.length]?.topicSummary ??
      '새로운 기술이 가져온 학교 생활의 변화';

    const raw = [
      { text: question.topicSummary, isReal: true },
      { text: d1, isReal: false },
      { text: d2, isReal: false },
    ];
    const rotate = seed % 3;
    return [raw[rotate], raw[(rotate + 1) % 3], raw[(rotate + 2) % 3]];
  }, [question, allQuestions]);

  const clueCards = useMemo(() => {
    const cards: {
      key: string;
      kind: string;
      title: string;
      detail: string;
      audioTerm?: string;
    }[] = [];

    (question.footnotes ?? []).forEach((fn, idx) => {
      cards.push({
        key: `fn-${idx}`,
        kind: '각주 어휘',
        title: `* ${fn.term}`,
        detail: fn.meaning,
        audioTerm: fn.term,
      });
    });

    (question.underlinedTargets ?? []).forEach((tgt, idx) => {
      cards.push({
        key: `ul-${idx}`,
        kind: '밑줄 · 지시 단서',
        title: tgt,
        detail: '원본 시험지에서 문맥상 역할이나 지시 대상을 확인해 보세요.',
      });
    });

    cards.push({
      key: 'key-focus',
      kind: '결정적 출제 단서',
      title: '핵심 단서 열기',
      detail: question.keyFocus,
    });

    return cards;
  }, [question]);

  const currentQGlobalIdx = useMemo(
    () => allQuestions.findIndex((q) => q.id === question.id),
    [allQuestions, question.id],
  );
  const prevGlobalQuestion =
    currentQGlobalIdx > 0 ? allQuestions[currentQGlobalIdx - 1] : null;
  const nextGlobalQuestion =
    currentQGlobalIdx >= 0 && currentQGlobalIdx < allQuestions.length - 1
      ? allQuestions[currentQGlobalIdx + 1]
      : null;

  const sameExamQuestions = useMemo(
    () => allQuestions.filter((q) => q.examYear === question.examYear),
    [allQuestions, question.examYear],
  );
  const examPositionIndex = useMemo(() => {
    const idx = sameExamQuestions.findIndex((q) => q.id === question.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [sameExamQuestions, question.id]);
  const questions2025 = useMemo(
    () => allQuestions.filter((q) => q.examYear === '2025'),
    [allQuestions],
  );
  const questions2026 = useMemo(
    () => allQuestions.filter((q) => q.examYear === '2026'),
    [allQuestions],
  );

  const currentSentenceAnalysis = SENTENCE_ANALYSIS_BY_ID[question.id] ?? null;

  // Track completion for checkmarks & ★3 bonus without blocking free stage navigation
  const isStage0Done =
    progress.completed ||
    clueCards.every((c) => progress.discoveredClues.includes(c.key));
  const isStage1Done =
    progress.completed ||
    currentLabDraft.sentenceCompleted ||
    (question.structureOutline.length >= 3
      ? progress.storyChecked
      : progress.guessChoiceIndex !== null &&
        Boolean(guessOptions[progress.guessChoiceIndex]?.isReal));
  const isStage2Done = progress.completed || Boolean(bossFeedback?.isCorrect);

  const maxUnlockedStage: LearningStage = 3;

  const stage = Math.min(progress.currentStage, maxUnlockedStage) as LearningStage;
  const stageInfo = STAGE_META[stage];

  // Ordered workbook pages (splits Stage 1 into 2 non-scrolling pages when sentence analysis exists)
  const pagesList = useMemo(() => {
    const list: {
      key: WorkspacePageKey;
      titleKo: string;
      subtitleKo: string;
      stage: LearningStage;
      subPage?: 'flow' | 'sentence';
    }[] = [
      {
        key: 'clue',
        titleKo: '단어 · 단서 확인',
        subtitleKo: '발문과 단어 카드를 눌러 핵심 단서를 먼저 열어요 (건너뛰고 바로 풀어도 돼요)',
        stage: 0,
      },
      {
        key: 'flow',
        titleKo: '글 흐름 정리',
        subtitleKo: '지문의 전개 순서와 핵심 흐름을 직접 맞춰봐요',
        stage: 1,
        subPage: 'flow',
      },
    ];
    if (currentSentenceAnalysis) {
      list.push({
        key: 'sentence',
        titleKo: '핵심 문장 해석',
        subtitleKo: '핵심 영어 문장을 덩어리씩 끊어서 쉽게 해석해요',
        stage: 1,
        subPage: 'sentence',
      });
    }
    list.push(
      {
        key: 'boss',
        titleKo: '문제 풀기 (①~⑤)',
        subtitleKo: '모은 단서와 원본 시험지를 보고 ①~⑤ 중 정답을 선택해요',
        stage: 2,
      },
      {
        key: 'discovery',
        titleKo: '해설 · 오답 메모',
        subtitleKo: '정답 해설을 확인하고 나만의 한 줄 메모를 남길 수 있어요',
        stage: 3,
      },
    );
    return list;
  }, [currentSentenceAnalysis]);

  const activePageKey: WorkspacePageKey =
    stage === 0
      ? 'clue'
      : stage === 1
        ? currentSentenceAnalysis && stage1SubPage === 'sentence'
          ? 'sentence'
          : 'flow'
        : stage === 2
          ? 'boss'
          : 'discovery';

  const activePageIdx = Math.max(
    0,
    pagesList.findIndex((p) => p.key === activePageKey),
  );
  const currentPageMeta = pagesList[activePageIdx];
  const prevPage = activePageIdx > 0 ? pagesList[activePageIdx - 1] : null;
  const nextPage =
    activePageIdx < pagesList.length - 1 ? pagesList[activePageIdx + 1] : null;
  const isNextPageUnlocked = Boolean(nextPage);

  // Duolingo-style live green progress bar percentage across pages
  const lessonProgressPct = useMemo(() => {
    if (stage === 3) return 100;
    if (stage === 2) return bossFeedback?.isCorrect ? 94 : 78;
    if (stage === 1) {
      if (activePageKey === 'sentence') return isStage1Done ? 70 : 58;
      return isStage1Done ? 62 : 44;
    }
    const clueRatio =
      clueCards.length > 0
        ? progress.discoveredClues.length / clueCards.length
        : 1;
    return Math.round(12 + clueRatio * 20);
  }, [
    stage,
    activePageKey,
    bossFeedback?.isCorrect,
    isStage1Done,
    clueCards.length,
    progress.discoveredClues.length,
  ]);

  // Page-turn motion graphics direction tracking across ALL pages (StrictMode-safe)
  const stageCardRef = useRef<HTMLElement | null>(null);
  const lastPageSnapshotRef = useRef<{
    qId: string;
    pageIdx: number;
    dir: 'next' | 'prev' | 'none';
  }>({
    qId: question.id,
    pageIdx: activePageIdx,
    dir: 'none',
  });

  let pageTurnDir: 'next' | 'prev' | 'none' = lastPageSnapshotRef.current.dir;
  if (lastPageSnapshotRef.current.qId !== question.id) {
    pageTurnDir = 'none';
  } else if (lastPageSnapshotRef.current.pageIdx !== activePageIdx) {
    pageTurnDir =
      activePageIdx > lastPageSnapshotRef.current.pageIdx ? 'next' : 'prev';
  }

  useEffect(() => {
    const prevQ = lastPageSnapshotRef.current.qId;
    const prevP = lastPageSnapshotRef.current.pageIdx;
    lastPageSnapshotRef.current = {
      qId: question.id,
      pageIdx: activePageIdx,
      dir: pageTurnDir,
    };
    if (prevQ === question.id && prevP !== activePageIdx) {
      stageCardRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [question.id, activePageIdx, pageTurnDir, reducedMotion]);

  const goToPageByIndex = (idx: number) => {
    const target = pagesList[idx];
    if (!target || target.stage > maxUnlockedStage) return;
    if (target.subPage) {
      setStage1SubPage(target.subPage);
    }
    if (target.stage !== stage) {
      onStageChange(target.stage);
    }
  };

  const handleGuardedStageChange = (targetStage: LearningStage) => {
    if (targetStage > maxUnlockedStage) return;
    if (targetStage === 1) {
      if (stage === 0) setStage1SubPage('flow');
      else if (stage >= 2 && currentSentenceAnalysis) setStage1SubPage('sentence');
    }
    onStageChange(targetStage);
  };

  // Keyboard Left/Right arrow page flip + Stage 2 shortcuts (1-5 select, Enter submit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pngModalOpen || beginnerHintOpen || foxCelebration || pickerOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (stage === 2 && ['1', '2', '3', '4', '5'].includes(e.key)) {
        const num = Number(e.key);
        if (num <= question.choices.length) {
          e.preventDefault();
          setSelectedBossChoice(num);
          if (bossFeedback?.submitted && !bossFeedback.isCorrect) {
            setBossFeedback(null);
          }
          return;
        }
      }
      if (stage === 2 && e.key === 'Enter') {
        if (selectedBossChoice !== null && (!bossFeedback?.submitted || !bossFeedback.isCorrect)) {
          e.preventDefault();
          handleBossSubmit();
          return;
        }
      }
      if (e.key === 'ArrowRight' && nextPage) {
        e.preventDefault();
        goToPageByIndex(activePageIdx + 1);
      } else if (e.key === 'ArrowLeft' && prevPage) {
        e.preventDefault();
        goToPageByIndex(activePageIdx - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const mascotMood: MascotMood = useMemo(() => {
    if (stage === 0) return 'clue';
    if (stage === 2 && bossFeedback?.submitted) {
      return bossFeedback.isCorrect ? 'correct' : 'retry';
    }
    if (stage === 3) return 'complete';
    return 'idle';
  }, [stage, bossFeedback]);

  const isLavender = question.examYear === '2026';
  const islandTheme = isLavender ? 'lavender' : 'spring';

  const maxChartVal = question.chart
    ? Math.max(...question.chart.data.map((d) => d.value), 1)
    : 100;

  const handleBossSubmit = () => {
    if (selectedBossChoice === null) return;
    setTimerActive(false);
    const cleanSolveThisSession = !hadWrongThisVisit;
    const res = onSubmitBossAnswer(selectedBossChoice, cleanSolveThisSession);
    if (!res.isCorrect) {
      setHadWrongThisVisit(true);
    } else {
      setFoxCelebration({
        xpDelta: res.xpDelta,
        earnedStars: res.earnedStars,
      });
    }
    setBossFeedback({
      submitted: true,
      isCorrect: res.isCorrect,
      xpDelta: res.xpDelta,
      perfectBonus: res.perfectBonus,
      comboBonus: res.comboBonus,
      earnedStars: res.earnedStars,
    });
  };

  // Safe restart: resets active practice attempt UI without losing earned XP, stars, clues, badges, or notes
  const handleSafeRestartMission = (targetStage: LearningStage = 0) => {
    setTimerActive(false);
    setSecondsLeft(90);
    setSelectedBossChoice(null);
    setBossFeedback(null);
    setHadWrongThisVisit(false);
    setSafeReplayNotice(true);
    handleGuardedStageChange(targetStage);
  };

  const renderFoxPromptBubble = (
    kicker: string,
    bodyText: string,
    subTargets?: string[],
  ) => (
    <div className="flex items-start gap-3.5 sm:gap-4">
      <div
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden border-2 shrink-0 bg-[#FFF9EF] flex items-center justify-center shadow-xs ${
          !reducedMotion ? 'rq-fox-bob' : ''
        } ${isLavender ? 'border-[#C6BEE8]' : 'border-[#E5E5E5]'}`}
      >
        {foxErr ? (
          <Sparkles className="w-7 h-7 text-[#58CC02]" />
        ) : (
          <img
            src={mascotImage}
            alt="여우 학습 도우미"
            onError={() => setFoxErr(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div
        className={`dq-speech-bubble ${!reducedMotion ? 'rq-speech-pop' : ''} flex-1 min-w-0 rounded-2xl border-2 bg-white px-4 sm:px-5 py-4 space-y-2 ${
          isLavender ? 'border-[#CFCBE8]' : 'border-[#E5E5E5]'
        }`}
      >
        <div
          className={`text-xs sm:text-sm font-extrabold ${
            isLavender ? 'text-[#5E48A3]' : 'text-[#58A700]'
          }`}
        >
          {kicker}
        </div>
        <h2
          className={`text-lg sm:text-xl font-extrabold leading-relaxed break-words [overflow-wrap:anywhere] ${
            isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'
          }`}
        >
          {bodyText}
        </h2>
        {subTargets && subTargets.length > 0 && (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {subTargets.map((tgt, idx) => {
              const hasEnglish = /[A-Za-z]{2,}/.test(tgt);
              if (hasEnglish && ttsAvailable) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => speakEnglish(tgt, 0.9)}
                    title="눌러서 영어 발음 듣기"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-sm sm:text-base font-mono font-bold underline decoration-dotted decoration-2 underline-offset-4 cursor-pointer transition-colors ${
                      isLavender
                        ? 'bg-[#F5F3FC] border-[#CFCBE8] text-[#3F297A] decoration-[#7963A8] hover:bg-[#EAE3FA]'
                        : 'bg-[#F2FAFF] border-[#BAE6FD] text-[#143752] decoration-[#1CB0F6] hover:bg-[#DDF4FF]'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{tgt}</span>
                  </button>
                );
              }
              return (
                <span
                  key={idx}
                  className={`text-sm sm:text-base font-mono font-bold underline decoration-dotted decoration-2 underline-offset-4 ${
                    isLavender
                      ? 'text-[#3F297A] decoration-[#7963A8]'
                      : 'text-[#143752] decoration-[#1CB0F6]'
                  }`}
                >
                  {tgt}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderChartAndTable = () => (
    <>
      {question.chart && (
        <div
          className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
            isLavender
              ? 'border-[#89B3E8] bg-[#EAF3FD]/70'
              : 'border-[#84D8FF] bg-[#F2FAFF]'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-[#1E1915]">
              도표 자료 · {question.chart.title}
            </h3>
            {question.chart.subtitle && (
              <span className="text-xs sm:text-sm font-semibold text-[#4B3F35]">
                {question.chart.subtitle}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {question.chart.data.map((row) => (
              <div key={row.label} className="grid grid-cols-12 items-center gap-3">
                <div
                  className="col-span-5 text-sm font-bold text-[#1E1915] truncate"
                  title={row.label}
                >
                  {row.label}
                </div>
                <div
                  className={`col-span-5 h-3 bg-white rounded-full overflow-hidden border ${
                    isLavender ? 'border-[#C9C2E8]' : 'border-[#E5E5E5]'
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      isLavender ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
                    }`}
                    style={{ width: `${(row.value / maxChartVal) * 100}%` }}
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-sm font-extrabold text-[#1E1915] tabular-nums">
                  {row.value}
                  {row.unit ?? ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {question.table && (
        <div
          className={`rounded-2xl border-2 bg-white overflow-hidden ${
            isLavender ? 'border-[#9BBCEB]' : 'border-[#E5E5E5]'
          }`}
        >
          <div
            className={`px-4 py-2.5 border-b text-sm font-extrabold ${
              isLavender
                ? 'bg-[#EAF3FD] border-[#C9D2F0] text-[#1D2D5E]'
                : 'bg-[#F7F7F7] border-[#E5E5E5] text-[#1E1915]'
            }`}
          >
            안내문 · 표 자료
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr
                  className={`border-b ${
                    isLavender
                      ? 'bg-[#F4F3FC] border-[#D7D4EE] text-[#2F2C5C]'
                      : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#4B3F35]'
                  }`}
                >
                  {question.table.headers.map((h) => (
                    <th key={h} className="px-4 py-2.5 font-extrabold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isLavender ? 'divide-[#ECEAF8]' : 'divide-[#F0F0F0]'
                }`}
              >
                {question.table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-4 py-2.5 font-medium text-[#1E1915] tabular-nums"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  const showSplitPane =
    splitPngOpen && (stage === 0 || stage === 1 || stage === 2 || bboxDebugOpen);

  const hasPageFocus = Boolean(getCoordForPage(question, activePngPage)?.focus);
  const effectiveTarget: BboxDebugTarget =
    debugTarget === 'focus' && hasPageFocus ? 'focus' : 'outer';
  const debugKey = makeOffsetStorageKey(question.id, activePngPage, effectiveTarget);
  const currentDebugDelta =
    debugScope === 'page'
      ? pageDelta
      : (debugDeltaByKey[debugKey] ?? ZERO_OFFSET_DELTA);
  const activeBboxOffset: BboxOffset = {
    ...currentDebugDelta,
    target: effectiveTarget,
    scope: debugScope,
  };

  useEffect(() => {
    try {
      localStorage.setItem('rq_bbox_px_offsets_v1', JSON.stringify(debugDeltaByKey));
    } catch {
      // Ignore storage access errors
    }
  }, [debugDeltaByKey]);

  const handleChangeBboxOffset = (next: BboxOffset) => {
    setDebugScope(next.scope);
    const targetForNext: BboxDebugTarget =
      next.target === 'focus' && hasPageFocus ? 'focus' : 'outer';
    setDebugTarget(targetForNext);
    const targetKey = makeOffsetStorageKey(question.id, activePngPage, targetForNext);
    const delta: BboxPxDelta = { dx: next.dx, dy: next.dy, dw: next.dw, dh: next.dh };
    if (next.scope === 'page') {
      setPageDelta(delta);
    } else {
      setDebugDeltaByKey((prev) => {
        if (!hasNonZeroDelta(delta)) {
          if (!(targetKey in prev)) return prev;
          const copy = { ...prev };
          delete copy[targetKey];
          return copy;
        }
        return {
          ...prev,
          [targetKey]: delta,
        };
      });
    }
  };

  const handleResetBboxOffset = () => {
    if (debugScope === 'page') {
      setPageDelta(ZERO_OFFSET_DELTA);
    } else {
      setDebugDeltaByKey((prev) => {
        const next = { ...prev };
        delete next[debugKey];
        return next;
      });
    }
  };

  const handleResetAllBboxOffsets = () => {
    setDebugDeltaByKey({});
    setPageDelta(ZERO_OFFSET_DELTA);
  };

  useEffect(() => {
    try {
      localStorage.setItem('rq_exam_pane_pct_v1', String(examPanePct));
    } catch {
      // Ignore storage access errors
    }
  }, [examPanePct]);

  const handleStartSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!splitContainerRef.current) return;
    e.preventDefault();
    setIsResizingSplit(true);

    const onMove = (ev: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawPct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(64, Math.max(28, Math.round(rawPct)));
      setExamPanePct(clamped);
    };

    const onUp = () => {
      setIsResizingSplit(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const stageAnimClass =
    !reducedMotion && pageTurnDir === 'next'
      ? 'rq-page-turn-next'
      : !reducedMotion && pageTurnDir === 'prev'
        ? 'rq-page-turn-prev'
        : '';

  const pickerQuestions = pickerYear === '2025' ? questions2025 : questions2026;
  const stageShortTitles = ['단서', '흐름·해석', '문제', '해설'];

  return (
    <div className="space-y-4">
      {/* Compact Duolingo-Style 2-Row Top Bar + 4x7 Question Grid Popover */}
      <div
        className={`rounded-3xl border-2 bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 space-y-2.5 shadow-xs ${
          isLavender ? 'border-[#C6BEE8] !bg-[#FAF9FF]' : 'border-[#E5E5E5]'
        }`}
      >
        {/* Row 1: [← 목록] + [2025 · 18번 ▾] + Thick Progress Bar + [◀ ▶] + [★] [🔊] [XP] */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onBackToMap}
            aria-label="문제 목록으로 나가기"
            title="문제 목록으로"
            className={`dq-btn-3d min-h-[40px] px-3 rounded-2xl border-2 inline-flex items-center gap-1.5 shrink-0 cursor-pointer text-xs sm:text-sm font-extrabold transition-colors ${
              isLavender
                ? 'bg-[#EEF3FD] border-[#C9C2E8] text-[#1D2D5E] hover:bg-[#DFE9FB]'
                : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] hover:text-[#1E1915]'
            }`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>목록</span>
          </button>

          {/* Question Grid Popover Trigger */}
          <div className="relative shrink-0" ref={pickerRef}>
            <button
              type="button"
              onClick={() => {
                setPickerYear(question.examYear);
                setPickerOpen((v) => !v);
              }}
              aria-expanded={pickerOpen}
              aria-label="문항 번호 선택 열기"
              className={`dq-btn-3d min-h-[40px] px-3 sm:px-3.5 rounded-2xl border-2 inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-extrabold text-white cursor-pointer tabular-nums ${
                isLavender
                  ? 'bg-[#6A52A3] border-[#523B8C] hover:bg-[#5B4494]'
                  : 'bg-[#58CC02] border-[#46A302] hover:bg-[#4FB802]'
              }`}
            >
              <span>
                {question.examYear} · {formatItemNumber(question.originalItemNumber)}
              </span>
              <span className="opacity-85 text-[11px]">
                ({examPositionIndex}/{sameExamQuestions.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  pickerOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {pickerOpen && onSelectQuestion && (
              <div
                className={`absolute left-0 top-full mt-2 z-40 w-[min(92vw,370px)] rounded-3xl border-2 bg-white p-3.5 shadow-xl space-y-3 ${
                  isLavender ? 'border-[#C6BEE8]' : 'border-[#E5E5E5]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] p-0.5 gap-0.5">
                    {(['2025', '2026'] as const).map((yr) => {
                      const activeYr = pickerYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setPickerYear(yr)}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                            activeYr
                              ? yr === '2026'
                                ? 'bg-[#6A52A3] text-white'
                                : 'bg-[#58CC02] text-white'
                              : 'text-[#5C4D42] hover:text-[#1E1915]'
                          }`}
                        >
                          {yr}년 3월
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    aria-label="문항 선택 닫기"
                    className="w-7 h-7 rounded-lg border border-[#E5E5E5] flex items-center justify-center text-[#666666] hover:bg-[#F7F7F7] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 px-1 text-xs font-bold text-[#5C4D42]">
                  <span className="truncate">
                    {question.sectionTitle} · {question.points}점 ·{' '}
                    {question.pages.map((p) => `${p}쪽`).join('–')}
                  </span>
                  {progress.completed && (
                    <span className="px-2 py-0.5 rounded-md bg-[#D7FFB8] text-[#1E4600] font-extrabold shrink-0">
                      ★{progress.stars}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {pickerQuestions.map((q) => {
                    const isCurrentItem = q.id === question.id;
                    const isDoneItem = Boolean(progressById[q.id]?.completed);
                    const shortNum = q.originalItemNumber.replace(/[^0-9]/g, '') || q.originalItemNumber;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          onSelectQuestion(q.id);
                          setPickerOpen(false);
                        }}
                        title={`${q.examYear}년 ${formatItemNumber(q.originalItemNumber)} · ${q.sectionTitle}`}
                        aria-current={isCurrentItem ? 'step' : undefined}
                        className={`h-9 rounded-xl border-2 text-xs font-mono font-extrabold transition-all cursor-pointer tabular-nums flex items-center justify-center ${
                          isCurrentItem
                            ? q.examYear === '2026'
                              ? 'bg-[#6A52A3] border-[#4B3680] text-white ring-2 ring-[#C9B9E8]'
                              : 'bg-[#58CC02] border-[#46A302] text-white ring-2 ring-[#A5ED6E]'
                            : isDoneItem
                              ? q.examYear === '2026'
                                ? 'bg-[#EAE3FA] border-[#B4A3DE] text-[#3B2378] hover:border-[#6A52A3]'
                                : 'bg-[#D7FFB8] border-[#8CE051] text-[#1E4600] hover:border-[#46A302]'
                              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:border-[#1CB0F6]'
                        }`}
                      >
                        {shortNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Thick Duolingo Progress Bar */}
          <div className="flex-1 min-w-[110px] flex items-center gap-2">
            <div
              className={`flex-1 h-3.5 rounded-full overflow-hidden relative ${
                isLavender ? 'bg-[#E5E2F4]' : 'bg-[#E5E5E5]'
              }`}
              role="progressbar"
              aria-valuenow={lessonProgressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`문제 진행률 ${lessonProgressPct}%`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                  isLavender ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
                }`}
                style={{ width: `${lessonProgressPct}%` }}
              >
                <div className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
                {!reducedMotion && (
                  <div
                    aria-hidden="true"
                    className="rq-progress-glint absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                  />
                )}
              </div>
            </div>
            <span className="font-mono text-xs font-extrabold text-[#777777] tabular-nums shrink-0">
              {lessonProgressPct}%
            </span>
            {currentStreak >= 1 && (
              <span
                title={`${currentStreak}연속 정답`}
                className="hidden sm:inline-flex items-center gap-0.5 text-xs font-extrabold text-[#FF9600] tabular-nums shrink-0"
              >
                <Flame className="w-3.5 h-3.5 fill-[#FF9600]" />
                {currentStreak}
              </span>
            )}
          </div>

          {/* Compact Right Utilities */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onSelectQuestion && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={!prevGlobalQuestion}
                  onClick={() =>
                    prevGlobalQuestion && onSelectQuestion(prevGlobalQuestion.id)
                  }
                  aria-label="이전 문제"
                  title={
                    prevGlobalQuestion
                      ? `이전: ${prevGlobalQuestion.examYear}년 ${formatItemNumber(prevGlobalQuestion.originalItemNumber)}`
                      : '첫 문제'
                  }
                  className="w-9 h-9 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center text-[#4B4B4B] hover:border-[#1CB0F6] disabled:opacity-35 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!nextGlobalQuestion}
                  onClick={() =>
                    nextGlobalQuestion && onSelectQuestion(nextGlobalQuestion.id)
                  }
                  aria-label="다음 문제"
                  title={
                    nextGlobalQuestion
                      ? `다음: ${nextGlobalQuestion.examYear}년 ${formatItemNumber(nextGlobalQuestion.originalItemNumber)}`
                      : '마지막 문제'
                  }
                  className="w-9 h-9 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center text-[#4B4B4B] hover:border-[#1CB0F6] disabled:opacity-35 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {onToggleBookmark && (
              <button
                type="button"
                onClick={onToggleBookmark}
                aria-label={isBookmarked ? '찜 해제' : '찜하기'}
                title={isBookmarked ? '찜 해제' : '찜하기'}
                className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center cursor-pointer ${
                  isBookmarked
                    ? 'bg-[#FFE18A] border-[#C9961A] text-[#5C3D00]'
                    : 'bg-white border-[#E5E5E5] text-[#5C4D42] hover:border-[#FFC800]'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    isBookmarked ? 'fill-[#C9961A] text-[#5C3D00]' : ''
                  }`}
                />
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={masterMuted ? '소리 켜기' : '음소거'}
                title={masterMuted ? '소리 켜기' : '음소거'}
                className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center cursor-pointer ${
                  masterMuted
                    ? 'border-[#FF4B4B] bg-[#FFDFE0] text-[#9A1B1B]'
                    : 'border-[#E5E5E5] bg-white text-[#5C4D42] hover:border-[#1CB0F6]'
                }`}
              >
                {masterMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            )}

            <div
              className={`hidden md:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border-2 text-xs font-extrabold whitespace-nowrap shrink-0 ${
                isLavender
                  ? 'bg-[#F2F0FC] border-[#C9B9E8] text-[#211442]'
                  : 'bg-[#FFFDF8] border-[#EAE0D0] text-[#2D2620]'
              }`}
              title={`${nickname} · LV.${level}`}
            >
              <span
                className={`font-mono px-1.5 py-0.5 rounded-md text-[10px] text-white ${
                  isLavender ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
                }`}
              >
                LV.{level}
              </span>
              <span className="max-w-[78px] truncate">{nickname}</span>
            </div>

            <div
              className={`h-9 px-2.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold font-mono tabular-nums inline-flex items-center shrink-0 ${
                isLavender
                  ? 'bg-[#F2F0FC] border-[#C9B9E8] text-[#1D1540]'
                  : 'bg-[#FFF9EF] border-[#E5E5E5] text-[#1E1915]'
              }`}
            >
              {totalXp} XP
            </div>
          </div>
        </div>

        {/* Row 2: Compact 4-Step Tabs + Short Verb/Icon Utility Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EFEAE0]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {STAGE_META.map((st) => {
              const isCurrent = st.index === stage;
              const isStepCompleted =
                (st.index === 0 && isStage0Done) ||
                (st.index === 1 && isStage1Done) ||
                (st.index === 2 && isStage2Done) ||
                (st.index === 3 && isStage2Done);
              return (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => handleGuardedStageChange(st.index)}
                  title={`${st.titleKo} 단계로 이동`}
                  className={`dq-btn-3d min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                    isCurrent
                      ? isLavender
                        ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#1A1038]'
                        : 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                      : isStepCompleted
                        ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                        : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:border-[#1CB0F6]'
                  }`}
                >
                  <span className="tabular-nums">
                    0{st.index + 1} {stageShortTitles[st.index] ?? st.titleKo}
                  </span>
                  {isStepCompleted && !isCurrent && (
                    <Check className="w-3.5 h-3.5 shrink-0 text-[#46A302]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(stage === 0 || stage === 1 || stage === 2) && (
              <>
                <button
                  type="button"
                  onClick={() => setSplitPngOpen((v) => !v)}
                  className={`hidden lg:inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold whitespace-nowrap cursor-pointer ${
                    splitPngOpen
                      ? isLavender
                        ? 'bg-[#D6E8FC] border-[#4A80C2] text-[#102E54]'
                        : 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                      : 'bg-white border-[#E5E5E5] text-[#4B4B4B]'
                  }`}
                >
                  <Columns2 className="w-4 h-4 shrink-0" />
                  <span>시험지</span>
                </button>

                {splitPngOpen && (
                  <div
                    className={`hidden lg:inline-flex items-center rounded-xl border-2 p-0.5 gap-0.5 bg-white ${
                      isLavender ? 'border-[#C6BEE8]' : 'border-[#E5E5E5]'
                    }`}
                    title="시험지 가로 너비 조절 (작게 · 보통 · 크게)"
                  >
                    {[
                      { label: '작게', pct: 34 },
                      { label: '보통', pct: 46 },
                      { label: '크게', pct: 58 },
                    ].map((preset) => {
                      const isPresetActive = Math.abs(examPanePct - preset.pct) <= 2;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setExamPanePct(preset.pct)}
                          className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                            isPresetActive
                              ? isLavender
                                ? 'bg-[#C9B9E8] text-[#211442]'
                                : 'bg-[#DDF4FF] text-[#143752]'
                              : 'text-[#666666] hover:bg-[#F7F7F7]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <span className="h-4 w-px bg-[#E5E5E5] mx-0.5" aria-hidden="true" />
                    <button
                      type="button"
                      disabled={examPanePct <= 28}
                      onClick={() => setExamPanePct((p) => Math.max(28, p - 4))}
                      aria-label="시험지 가로 너비 줄이기"
                      title="시험지 가로 너비 줄이기"
                      className="w-7 h-[30px] rounded-lg text-[#5C4D42] hover:bg-[#F7F7F7] disabled:opacity-35 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px] font-mono font-extrabold tabular-nums text-[#5C4D42]">
                      {examPanePct}%
                    </span>
                    <button
                      type="button"
                      disabled={examPanePct >= 64}
                      onClick={() => setExamPanePct((p) => Math.min(64, p + 4))}
                      aria-label="시험지 가로 너비 넓히기"
                      title="시험지 가로 너비 넓히기"
                      className="w-7 h-[30px] rounded-lg text-[#5C4D42] hover:bg-[#F7F7F7] disabled:opacity-35 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setPngModalOpen(true)}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border-2 bg-white border-[#E5E5E5] hover:border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] whitespace-nowrap cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4 shrink-0 text-[#1CB0F6]" />
                  <span>전체</span>
                </button>
              </>
            )}

            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border-2 border-[#E5E5E5] hover:border-[#58CC02] text-[#4B4B4B] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#58CC02]" />
                <span>푸는 법</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBeginnerHintOpen(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FFE18A] border-2 border-[#D4A72C] text-[#2D2620] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#8A5A00] shrink-0" />
              <span>힌트</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBboxDebugOpen((v) => {
                  const next = !v;
                  if (next) {
                    setSplitPngOpen(true);
                    setMobileInlinePng(true);
                  }
                  return next;
                });
              }}
              aria-pressed={bboxDebugOpen}
              title="문항 오버레이 좌표(bbox) 1px 단위 미세 조정 패널"
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                bboxDebugOpen
                  ? 'bg-[#FFE4E6] border-[#E11D48] text-[#9F1239]'
                  : 'bg-white border-[#E5E5E5] hover:border-[#FDA4AF] text-[#5C4D42]'
              }`}
            >
              <ScanSearch className="w-4 h-4 shrink-0" />
              <span>좌표 오프셋</span>
            </button>
          </div>
        </div>
      </div>

      {bboxDebugOpen && (
        <BboxDebugPanel
          question={question}
          activePage={activePngPage}
          imageDims={imageDims}
          offset={activeBboxOffset}
          savedCount={Object.keys(debugDeltaByKey).length}
          onChangeOffset={handleChangeBboxOffset}
          onResetOffset={handleResetBboxOffset}
          onResetAllOffsets={handleResetAllBboxOffsets}
          onClose={() => setBboxDebugOpen(false)}
        />
      )}

      {/* Main Content Area: Exam PNG + Resizable Splitter + Duolingo Lesson Card */}
      <div
        ref={splitContainerRef}
        style={
          showSplitPane
            ? ({ '--exam-pane-pct': `${examPanePct}%` } as React.CSSProperties)
            : undefined
        }
        className={
          showSplitPane
            ? 'flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-0 min-w-0'
            : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start min-w-0'
        }
      >
        {showSplitPane && (
          <>
            <div className="hidden lg:block lg:w-[var(--exam-pane-pct)] lg:shrink-0 h-[760px] xl:h-[820px] sticky top-6 min-w-0">
              <PngViewer
                pages={question.pages}
                targetExamLabel={`${question.sourceExam} (${formatItemNumber(question.originalItemNumber)})`}
                targetQuestionId={question.id}
                islandTheme={islandTheme}
                bboxDebug={bboxDebugOpen}
                bboxOffset={bboxDebugOpen ? activeBboxOffset : undefined}
                offsetsByKey={debugDeltaByKey}
                onActivePageChange={setActivePngPage}
                onImageDimensionsChange={setImageDims}
                onSelectDebugQuestion={onSelectQuestion}
              />
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="시험지 가로 너비 조절"
              aria-valuemin={28}
              aria-valuemax={64}
              aria-valuenow={examPanePct}
              tabIndex={0}
              title="드래그하여 시험지 가로 너비 조절 (더블클릭: 46%)"
              onPointerDown={handleStartSplitDrag}
              onDoubleClick={() => setExamPanePct(46)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setExamPanePct((p) => Math.max(28, p - 3));
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setExamPanePct((p) => Math.min(64, p + 3));
                }
              }}
              className={`hidden lg:flex w-4 shrink-0 self-stretch items-center justify-center cursor-col-resize select-none group touch-none ${
                isResizingSplit ? 'bg-[#1CB0F6]/10 rounded-full' : ''
              }`}
            >
              <div
                className={`w-1.5 h-20 rounded-full transition-colors ${
                  isResizingSplit
                    ? 'bg-[#1CB0F6]'
                    : isLavender
                      ? 'bg-[#D2CAE8] group-hover:bg-[#6A52A3]'
                      : 'bg-[#DFD6C7] group-hover:bg-[#1CB0F6]'
                }`}
              />
            </div>
          </>
        )}

        <section
          ref={stageCardRef}
          className={`${
            showSplitPane ? 'flex-1 min-w-0 w-full' : 'lg:col-span-8 min-w-0 w-full'
          } clay-card rounded-3xl border-2 bg-white overflow-x-clip scroll-mt-24 ${
            isLavender ? '!border-[#C6BEE8] !bg-[#FCFBFF]' : '!border-[#E5E5E5]'
          }`}
        >
          {/* Animated Workbook Page Wrapper (Stage & Sub-Page Book Flip Motion Graphic) */}
          <div
            key={`${question.id}-page-${activePageKey}`}
            className={`relative overflow-x-clip min-w-0 ${stageAnimClass}`}
          >
            {!reducedMotion && pageTurnDir !== 'none' && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black/[0.08] via-white/40 to-transparent rq-page-sheen z-20"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/[0.09] to-transparent rq-page-fold-shadow z-20"
                />
              </>
            )}

            <div className="p-4 sm:p-6 space-y-6 min-w-0">
              {/* Crisp Page Title + Compact Page Counter Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#F0ECE4]">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span
                    className={`text-xs sm:text-sm font-mono font-extrabold px-2.5 py-0.5 rounded-lg border tabular-nums ${
                      isLavender
                        ? 'bg-[#6A52A3] border-[#523B8C] text-white'
                        : 'bg-[#58CC02] border-[#46A302] text-white'
                    }`}
                  >
                    {formatItemNumber(question.originalItemNumber)}
                  </span>
                  <h1
                    className={`text-lg sm:text-xl font-extrabold ${
                      isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'
                    }`}
                  >
                    {currentPageMeta.titleKo}
                  </h1>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border tabular-nums ${
                      isLavender
                        ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#49467A]'
                        : 'bg-[#FFF9EF] border-[#E5E5E5] text-[#5C4D42]'
                    }`}
                  >
                    {activePageIdx + 1}/{pagesList.length}
                  </span>
                </div>
                <span
                  className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                    isLavender ? 'text-[#5E48A3]' : 'text-[#6E5E52]'
                  }`}
                >
                  {question.sectionTitle} · {question.points}점
                </span>
              </div>

              {/* Mobile/Tablet Inline Collapsible Original Passage */}
              {(stage === 0 || stage === 1 || stage === 2) && (
                <div className="lg:hidden rounded-2xl border-2 border-[#84D8FF] bg-[#F2FAFF] overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => setMobileInlinePng((v) => !v)}
                      className="flex-1 min-h-[42px] text-left text-sm font-extrabold text-[#143752] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <FileImage className="w-5 h-5 shrink-0 text-[#1CB0F6]" />
                      <span>
                        {mobileInlinePng
                          ? '시험지 접기'
                          : `시험지 보기 (${question.pages.map((p) => `${p}쪽`).join('–')})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPngModalOpen(true)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border-2 border-[#84D8FF] text-sm font-extrabold text-[#143752] cursor-pointer"
                    >
                      전체
                    </button>
                  </div>
                  {mobileInlinePng && (
                    <div className="h-[460px] p-2.5 pt-0">
                      <PngViewer
                        pages={question.pages}
                        targetExamLabel={`${question.sourceExam} (${formatItemNumber(question.originalItemNumber)})`}
                        targetQuestionId={question.id}
                        islandTheme={islandTheme}
                        bboxDebug={bboxDebugOpen}
                        bboxOffset={bboxDebugOpen ? activeBboxOffset : undefined}
                        offsetsByKey={debugDeltaByKey}
                        onActivePageChange={setActivePngPage}
                        onImageDimensionsChange={setImageDims}
                        onSelectDebugQuestion={onSelectQuestion}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STAGE 0: 단서 모으기 */}
              {stage === 0 && (
                <div className="space-y-5">
                  {renderFoxPromptBubble(
                    question.setRangeLabel || '1단계 · 핵심 단서',
                    question.prompt,
                    question.underlinedTargets,
                  )}

                  {renderChartAndTable()}

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-sm sm:text-base font-extrabold ${
                          isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'
                        }`}
                      >
                        단서 카드 (+5 XP)
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-sm font-mono font-extrabold tabular-nums ${
                            isLavender ? 'text-[#5E48A3]' : 'text-[#58A700]'
                          }`}
                        >
                          {progress.discoveredClues.length} / {clueCards.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleGuardedStageChange(2)}
                          className={`px-3 py-1 rounded-xl border text-xs font-extrabold cursor-pointer transition-colors ${
                            isLavender
                              ? 'bg-[#F3F1FC] border-[#C6BEE8] text-[#4B3B94] hover:bg-[#EAE3FA]'
                              : 'bg-[#EEFFD9] border-[#58CC02] text-[#285E00] hover:bg-[#D7FFB8]'
                          }`}
                        >
                          바로 풀기 ▶
                        </button>
                      </div>
                    </div>

                    {safeReplayNotice && (
                      <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] px-4 py-3 flex items-center justify-between gap-2 text-sm font-extrabold text-[#1E4600]">
                        <span>
                          기존 기록(XP · 별 ★{progress.stars} · 노트)을 유지한 채 새 연습을 시작했어요!
                        </span>
                        <button
                          type="button"
                          onClick={() => setSafeReplayNotice(false)}
                          aria-label="안내 닫기"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1E4600] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {clueCards.map((clue) => {
                        const isCollected = progress.discoveredClues.includes(clue.key);
                        const isKeyFocusCard = clue.key === 'key-focus';

                        if (isKeyFocusCard && isCollected) {
                          return (
                            <div
                              key={clue.key}
                              className={`sm:col-span-2 text-left p-5 rounded-2xl border-2 space-y-3.5 ${
                                isLavender
                                  ? 'bg-[#EDE8FC] border-[#7963A8]'
                                  : 'bg-[#FFF9DF] border-[#E0B94B]'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs sm:text-sm font-extrabold ${
                                      isLavender ? 'text-[#5B48A3]' : 'text-[#8A6142]'
                                    }`}
                                  >
                                    {clue.kind}
                                  </span>
                                  <span
                                    className={`text-base font-extrabold ${
                                      isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'
                                    }`}
                                  >
                                    · {clue.title}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 ${
                                    isLavender ? 'text-[#2B5FA8]' : 'text-[#46A302]'
                                  }`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>개별 단어 카드 열림 (눌러서 뜻 확인)</span>
                                </span>
                              </div>

                              <KeyFocusWordCards
                                keyFocus={clue.detail}
                                analysis={currentSentenceAnalysis}
                                footnotes={question.footnotes}
                                interactive
                                islandTheme={islandTheme}
                                revealedCardIds={currentLabDraft.revealedFocusCardIds}
                                onToggleCard={(cardId) =>
                                  updateCurrentLabDraft((prev) => ({
                                    ...prev,
                                    revealedFocusCardIds: prev.revealedFocusCardIds.includes(cardId)
                                      ? prev.revealedFocusCardIds
                                      : [...prev.revealedFocusCardIds, cardId],
                                  }))
                                }
                                onRevealAll={(allIds) =>
                                  updateCurrentLabDraft((prev) => ({
                                    ...prev,
                                    revealedFocusCardIds: Array.from(
                                      new Set([...prev.revealedFocusCardIds, ...allIds]),
                                    ),
                                  }))
                                }
                                miniCheckDone={currentLabDraft.focusMiniCheckDone}
                                onCompleteMiniCheck={() =>
                                  updateCurrentLabDraft((prev) => ({
                                    ...prev,
                                    focusMiniCheckDone: true,
                                  }))
                                }
                              />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={clue.key}
                            className={`rq-hover-lift relative rounded-2xl border-2 transition-all flex flex-col min-w-0 ${
                              isKeyFocusCard ? 'sm:col-span-2' : ''
                            } ${
                              isCollected
                                ? isLavender
                                  ? 'bg-[#EAE3FA] border-[#7963A8]'
                                  : 'bg-[#D7FFB8]/65 border-[#58CC02]'
                                : isLavender
                                  ? 'bg-white border-[#CFCBE8] hover:border-[#6A52A3]'
                                  : 'bg-white border-[#E5E5E5] hover:border-[#1CB0F6]'
                            }`}
                          >
                            {clue.audioTerm && ttsAvailable && (
                              <button
                                type="button"
                                onClick={() => speakEnglish(clue.audioTerm ?? '', 0.9)}
                                aria-label={`${clue.audioTerm} 발음 듣기`}
                                title="영단어 발음 듣기"
                                className="absolute top-3 right-3 z-10 min-h-[34px] px-2.5 py-1 rounded-xl bg-white border-2 border-[#E5E5E5] hover:border-[#1CB0F6] text-[#1C7CB5] inline-flex items-center gap-1 text-xs font-extrabold cursor-pointer shadow-2xs"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>발음</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onCollectClue(clue.key)}
                              className="w-full min-w-0 text-left p-4 sm:p-5 min-h-[120px] cursor-pointer flex flex-col justify-between gap-2 rounded-2xl"
                            >
                              <div className={`flex flex-wrap items-center justify-between gap-2 w-full min-w-0 ${clue.audioTerm && ttsAvailable ? 'pr-16' : ''}`}>
                                <span
                                  className={`text-xs sm:text-sm font-extrabold ${
                                    isLavender ? 'text-[#5B48A3]' : 'text-[#777777]'
                                  }`}
                                >
                                  {clue.kind}
                                </span>
                                <span
                                  className={`text-xs sm:text-sm font-extrabold inline-flex items-center gap-1 shrink-0 ${
                                    isCollected
                                      ? isLavender
                                        ? 'text-[#2B5FA8]'
                                        : 'text-[#46A302]'
                                      : isLavender
                                        ? 'text-[#5B48A3]'
                                        : 'text-[#1CB0F6]'
                                  }`}
                                >
                                  {isCollected ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>확인 완료</span>
                                    </>
                                  ) : (
                                    <>
                                      <Search className="w-4 h-4" />
                                      <span>눌러서 열기</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <div
                                className={`text-base sm:text-lg font-extrabold break-words [overflow-wrap:anywhere] ${
                                  isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'
                                }`}
                              >
                                {clue.title}
                              </div>
                              <p
                                className={`text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
                                  isLavender ? 'text-[#2E2D59]' : 'text-[#4B4B4B]'
                                }`}
                              >
                                {isCollected
                                  ? clue.detail
                                  : isKeyFocusCard
                                    ? '누르면 핵심 단어와 표현이 개별 카드로 펼쳐져요!'
                                    : '카드를 누르면 뜻과 포인트가 열려요'}
                              </p>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 1 (SPLIT PAGES): Page A = 글 흐름 보기, Page B = 초보자 의미 단위 해석 */}
              {stage === 1 && (
                <div className="space-y-4">
                  {/* Compact Sub-Page Switcher Pills when Stage 1 has Sentence Lab */}
                  {currentSentenceAnalysis && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setStage1SubPage('flow')}
                          className={`dq-btn-3d min-h-[48px] px-4 py-2 rounded-2xl border-2 text-sm sm:text-base font-extrabold cursor-pointer flex items-center justify-center gap-2 ${
                            activePageKey === 'flow'
                              ? isLavender
                                ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#1A1038]'
                                : 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                              : 'bg-white border-[#E5E5E5] text-[#4B4B4B]'
                          }`}
                        >
                          <span>글 흐름</span>
                          {progress.storyChecked && (
                            <CheckCircle2 className="w-4 h-4 text-[#46A302]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStage1SubPage('sentence')}
                          className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-2xl border-2 text-sm sm:text-base font-extrabold cursor-pointer flex items-center justify-center gap-2 ${
                            activePageKey === 'sentence'
                              ? isLavender
                                ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#1A1038]'
                                : 'bg-[#EAF5E4] border-[#58CC02] text-[#1E4600]'
                              : 'bg-white border-[#E5E5E5] text-[#4B4B4B]'
                          }`}
                        >
                          <span>문장 해석</span>
                          {currentLabDraft.sentenceCompleted && (
                            <CheckCircle2 className="w-4 h-4 text-[#46A302]" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {activePageKey === 'flow' && (
                    <FlowBuilderPanel
                      key={`flow-${question.id}`}
                      question={question}
                      progress={progress}
                      draft={currentLabDraft}
                      guessOptions={guessOptions}
                      onUpdateDraft={updateCurrentLabDraft}
                      onCompleteStoryBuild={onCompleteStoryBuild}
                      onRecordGuess={onRecordGuess}
                      onGoToBoss={() =>
                        currentSentenceAnalysis
                          ? setStage1SubPage('sentence')
                          : handleGuardedStageChange(2)
                      }
                      nextStepLabel={
                        currentSentenceAnalysis
                          ? '문장 해석'
                          : '문제 풀기'
                      }
                      onSkipToBoss={() => handleGuardedStageChange(2)}
                      islandTheme={islandTheme}
                    />
                  )}

                  {activePageKey === 'sentence' && currentSentenceAnalysis && (
                    <SentenceChunkWorkshop
                      key={`lab-${question.id}`}
                      analysis={currentSentenceAnalysis}
                      draft={currentLabDraft}
                      onUpdateDraft={updateCurrentLabDraft}
                      onGoToBoss={() => handleGuardedStageChange(2)}
                      islandTheme={islandTheme}
                      onClaimSentenceXp={() => {
                        if (claimedXpIdsRef.current.has(question.id)) return;
                        claimedXpIdsRef.current.add(question.id);
                        updateCurrentLabDraft((prev) => ({
                          ...prev,
                          sentenceXpClaimed: true,
                          sentenceCompleted: true,
                        }));
                        onCompleteSentenceLab?.();
                      }}
                    />
                  )}
                </div>
              )}

              {/* STAGE 2: 정답 고르기 (Duolingo Multiple-Choice Layout) */}
              {stage === 2 && (
                <div className="space-y-5">
                  {/* Optional 90s Practice Timer + Safe Replay Bar */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 ${
                      isLavender
                        ? 'bg-[#F3F1FC] border-[#C9B9E8]'
                        : 'bg-[#FAFAFA] border-[#E5E5E5]'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-sm font-extrabold ${
                        isLavender ? 'text-[#3B386B]' : 'text-[#4B4B4B]'
                      }`}
                    >
                      <Clock
                        className={`w-5 h-5 ${
                          isLavender ? 'text-[#5E48A3]' : 'text-[#1CB0F6]'
                        }`}
                      />
                      <span>타이머</span>
                      <span
                        className={`font-mono text-base font-extrabold tabular-nums ${
                          secondsLeft <= 15 && timerActive
                            ? 'text-[#EA2B2B]'
                            : isLavender
                              ? 'text-[#14132E]'
                              : 'text-[#1E1915]'
                        }`}
                      >
                        {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                        {String(secondsLeft % 60).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (secondsLeft === 0) setSecondsLeft(90);
                          setTimerActive((v) => !v);
                        }}
                        className="min-h-[38px] px-3 py-1 rounded-xl bg-white border-2 border-[#E5E5E5] hover:border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#1E1915] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{timerActive ? '정지' : '시작'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTimerActive(false);
                          setSecondsLeft(90);
                        }}
                        className="min-h-[38px] px-3 py-1 rounded-xl bg-white border-2 border-[#E5E5E5] text-xs sm:text-sm font-bold text-[#666666] hover:text-[#1E1915] cursor-pointer"
                      >
                        리셋
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSafeRestartMission(2)}
                        title="기존 XP와 별 기록은 유지하고 보기만 다시 고릅니다"
                        className="min-h-[38px] px-3.5 py-1 rounded-xl border-2 bg-[#DDF4FF] border-[#84D8FF] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>다시 풀기</span>
                      </button>
                    </div>
                  </div>

                  {/* Mascot + Speech Bubble Question Prompt */}
                  {renderFoxPromptBubble(
                    question.setRangeLabel || '정답 고르기',
                    question.prompt,
                    question.underlinedTargets,
                  )}

                  {renderChartAndTable()}

                  {question.footnotes && question.footnotes.length > 0 && (
                    <div
                      className={`rounded-2xl border-2 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm ${
                        isLavender
                          ? 'bg-[#F5F3FC] border-[#D7D2EE] text-[#2F2C5C]'
                          : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#4B4B4B]'
                      }`}
                    >
                      {question.footnotes.map((fn) => (
                        <span key={fn.term}>
                          <strong className="font-mono text-[#1E1915]">
                            *{fn.term}
                          </strong>
                          : {fn.meaning}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Duolingo Tactile Choice Bars ①–⑤ */}
                  <div className="space-y-3">
                    {question.choices.map((choice, idx) => {
                      const choiceNum = idx + 1;
                      const isSelected = selectedBossChoice === choiceNum;
                      const isCorrectChoice = question.answerIndex === choiceNum;
                      const showResult = bossFeedback?.submitted;

                      let style = isLavender
                        ? 'dq-btn-3d bg-white border-[#D3D1EC] hover:border-[#6A52A3] text-[#14132E]'
                        : 'dq-btn-3d bg-white border-[#E5E5E5] hover:border-[#1CB0F6] text-[#1E1915]';
                      if (showResult && bossFeedback.isCorrect && isCorrectChoice) {
                        style =
                          'dq-btn-3d bg-[#D7FFB8] border-[#58CC02] text-[#1E4600] font-bold';
                      } else if (showResult && isSelected && !isCorrectChoice) {
                        style = 'dq-btn-3d bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1212]';
                      } else if (isSelected) {
                        style = isLavender
                          ? 'dq-btn-3d bg-[#EAE3FA] border-[#6A52A3] text-[#14132E] font-bold'
                          : 'dq-btn-3d bg-[#DDF4FF] border-[#1CB0F6] text-[#143752] font-bold';
                      }

                      return (
                        <button
                          key={choiceNum}
                          type="button"
                          onClick={() => {
                            setSelectedBossChoice(choiceNum);
                            if (bossFeedback?.submitted && !bossFeedback.isCorrect) {
                              setBossFeedback(null);
                            }
                          }}
                          className={`rq-hover-lift w-full min-w-0 text-left px-4 sm:px-5 py-4 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 cursor-pointer min-h-[64px] ${style}`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span
                              className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-mono text-sm font-extrabold shrink-0 mt-0.5 ${
                                isSelected
                                  ? showResult && !bossFeedback.isCorrect && !isCorrectChoice
                                    ? 'bg-[#FF4B4B] border-[#D92B2B] text-white'
                                    : showResult && bossFeedback.isCorrect && isCorrectChoice
                                      ? 'bg-[#58CC02] border-[#46A302] text-white'
                                      : isLavender
                                        ? 'bg-[#6A52A3] border-[#523B8C] text-white'
                                        : 'bg-[#1CB0F6] border-[#1899D6] text-white'
                                  : isLavender
                                    ? 'bg-[#F3F2FC] border-[#C9C2E8] text-[#5B489E]'
                                    : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#777777]'
                              }`}
                            >
                              {choiceNum}
                            </span>
                            <span className="flex-1 min-w-0 text-base sm:text-lg leading-relaxed font-semibold break-words [overflow-wrap:anywhere]">
                              {choice}
                            </span>
                          </div>

                          {showResult && bossFeedback.isCorrect && isCorrectChoice && (
                            <span className="inline-flex items-center gap-1 text-sm font-extrabold text-[#285E00] shrink-0 mt-1">
                              <Check className="w-5 h-5" />
                              정답
                            </span>
                          )}
                          {showResult && isSelected && !isCorrectChoice && (
                            <span className="text-sm font-extrabold text-[#EA2B2B] shrink-0 mt-1">
                              다시 확인
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STAGE 3: Focused Summary, Explanation & Note */}
              {stage === 3 && (
                <div className="space-y-5">
                  <div
                    className={`rounded-3xl border-2 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isLavender
                        ? 'border-[#C9B9E8] bg-gradient-to-r from-[#F5F2FF] to-white'
                        : 'border-[#A5ED6E] bg-gradient-to-r from-[#EEFFD9] to-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`rq-float-gentle w-16 h-16 rounded-2xl overflow-hidden border-2 bg-white flex items-center justify-center shrink-0 shadow-xs ${
                          isLavender ? 'border-[#8D7AD6]' : 'border-[#58CC02]'
                        }`}
                      >
                        {museumImgError ? (
                          <Award className="w-8 h-8 text-[#58CC02]" />
                        ) : (
                          <img
                            src={mascotImage}
                            alt="여우 캐릭터 축하"
                            onError={() => setMuseumImgError(true)}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#58A700]">
                          <Sparkles className="w-4 h-4" />
                          <span>풀이 완료! 노트에 자동 저장됨</span>
                        </div>
                        <h2
                          className={`text-xl sm:text-2xl font-extrabold ${
                            isLavender ? 'text-[#211442]' : 'text-[#1E1915]'
                          }`}
                        >
                          {question.sourceExam} · 정답 {CIRCLED[question.answerIndex - 1]}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-white border-2 border-[#EAE0D0]">
                        {[1, 2, 3].map((s) => {
                          const earned = s <= progress.stars;
                          return (
                            <Star
                              key={s}
                              style={{ animationDelay: `${(s - 1) * 110}ms` }}
                              className={`w-5 h-5 ${
                                earned
                                  ? 'text-[#FFC800] fill-[#FFC800] animate-star-pop'
                                  : 'text-[#E5E5E5]'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <div className="px-3.5 py-2 rounded-2xl border-2 border-[#FFC800] bg-[#FFFBEB] font-mono text-sm font-extrabold text-[#58A700] tabular-nums">
                        +{displayXpCount} XP
                      </div>
                      <div className="px-3.5 py-2 rounded-2xl border-2 border-[#84D8FF] bg-[#F2FAFF] font-mono text-sm font-extrabold text-[#143752] tabular-nums">
                        단서 {progress.discoveredClues.length}/{clueCards.length}
                      </div>
                    </div>
                  </div>

                  {newlyUnlockedBadgeTitles.length > 0 && (
                    <div className="rounded-2xl border-2 bg-[#FFF6DA] border-[#FFC800] p-4">
                      <div className="text-sm font-extrabold mb-1.5 text-[#7B5600]">
                        새로 획득한 배지!
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {newlyUnlockedBadgeTitles.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center gap-1.5 text-base font-extrabold text-[#1E1915]"
                          >
                            <Award className="w-5 h-5 text-[#B47A00]" />
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border-2 border-[#58CC02] bg-[#EEFFD9]/70 p-5 space-y-2">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#1E4600]">
                      <CheckCircle2 className="w-5 h-5 text-[#46A302]" />
                      <span>정답 해설 ({CIRCLED[question.answerIndex - 1]})</span>
                    </div>
                    <p className="text-sm sm:text-base text-[#1E1915] leading-relaxed font-medium">
                      {question.answerNote}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FAFAFA] p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`quest-note-${question.id}`}
                        className="text-sm font-extrabold text-[#4B4B4B]"
                      >
                        내 오답 · 해석 노트 (자동 저장)
                      </label>
                      {customTranscript && (
                        <button
                          type="button"
                          onClick={() => onUpdateTranscript(question.id, '')}
                          className="text-sm font-bold text-[#1CB0F6] hover:underline cursor-pointer"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        '#모르는단어',
                        '#문장구조어려움',
                        '#해석헷갈림',
                        '#보기함정주의',
                        '#선생님께질문',
                      ].map((tag) => {
                        const hasTag = customTranscript.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const nextVal = hasTag
                                ? customTranscript.replace(tag, '').replace(/\s{2,}/g, ' ').trim()
                                : customTranscript.trim()
                                  ? `${customTranscript.trim()} ${tag}`
                                  : tag;
                              onUpdateTranscript(question.id, nextVal);
                            }}
                            className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                              hasTag
                                ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                                : 'bg-white border-[#E5E5E5] text-[#5C4D42] hover:border-[#1CB0F6]'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      id={`quest-note-${question.id}`}
                      rows={2}
                      value={customTranscript}
                      onChange={(e) => onUpdateTranscript(question.id, e.target.value)}
                      placeholder="내가 헷갈렸던 단어나 핵심 문장 해석을 자유롭게 적어두세요."
                      className="w-full px-4 py-3 text-base bg-white border-2 border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#1CB0F6] text-[#1E1915]"
                    />
                  </div>

                  <div className="rounded-2xl border-2 border-[#E5E5E5] bg-white p-4 sm:p-5 flex items-start gap-3">
                    <img
                      src={discoveryMuseumImg}
                      alt="수집품 수첩"
                      onError={() => setMuseumImgError(true)}
                      className="w-16 h-14 rounded-xl object-cover border border-[#E5E5E5] shrink-0 hidden sm:block"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-[#1E1915]">
                        오늘의 독해 전략 요약
                      </div>
                      <p className="text-sm text-[#4B4B4B] leading-relaxed">
                        {question.keyFocus}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STICKY ZERO-SCROLL DUOLINGO-STYLE BOTTOM PAGE-TURN / FEEDBACK SHEET */}
            {stage === 2 && bossFeedback?.submitted ? (
              <div
                className={`sticky bottom-2 z-20 rounded-b-3xl shadow-[0_-8px_22px_rgba(30,25,21,0.08)] border-t-2 px-5 sm:px-7 py-4 sm:py-5 space-y-3 ${
                  !reducedMotion ? 'rq-feedback-rise' : ''
                } ${
                  bossFeedback.isCorrect
                    ? 'bg-[#D7FFB8] border-[#A5ED6E]'
                    : 'bg-[#FFDFE0] border-[#FF9C9E]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 ${
                          bossFeedback.isCorrect ? 'text-[#58A700]' : 'text-[#EA2B2B]'
                        }`}
                      >
                        {bossFeedback.isCorrect ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <X className="w-5 h-5 stroke-[3]" />
                        )}
                      </span>
                      <span
                        className={`text-lg sm:text-xl font-extrabold ${
                          bossFeedback.isCorrect ? 'text-[#285E00]' : 'text-[#9A1B1B]'
                        }`}
                      >
                        {bossFeedback.isCorrect
                          ? `정답이에요! 멋져요!${
                              bossFeedback.xpDelta > 0
                                ? ` (+${bossFeedback.xpDelta} XP)`
                                : ''
                            }`
                          : '아쉬워요! 힌트를 보고 다시 골라볼까요?'}
                      </span>
                      {bossFeedback.isCorrect && bossFeedback.perfectBonus && (
                        <span className="text-xs sm:text-sm font-extrabold text-[#285E00]">
                          · 한 번에 정답!
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm sm:text-base font-bold leading-relaxed ${
                        bossFeedback.isCorrect ? 'text-[#1E4600]' : 'text-[#7A1212]'
                      }`}
                    >
                      {bossFeedback.isCorrect
                        ? `해설: ${question.answerNote}`
                        : `힌트: ${getChoiceWrongHint(question, selectedBossChoice)}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {bossFeedback.isCorrect ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSafeRestartMission(2)}
                          className="dq-btn-3d min-h-[48px] px-4 py-2 rounded-2xl bg-white border-2 border-[#84D8FF] text-sm sm:text-base font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>다시 풀기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGuardedStageChange(3)}
                          className="dq-btn-3d min-h-[48px] px-4 py-2 rounded-2xl bg-white border-2 border-[#A5ED6E] text-sm sm:text-base font-extrabold text-[#285E00] cursor-pointer"
                        >
                          해설
                        </button>
                        {hasNextMission ? (
                          <button
                            type="button"
                            onClick={onGoNextMission}
                            className={`dq-btn-3d min-h-[52px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base font-extrabold inline-flex items-center gap-2 cursor-pointer ${
                              !reducedMotion ? 'rq-unlock-pulse' : ''
                            }`}
                          >
                            <span>
                              {nextMissionLabel
                                ? `다음 문제 (${nextMissionLabel})`
                                : '다음 문제'}
                            </span>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGuardedStageChange(3)}
                            className="dq-btn-3d min-h-[52px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base font-extrabold inline-flex items-center gap-2 cursor-pointer"
                          >
                            <span>결과 보기</span>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setBeginnerHintOpen(true)}
                          className="dq-btn-3d min-h-[48px] px-4 py-2 rounded-2xl bg-[#FFF8E0] border-2 border-[#D4A72C] text-[#6B4A00] text-sm sm:text-base font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>힌트</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBossFeedback(null);
                            setSelectedBossChoice(null);
                          }}
                          className="dq-btn-3d min-h-[48px] px-5 py-2 rounded-2xl bg-white border-2 border-[#FF9C9E] text-[#9A1B1B] text-sm sm:text-base font-extrabold cursor-pointer"
                        >
                          다시 고르기
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : stage === 3 ? (
              <div className="sticky bottom-2 z-20 rounded-b-3xl shadow-[0_-8px_22px_rgba(30,25,21,0.08)] border-t-2 border-[#E5E5E5] bg-[#FAFAFA] px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onBackToMap}
                    className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl bg-white border-2 border-[#E5E5E5] text-sm sm:text-base font-extrabold text-[#4B4B4B] cursor-pointer"
                  >
                    목록
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGuardedStageChange(2)}
                    className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl bg-white border-2 border-[#E5E5E5] text-sm sm:text-base font-bold text-[#4B4B4B] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>문제</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSafeRestartMission(0)}
                    className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl bg-white border-2 border-[#84D8FF] text-sm sm:text-base font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>다시 풀기</span>
                  </button>
                  {onOpenReview && hasNextMission && (
                    <button
                      type="button"
                      onClick={onOpenReview}
                      className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl bg-[#FFF6DA] border-2 border-[#FFC800] text-sm sm:text-base font-extrabold text-[#6B4A00] cursor-pointer"
                    >
                      복습
                    </button>
                  )}
                </div>

                {hasNextMission ? (
                  <button
                    type="button"
                    onClick={onGoNextMission}
                    className={`dq-btn-3d min-h-[52px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base font-extrabold inline-flex items-center gap-2 cursor-pointer ${
                      !reducedMotion ? 'rq-unlock-pulse' : ''
                    }`}
                  >
                    <span>
                      {nextMissionLabel
                        ? `다음 문제 (${nextMissionLabel})`
                        : '다음 문제'}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  onOpenReview && (
                    <button
                      type="button"
                      onClick={onOpenReview}
                      className="dq-btn-3d min-h-[52px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base font-extrabold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>복습 보기</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )
                )}
              </div>
            ) : (
              /* Sticky Zero-Scroll Bottom Action Bar for Stage 0, Stage 1 Sub-Pages, and Stage 2 Pre-Submit */
              <div
                className={`sticky bottom-2 z-20 rounded-b-3xl shadow-[0_-8px_22px_rgba(30,25,21,0.08)] border-t-2 px-5 sm:px-7 py-3.5 space-y-2 ${
                  (stage === 0 && isStage0Done) || (stage === 1 && isStage1Done)
                    ? 'bg-[#D7FFB8] border-[#A5ED6E]'
                    : 'bg-[#FAFAFA] border-[#E5E5E5]'
                }`}
              >
                {((stage === 0 && isStage0Done) || (stage === 1 && isStage1Done)) && (
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#285E00]">
                    <CheckCircle2 className="w-4 h-4 text-[#46A302]" />
                    <span>
                      {stage === 0 ? '단서 완료!' : '연습 완료!'}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!prevPage}
                      onClick={() => goToPageByIndex(activePageIdx - 1)}
                      className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl border-2 bg-white border-[#E5E5E5] text-sm sm:text-base font-extrabold text-[#4B4B4B] disabled:opacity-40 disabled:pointer-events-none cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>이전</span>
                    </button>

                    {stage === 2 && (
                      <button
                        type="button"
                        onClick={() => setBeginnerHintOpen(true)}
                        className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl border-2 border-[#D4A72C] bg-[#FFF8E0] text-sm sm:text-base font-extrabold text-[#6B4A00] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>힌트</span>
                      </button>
                    )}

                    {activePageKey === 'flow' && currentSentenceAnalysis && (
                      <button
                        type="button"
                        onClick={() => handleGuardedStageChange(2)}
                        className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl border-2 bg-white border-[#58CC02] text-sm font-extrabold text-[#285E00] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>바로 풀기 ▶</span>
                      </button>
                    )}
                  </div>

                  {stage === 2 ? (
                    <button
                      type="button"
                      disabled={selectedBossChoice === null}
                      onClick={handleBossSubmit}
                      className="dq-btn-3d ml-auto min-h-[50px] px-6 py-2 rounded-2xl font-extrabold text-base sm:text-lg bg-[#58CC02] border-2 border-[#46A302] text-white disabled:bg-[#E5E5E5] disabled:border-[#D4D4D4] disabled:text-[#999999] disabled:cursor-not-allowed cursor-pointer"
                    >
                      {selectedBossChoice === null
                        ? '번호 선택'
                        : `${selectedBossChoice}번 정답 확인`}
                    </button>
                  ) : (
                    nextPage && (
                      <button
                        type="button"
                        onClick={() => goToPageByIndex(activePageIdx + 1)}
                        className={`dq-btn-3d ml-auto min-h-[50px] px-6 py-2 rounded-2xl text-base font-extrabold inline-flex items-center gap-2 bg-[#58CC02] border-2 border-[#46A302] text-white cursor-pointer ${
                          !reducedMotion && isNextPageUnlocked && ((stage === 0 && isStage0Done) || (stage === 1 && isStage1Done))
                            ? 'rq-unlock-pulse'
                            : ''
                        }`}
                      >
                        <span>다음 ({nextPage.titleKo})</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
        </section>

        {!showSplitPane && (
          <aside className="lg:col-span-4 space-y-4 min-w-0">
            <MascotWidget
              mood={mascotMood}
              nickname={nickname}
              compact={false}
              currentStreak={currentStreak}
              islandTheme={islandTheme}
              level={level}
              equippedGearId={equippedGearId}
            />

            <div
              className={`rounded-2xl border-2 bg-white p-5 space-y-3 shadow-xs ${
                isLavender ? 'border-[#C6BEE8] !bg-[#FAF9FF]' : 'border-[#E5E5E5]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className={`flex items-center gap-2 text-sm sm:text-base font-extrabold ${
                    isLavender ? 'text-[#5E4AA3]' : 'text-[#8A6142]'
                  }`}
                >
                  <Lightbulb className="w-5 h-5" />
                  <span>단계별 핵심 힌트</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs sm:text-sm font-mono font-bold tabular-nums ${
                      isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'
                    }`}
                  >
                    단서 {progress.discoveredClues.length}/{clueCards.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-xl border-2 text-sm font-extrabold cursor-pointer ${
                      isLavender
                        ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#14132E] hover:border-[#6A52A3]'
                        : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#1E1915] hover:border-[#1CB0F6]'
                    }`}
                  >
                    {showHint ? '접기' : '포인트 보기'}
                  </button>
                </div>
              </div>
              <p
                className={`text-sm leading-relaxed font-medium break-words [overflow-wrap:anywhere] ${
                  isLavender ? 'text-[#3B386B]' : 'text-[#4B4B4B]'
                }`}
              >
                {stageInfo.detectiveTip}
              </p>
              {showHint && (
                <div
                  className={`rounded-xl border-2 p-3.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
                    isLavender
                      ? 'bg-[#E8F1FD] border-[#7AAEE3] text-[#162C5E]'
                      : 'bg-[#FFF8DF] border-[#E0B94B] text-[#1E1915]'
                  }`}
                >
                  <span className="font-extrabold inline-flex items-center gap-1.5 mr-1.5">
                    <HelpCircle
                      className={`w-4 h-4 ${
                        isLavender ? 'text-[#3B6FB6]' : 'text-[#8A6142]'
                      }`}
                    />
                    핵심 포인트:
                  </span>
                  {question.keyFocus}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {showSplitPane && (
        <aside className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          <MascotWidget
            mood={mascotMood}
            nickname={nickname}
            compact
            currentStreak={currentStreak}
            islandTheme={islandTheme}
            level={level}
            equippedGearId={equippedGearId}
          />

          <div
            className={`rounded-2xl border-2 bg-white p-5 space-y-3 shadow-xs min-w-0 ${
              isLavender ? 'border-[#C6BEE8] !bg-[#FAF9FF]' : 'border-[#E5E5E5]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 text-sm sm:text-base font-extrabold ${
                  isLavender ? 'text-[#5E4AA3]' : 'text-[#8A6142]'
                }`}
              >
                <Lightbulb className="w-5 h-5" />
                <span>단계별 핵심 힌트</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs sm:text-sm font-mono font-bold tabular-nums ${
                    isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'
                  }`}
                >
                  단서 {progress.discoveredClues.length}/{clueCards.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowHint((prev) => !prev)}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl border-2 text-sm font-extrabold cursor-pointer ${
                    isLavender
                      ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#14132E] hover:border-[#6A52A3]'
                      : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#1E1915] hover:border-[#1CB0F6]'
                  }`}
                >
                  {showHint ? '접기' : '포인트 보기'}
                </button>
              </div>
            </div>
            <p
              className={`text-sm leading-relaxed font-medium break-words [overflow-wrap:anywhere] ${
                isLavender ? 'text-[#3B386B]' : 'text-[#4B4B4B]'
              }`}
            >
              {stageInfo.detectiveTip}
            </p>
            {showHint && (
              <div
                className={`rounded-xl border-2 p-3.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
                  isLavender
                    ? 'bg-[#E8F1FD] border-[#7AAEE3] text-[#162C5E]'
                    : 'bg-[#FFF8DF] border-[#E0B94B] text-[#1E1915]'
                }`}
              >
                <span className="font-extrabold inline-flex items-center gap-1.5 mr-1.5">
                  <HelpCircle
                    className={`w-4 h-4 ${
                      isLavender ? 'text-[#3B6FB6]' : 'text-[#8A6142]'
                    }`}
                  />
                  핵심 포인트:
                </span>
                {question.keyFocus}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Fullscreen Original PNG Modal */}
      {pngModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E1915]/55 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-6xl h-[90vh] rounded-3xl border-2 border-[#E5E5E5] overflow-hidden flex flex-col bg-[#FFF9EF] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#E5E5E5] bg-white">
              <div className="text-base font-extrabold text-[#1E1915]">
                {question.sourceExam} 원본 시험지 ({question.pages.map((p) => `${p}p`).join('–')})
              </div>
              <button
                type="button"
                onClick={() => setPngModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#1E1915] hover:bg-[#FFDFE0] flex items-center justify-center cursor-pointer"
                aria-label="원본 이미지 창 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3 flex flex-col gap-3">
              {bboxDebugOpen && (
                <BboxDebugPanel
                  question={question}
                  activePage={activePngPage}
                  imageDims={imageDims}
                  offset={activeBboxOffset}
                  savedCount={Object.keys(debugDeltaByKey).length}
                  onChangeOffset={handleChangeBboxOffset}
                  onResetOffset={handleResetBboxOffset}
                  onResetAllOffsets={handleResetAllBboxOffsets}
                  onClose={() => setBboxDebugOpen(false)}
                />
              )}
              <div className="flex-1 min-h-0">
                <PngViewer
                  pages={question.pages}
                  targetExamLabel={`${question.sourceExam} (${formatItemNumber(question.originalItemNumber)})`}
                  targetQuestionId={question.id}
                  islandTheme={islandTheme}
                  bboxDebug={bboxDebugOpen}
                  bboxOffset={bboxDebugOpen ? activeBboxOffset : undefined}
                  offsetsByKey={debugDeltaByKey}
                  onActivePageChange={setActivePngPage}
                  onImageDimensionsChange={setImageDims}
                  onSelectDebugQuestion={onSelectQuestion}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Struggling-Student Beginner Hint Sheet Modal */}
      <BeginnerHintModal
        open={beginnerHintOpen}
        onClose={() => setBeginnerHintOpen(false)}
        question={question}
        analysis={currentSentenceAnalysis}
        islandTheme={islandTheme}
      />

      {/* Fox Character + Spectacular Fireworks on Question Complete */}
      <FoxFireworksCelebration
        open={Boolean(foxCelebration)}
        nickname={nickname}
        questionLabel={`#${String(question.globalIndex).padStart(2, '0')} · ${question.sourceExam} (${question.sectionTitle})`}
        earnedStars={foxCelebration?.earnedStars ?? progress.stars}
        xpDelta={foxCelebration?.xpDelta ?? 0}
        currentStreak={currentStreak}
        reducedMotion={reducedMotion}
        hasNextMission={hasNextMission}
        nextQuestionLabel={nextMissionLabel}
        islandTheme={islandTheme}
        unlockedBadges={newlyUnlockedBadgeTitles}
        dailyQuestBonusXp={dailyQuestBonusXp}
        onViewSummary={() => {
          setFoxCelebration(null);
          onClearCelebrationMeta?.();
          handleGuardedStageChange(3);
        }}
        onGoNextMission={() => {
          setFoxCelebration(null);
          onClearCelebrationMeta?.();
          onGoNextMission();
        }}
        onClose={() => {
          setFoxCelebration(null);
          onClearCelebrationMeta?.();
        }}
      />
    </div>
  );
};
