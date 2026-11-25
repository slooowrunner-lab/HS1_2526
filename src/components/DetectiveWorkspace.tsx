import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Columns2,
  FileImage,
  Flame,
  HelpCircle,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { LearningStage, MascotMood, MissionProgress } from '../types/game';
import { STAGE_META } from '../utils/gameStorage';
import { MascotWidget } from './MascotWidget';
import { PngViewer } from './PngViewer';
import { FlowBuilderPanel } from './FlowBuilderPanel';
import { SentenceChunkWorkshop } from './SentenceChunkWorkshop';
import { KeyFocusWordCards } from './KeyFocusWordCards';
import { FoxFireworksCelebration } from './FoxFireworksCelebration';
import { SENTENCE_ANALYSIS_BY_ID } from '../data/sentenceAnalyses';
import {
  getQuestionLabDraft,
  loadSentenceLabStore,
  QuestionLabDraft,
  saveSentenceLabStore,
  SentenceLabStore,
} from '../controllers/SentenceLabStorage';
import discoveryMuseumImg from '../assets/images/discovery_museum_badge_1795522643337.jpg';

interface DetectiveWorkspaceProps {
  question: ExtractedQuestion;
  allQuestions: ExtractedQuestion[];
  progress: MissionProgress;
  totalXp: number;
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
  onOpenReview?: () => void;
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

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const DetectiveWorkspace: React.FC<DetectiveWorkspaceProps> = ({
  question,
  allQuestions,
  progress,
  totalXp,
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
  onOpenReview,
  newlyUnlockedBadgeTitles,
}) => {
  const [splitPngOpen, setSplitPngOpen] = useState(true);
  const [mobileInlinePng, setMobileInlinePng] = useState(false);
  const [pngModalOpen, setPngModalOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

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
    setFoxCelebration(null);
  }, [question.id, progress.bossChoiceIndex, progress.isCorrect, progress.stars]);

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
    const cards: { key: string; kind: string; title: string; detail: string }[] = [];

    (question.footnotes ?? []).forEach((fn, idx) => {
      cards.push({
        key: `fn-${idx}`,
        kind: '각주 어휘',
        title: `* ${fn.term}`,
        detail: fn.meaning,
      });
    });

    (question.underlinedTargets ?? []).forEach((tgt, idx) => {
      cards.push({
        key: `ul-${idx}`,
        kind: '밑줄 · 지시 단서',
        title: tgt,
        detail: '왼쪽 원본 지문에서 문맥상 역할이나 지시 대상을 확인해 보세요.',
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

  const currentSentenceAnalysis = SENTENCE_ANALYSIS_BY_ID[question.id] ?? null;

  // Strict sequential stage locking: Stage 0 -> Stage 1 -> Stage 2 -> Stage 3
  const isStage0Done = progress.discoveredClues.length >= clueCards.length;
  const isStage1Done =
    question.structureOutline.length >= 3
      ? progress.storyChecked
      : progress.guessChoiceIndex !== null &&
        Boolean(guessOptions[progress.guessChoiceIndex]?.isReal);
  const isStage2Done = progress.completed || Boolean(bossFeedback?.isCorrect);

  const maxUnlockedStage: LearningStage = !isStage0Done
    ? 0
    : !isStage1Done
      ? 1
      : !isStage2Done
        ? 2
        : 3;

  const stage = Math.min(progress.currentStage, maxUnlockedStage) as LearningStage;
  const stageInfo = STAGE_META[stage];

  const handleGuardedStageChange = (targetStage: LearningStage) => {
    if (targetStage > maxUnlockedStage) return;
    onStageChange(targetStage);
  };

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

  const renderChartAndTable = () => (
    <>
      {question.chart && (
        <div
          className={`rounded-2xl border-2 p-4 space-y-3 ${
            isLavender
              ? 'border-[#89B3E8] bg-[#EAF3FD]/65'
              : 'border-[#A9DDF5] bg-[#A9DDF5]/15'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#2D2620]">
              도표 자료 · {question.chart.title}
            </h3>
            {question.chart.subtitle && (
              <span className="text-xs text-[#5C4D42]">
                {question.chart.subtitle}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {question.chart.data.map((row) => (
              <div key={row.label} className="grid grid-cols-12 items-center gap-2.5">
                <div
                  className="col-span-5 text-xs font-medium text-[#2D2620] truncate"
                  title={row.label}
                >
                  {row.label}
                </div>
                <div className={`col-span-5 h-2.5 bg-white rounded-full overflow-hidden border ${isLavender ? 'border-[#C9C2E8]' : 'border-[#EAE0D0]'}`}>
                  <div
                    className={`h-full rounded-full ${isLavender ? 'bg-[#7963A8]' : 'bg-[#9BCB83]'}`}
                    style={{ width: `${(row.value / maxChartVal) * 100}%` }}
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-xs font-bold text-[#2D2620] tabular-nums">
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
            isLavender ? 'border-[#9BBCEB]' : 'border-[#A8DCC8]'
          }`}
        >
          <div
            className={`px-4 py-2 border-b text-xs font-extrabold ${
              isLavender
                ? 'bg-[#EAF3FD] border-[#C9D2F0] text-[#1D2D5E]'
                : 'bg-[#A8DCC8]/25 border-[#EAE0D0] text-[#2D2620]'
            }`}
          >
            안내문 · 표 자료
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={`border-b ${
                    isLavender
                      ? 'bg-[#F4F3FC] border-[#D7D4EE] text-[#454278]'
                      : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
                  }`}
                >
                  {question.table.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isLavender ? 'divide-[#ECEAF8]' : 'divide-[#F2ECE1]'}`}>
                {question.table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-[#2D2620] tabular-nums">
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

  const showSplitPane = splitPngOpen && (stage === 0 || stage === 1 || stage === 2);

  return (
    <div className="space-y-5">
      {/* Top Progress Strip */}
      <div
        className={`clay-card rounded-2xl p-4 space-y-3.5 ${
          isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackToMap}
              className={`clay-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                isLavender
                  ? 'bg-[#EEF3FD] text-[#1D2D5E]'
                  : 'bg-[#FFF9EF] text-[#2D2620]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>지도로</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm min-w-0">
              <span
                className={`font-mono font-bold tabular-nums ${
                  isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'
                }`}
              >
                #{String(question.globalIndex).padStart(2, '0')}
              </span>
              <span className={isLavender ? 'text-[#B5B2DC]' : 'text-[#C8B9A6]'} aria-hidden="true">
                ·
              </span>
              <span className={`font-extrabold truncate ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {question.sourceExam}
              </span>
              <span className={isLavender ? 'text-[#B5B2DC]' : 'text-[#C8B9A6]'} aria-hidden="true">
                ·
              </span>
              <span className={`font-semibold hidden sm:inline ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}>
                {question.sectionTitle}
              </span>
              <span className={`font-mono text-xs tabular-nums ${isLavender ? 'text-[#5B588C]' : 'text-[#6E5E52]'}`}>
                ({question.pages.map((p) => `${p}p`).join('–')} · {question.points}점)
              </span>
              {isLavender && (
                <span className="px-2 py-0.5 rounded-lg bg-[#E7E0FA] border border-[#9B85D1]/60 text-[11px] font-extrabold text-[#3F297A]">
                  라벤더 섬
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(stage === 0 || stage === 1 || stage === 2) && (
              <button
                type="button"
                onClick={() => setSplitPngOpen((v) => !v)}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  splitPngOpen
                    ? 'bg-[#A9DDF5]/45 border-[#5D9EC0] text-[#1D4861]'
                    : isLavender
                      ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#4C497A]'
                      : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>{splitPngOpen ? '시험지 나란히 보기' : '시험지 펼치기'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPngModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A9DDF5]/40 border border-[#72B8DB] text-xs font-bold text-[#1D4861] hover:bg-[#A9DDF5]/65 transition-colors whitespace-nowrap cursor-pointer lg:hidden"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>원본 시험지 크게 보기</span>
            </button>

            {currentStreak >= 1 && (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#F39A83]/25 border border-[#D1684E] text-xs font-extrabold text-[#7A2D1C] font-mono tabular-nums inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#C25D44]" />
                <span>{currentStreak}연속</span>
              </div>
            )}

            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold font-mono tabular-nums ${
                isLavender
                  ? 'bg-[#F2F0FC] border-[#C9B9E8] text-[#231947]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620]'
              }`}
            >
              {totalXp} XP
            </div>
          </div>
        </div>

        {/* Responsive 4-Stage Stepper (strictly locked until previous stage is completed) */}
        <div className="flex sm:grid sm:grid-cols-4 gap-2 overflow-x-auto pb-0.5">
          {STAGE_META.map((st) => {
            const isCurrent = st.index === stage;
            const isUnlocked = st.index <= maxUnlockedStage;
            const isStepCompleted =
              (st.index === 0 && isStage0Done) ||
              (st.index === 1 && isStage1Done) ||
              (st.index === 2 && isStage2Done) ||
              (st.index === 3 && isStage2Done);
            return (
              <button
                key={st.code}
                type="button"
                disabled={!isUnlocked}
                onClick={() => handleGuardedStageChange(st.index)}
                title={
                  isUnlocked
                    ? `${st.titleKo} 단계로 이동`
                    : '이전 단계를 완료하면 열려요'
                }
                className={`min-w-[116px] sm:min-w-0 text-left px-3 py-2 rounded-xl border-2 transition-all shrink-0 ${
                  !isUnlocked
                    ? isLavender
                      ? 'bg-[#ECEAF6] border-[#D2CEE6] text-[#7A7799] opacity-75 cursor-not-allowed'
                      : 'bg-[#F3EDE3] border-[#E2D8C8] text-[#9B8B7C] opacity-75 cursor-not-allowed'
                    : isCurrent
                      ? isLavender
                        ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#201442] cursor-pointer'
                        : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620] cursor-pointer'
                      : isStepCompleted
                        ? isLavender
                          ? 'bg-[#A9DDF5]/50 border-[#4A80C2] text-[#13365E] cursor-pointer'
                          : 'bg-[#9BCB83]/30 border-[#9BCB83] text-[#264218] cursor-pointer'
                        : isLavender
                          ? 'bg-[#F5F7FF] border-[#CED6F2] text-[#454E78] hover:border-[#6A52A3] cursor-pointer'
                          : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#7D6E61] hover:border-[#9B785D] cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] sm:text-xs font-extrabold tabular-nums">
                    0{st.index + 1} · {st.titleKo}
                  </span>
                  {!isUnlocked ? (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${isLavender ? 'text-[#7A7799]' : 'text-[#9B8B7C]'}`} />
                  ) : (
                    isStepCompleted &&
                    !isCurrent && (
                      <Check className={`w-3.5 h-3.5 shrink-0 ${isLavender ? 'text-[#2C5B9E]' : 'text-[#4C7A34]'}`} />
                    )
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {showSplitPane && (
          <div className="hidden lg:block lg:col-span-6 h-[680px] sticky top-20">
            <PngViewer
              pages={question.pages}
              targetExamLabel={`${question.sourceExam} (${question.originalItemNumber}번)`}
            />
          </div>
        )}

        <section
          className={`${
            showSplitPane ? 'lg:col-span-6' : 'lg:col-span-8'
          } clay-card rounded-3xl p-5 sm:p-7 space-y-5 ${
            isLavender ? '!bg-[#FCFBFF] !border-[#C6BEE8]' : ''
          }`}
        >
          <div
            className={`flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b-2 ${
              isLavender ? 'border-[#E5E2F5]' : 'border-[#F2ECE1]'
            }`}
          >
            <div>
              <div className={`text-xs font-bold ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                {stageInfo.code} / 4단계
              </div>
              <h1 className={`text-lg sm:text-xl font-extrabold mt-0.5 ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {stageInfo.titleKo}
              </h1>
              <p className={`text-xs mt-0.5 ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>{stageInfo.subtitleKo}</p>
            </div>
            <span className={`text-xs font-bold tabular-nums ${isLavender ? 'text-[#3F538C]' : 'text-[#5C4D42]'}`}>
              {FORMAT_KO[question.format]}
            </span>
          </div>

          {/* Mobile/Tablet Inline Collapsible Original Passage */}
          {(stage === 0 || stage === 1 || stage === 2) && (
            <div className="lg:hidden rounded-2xl border-2 border-[#A9DDF5] bg-[#A9DDF5]/15 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => setMobileInlinePng((v) => !v)}
                  className="flex-1 text-left text-xs font-extrabold text-[#1D4861] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileImage className="w-4 h-4 shrink-0" />
                  <span>
                    {mobileInlinePng
                      ? '원본 시험지 접기'
                      : `원본 시험지 펼쳐보기 (${question.pages.map((p) => `${p}p`).join('–')})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPngModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#72B8DB] text-[11px] font-bold text-[#1D4861] cursor-pointer"
                >
                  전체 화면
                </button>
              </div>
              {mobileInlinePng && (
                <div className="h-[380px] p-2 pt-0">
                  <PngViewer
                    pages={question.pages}
                    targetExamLabel={`${question.sourceExam} (${question.originalItemNumber}번)`}
                  />
                </div>
              )}
            </div>
          )}

          {/* STAGE 0: 단서 모으기 */}
          {stage === 0 && (
            <div className="space-y-5">
              <div
                className={`border-2 rounded-2xl p-4 sm:p-5 space-y-2 ${
                  isLavender
                    ? 'bg-[#F3F1FC] border-[#C9B9E8]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0]'
                }`}
              >
                {question.setRangeLabel && (
                  <p className={`text-xs font-bold ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                    {question.setRangeLabel}
                  </p>
                )}
                <h2 className={`text-base sm:text-lg font-bold leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                  {question.prompt}
                </h2>
              </div>

              {renderChartAndTable()}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs sm:text-sm font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                    단서 카드를 눌러 뜻을 확인하세요 (1개당 +5 XP)
                  </span>
                  <span className={`text-xs font-mono font-bold tabular-nums ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                    {progress.discoveredClues.length} / {clueCards.length}
                  </span>
                </div>

                {safeReplayNotice && (
                  <div className="rounded-xl bg-[#EAF5E4] border border-[#4E8336]/50 px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-extrabold text-[#1A390D]">
                    <span>
                      기존 기록(XP · 별 ★{progress.stars} · 노트)을 유지한 채 새 연습을 시작했어요!
                    </span>
                    <button
                      type="button"
                      onClick={() => setSafeReplayNotice(false)}
                      aria-label="안내 닫기"
                      className="text-[#3A6A24] hover:text-[#1A390D] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clueCards.map((clue) => {
                    const isCollected = progress.discoveredClues.includes(clue.key);
                    const isKeyFocusCard = clue.key === 'key-focus';

                    if (isKeyFocusCard && isCollected) {
                      return (
                        <div
                          key={clue.key}
                          className={`sm:col-span-2 text-left p-4 rounded-2xl border-2 space-y-3 ${
                            isLavender
                              ? 'bg-[#EDE8FC] border-[#7963A8]'
                              : 'bg-[#FFE18A]/35 border-[#D4A72C]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`}>
                                {clue.kind}
                              </span>
                              <span className={`text-sm font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                                · {clue.title}
                              </span>
                            </div>
                            <span
                              className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                                isLavender ? 'text-[#3B6FB6]' : 'text-[#4C7A34]'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>개별 단어 카드 열림 (눌러서 체크)</span>
                            </span>
                          </div>

                          <KeyFocusWordCards
                            keyFocus={clue.detail}
                            analysis={currentSentenceAnalysis}
                            footnotes={question.footnotes}
                            interactive
                            islandTheme={islandTheme}
                          />
                        </div>
                      );
                    }

                    return (
                      <button
                        key={clue.key}
                        type="button"
                        onClick={() => onCollectClue(clue.key)}
                        className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isKeyFocusCard ? 'sm:col-span-2' : ''
                        } ${
                          isCollected
                            ? isLavender
                              ? 'bg-[#EAE3FA] border-[#7963A8]'
                              : 'bg-[#FFE18A]/35 border-[#D4A72C]'
                            : isLavender
                              ? 'bg-[#F5F7FF] border-[#CDD6F2] hover:border-[#6A52A3]'
                              : 'bg-[#FFF9EF] border-[#EAE0D0] hover:border-[#9B785D]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-bold ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`}>
                            {clue.kind}
                          </span>
                          <span
                            className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                              isCollected
                                ? isLavender
                                  ? 'text-[#3B6FB6]'
                                  : 'text-[#4C7A34]'
                                : isLavender
                                  ? 'text-[#5B48A3]'
                                  : 'text-[#9B785D]'
                            }`}
                          >
                            {isCollected ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>확인 완료</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-3.5 h-3.5" />
                                <span>눌러서 보기</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className={`text-sm font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                          {clue.title}
                        </div>
                        <p className={`text-xs leading-relaxed ${isLavender ? 'text-[#3F3E6E]' : 'text-[#4B3F35]'}`}>
                          {isCollected
                            ? clue.detail
                            : isKeyFocusCard
                              ? '누르면 핵심 단어와 표현이 개별 카드로 펼쳐져요!'
                              : '카드를 누르면 뜻과 포인트가 열려요'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isStage0Done ? (
                <div
                  className={`rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-3 ${
                    isLavender
                      ? 'bg-[#E6EEFD] border-[#4C78C4]'
                      : 'bg-[#9BCB83]/20 border-[#5D8A43]'
                  }`}
                >
                  <div className={`text-xs sm:text-sm font-extrabold ${isLavender ? 'text-[#152D5C]' : 'text-[#1A3110]'}`}>
                    단서를 모두 모았어요! 이제 2단계 ‘글 흐름 보기’로 이동할 수 있어요.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGuardedStageChange(1)}
                    className={`clay-btn px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                      isLavender
                        ? 'bg-[#C9B9E8] text-[#211442]'
                        : 'bg-[#A8DCC8] text-[#163B2D]'
                    }`}
                  >
                    <span>2단계: 글 흐름 보기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
                    isLavender
                      ? 'bg-[#EFEBF9] border-[#9B85D1] text-[#3C286E]'
                      : 'bg-[#FFF6DA]/70 border-[#E0B94B] text-[#6E4D00]'
                  }`}
                >
                  위 단서 카드 {clueCards.length - progress.discoveredClues.length}개를 더 열어 확인하면 다음 단계(글 흐름 보기)가 열려요!
                </div>
              )}
            </div>
          )}

          {/* STAGE 1: 글 흐름 보기 + 초보자 문장 의미 단위 해석 */}
          {stage === 1 && (
            <div className="space-y-6">
              <FlowBuilderPanel
                question={question}
                progress={progress}
                draft={currentLabDraft}
                guessOptions={guessOptions}
                onUpdateDraft={updateCurrentLabDraft}
                onCompleteStoryBuild={onCompleteStoryBuild}
                onRecordGuess={onRecordGuess}
                onGoToBoss={() => handleGuardedStageChange(2)}
                islandTheme={islandTheme}
              />

              {currentSentenceAnalysis && (
                <SentenceChunkWorkshop
                  analysis={currentSentenceAnalysis}
                  draft={currentLabDraft}
                  onUpdateDraft={updateCurrentLabDraft}
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

          {/* STAGE 2: BOSS CHALLENGE */}
          {stage === 2 && (
            <div className="space-y-5">
              {/* Optional 90s Practice Timer Bar */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-2.5 ${
                  isLavender
                    ? 'bg-[#F3F1FC] border-[#C9B9E8]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0]'
                }`}
              >
                <div className={`flex items-center gap-2 text-xs font-bold ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}>
                  <Clock className={`w-4 h-4 ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`} />
                  <span>실전 집중 타이머</span>
                  <span
                    className={`font-mono text-sm font-extrabold tabular-nums ${
                      secondsLeft <= 15 && timerActive
                        ? 'text-[#C25D44]'
                        : isLavender
                          ? 'text-[#1D1B42]'
                          : 'text-[#2D2620]'
                    }`}
                  >
                    {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                    {String(secondsLeft % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (secondsLeft === 0) setSecondsLeft(90);
                      setTimerActive((v) => !v);
                    }}
                    className={`px-2.5 py-1 rounded-lg bg-white border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      isLavender
                        ? 'border-[#C9C2E8] text-[#1D1B42] hover:border-[#6A52A3]'
                        : 'border-[#EAE0D0] text-[#2D2620] hover:border-[#9B785D]'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    <span>{timerActive ? '일시정지' : '시작'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerActive(false);
                      setSecondsLeft(90);
                    }}
                    className={`px-2.5 py-1 rounded-lg bg-white border text-xs font-bold cursor-pointer ${
                      isLavender
                        ? 'border-[#C9C2E8] text-[#524F80] hover:text-[#1D1B42]'
                        : 'border-[#EAE0D0] text-[#6E5E52] hover:text-[#2D2620]'
                    }`}
                  >
                    타이머 리셋
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSafeRestartMission(2)}
                    title="기존 XP, 별, 배지 기록은 그대로 두고 보기 선택만 새로 시작합니다"
                    className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                      isLavender
                        ? 'bg-[#D7ECFC]/70 border-[#4A80C2] text-[#13355C] hover:bg-[#D7ECFC]'
                        : 'bg-[#A8DCC8]/35 border-[#4D9479] text-[#163B2D] hover:bg-[#A8DCC8]/60'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>기록 유지 · 다시 풀기</span>
                  </button>
                </div>
              </div>

              <div
                className={`rounded-2xl bg-white border-2 p-4 sm:p-5 space-y-4 ${
                  isLavender ? 'border-[#C6BEE8]' : 'border-[#EAE0D0]'
                }`}
              >
                {question.setRangeLabel && (
                  <p className={`text-xs font-bold ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                    {question.setRangeLabel}
                  </p>
                )}
                <h2 className={`text-base sm:text-lg font-bold leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                  {question.prompt}
                </h2>

                {renderChartAndTable()}

                {question.underlinedTargets && question.underlinedTargets.length > 0 && (
                  <div className={`pt-3 border-t ${isLavender ? 'border-[#E5E2F5]' : 'border-[#F2ECE1]'}`}>
                    <div className={`text-xs font-bold mb-1 ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>
                      밑줄 / 보기 대상
                    </div>
                    <div className={`flex flex-wrap gap-3 text-xs sm:text-sm font-mono ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                      {question.underlinedTargets.map((t, i) => (
                        <span
                          key={i}
                          className={`underline underline-offset-4 ${
                            isLavender ? 'decoration-[#6A52A3]' : 'decoration-[#9B785D]'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {question.footnotes && question.footnotes.length > 0 && (
                  <div
                    className={`pt-3 border-t flex flex-wrap gap-x-4 gap-y-1 text-xs ${
                      isLavender
                        ? 'border-[#E5E2F5] text-[#49467A]'
                        : 'border-[#F2ECE1] text-[#5C4D42]'
                    }`}
                  >
                    {question.footnotes.map((fn) => (
                      <span key={fn.term}>
                        <strong className={`font-mono ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                          *{fn.term}
                        </strong>
                        : {fn.meaning}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                {question.choices.map((choice, idx) => {
                  const choiceNum = idx + 1;
                  const isSelected = selectedBossChoice === choiceNum;
                  const isCorrectChoice = question.answerIndex === choiceNum;
                  const showResult = bossFeedback?.submitted;

                  let style = isLavender
                    ? 'bg-white border-[#D3D1EC] hover:border-[#6A52A3] text-[#1D1B42]'
                    : 'bg-white border-[#EAE0D0] hover:border-[#9B785D] text-[#2D2620]';
                  if (showResult && bossFeedback.isCorrect && isCorrectChoice) {
                    style =
                      'bg-[#9BCB83]/25 border-[#5D8A43] text-[#1A3110] font-bold';
                  } else if (showResult && isSelected && !isCorrectChoice) {
                    style = 'bg-[#F39A83]/25 border-[#D1684E] text-[#4A1E13]';
                  } else if (isSelected) {
                    style = isLavender
                      ? 'bg-[#E5DFFA] border-[#6A52A3] text-[#1E1442] ring-2 ring-[#A9DDF5] font-semibold'
                      : 'bg-[#FFE18A]/45 border-[#C9961A] text-[#2D2620] ring-2 ring-[#FFE18A] font-semibold';
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
                      className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 cursor-pointer min-h-[48px] ${style}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`font-mono text-base font-bold shrink-0 ${
                            isLavender ? 'text-[#5D4C9E]' : 'text-[#9B785D]'
                          }`}
                        >
                          {CIRCLED[idx] ?? `${choiceNum}.`}
                        </span>
                        <span className="text-sm sm:text-base leading-relaxed">
                          {choice}
                        </span>
                      </div>

                      {showResult && bossFeedback.isCorrect && isCorrectChoice && (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#4C7A34] shrink-0 mt-1">
                          <Check className="w-4 h-4" />
                          정답
                        </span>
                      )}
                      {showResult && isSelected && !isCorrectChoice && (
                        <span className="text-xs font-extrabold text-[#C25D44] shrink-0 mt-1">
                          다시 확인
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPngModalOpen(true)}
                  className="text-xs font-bold text-[#5C4D42] hover:text-[#2D2620] inline-flex items-center gap-1.5 cursor-pointer lg:hidden"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>원본 시험지 크게 보기</span>
                </button>

                <button
                  type="button"
                  disabled={selectedBossChoice === null}
                  onClick={handleBossSubmit}
                  className={`clay-btn ml-auto px-6 py-3 rounded-2xl font-extrabold text-sm sm:text-base disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                    isLavender
                      ? 'bg-[#C9B9E8] text-[#211442]'
                      : 'bg-[#F39A83] text-[#2D2620]'
                  }`}
                >
                  {selectedBossChoice === null
                    ? '보기 ①~⑤ 중 하나를 먼저 눌러주세요'
                    : `${selectedBossChoice}번으로 정답 확인하기`}
                </button>
              </div>

              {bossFeedback?.submitted && (
                <div
                  className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3.5 ${
                    bossFeedback.isCorrect
                      ? 'bg-[#9BCB83]/20 border-[#5D8A43]'
                      : 'bg-[#F39A83]/20 border-[#D1684E]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-extrabold text-[#2D2620]">
                      {bossFeedback.isCorrect ? (
                        <>
                          <Star className="w-5 h-5 text-[#9B6B00] fill-[#FFE18A] animate-star-pop" />
                          <span>
                            정답입니다! ({CIRCLED[question.answerIndex - 1]})
                            {bossFeedback.xpDelta > 0
                              ? ` +${bossFeedback.xpDelta} XP`
                              : ''}
                          </span>
                          {bossFeedback.perfectBonus && (
                            <span className="text-xs font-extrabold text-[#4C7A34]">
                              · 한 번에 정답!
                            </span>
                          )}
                          {bossFeedback.comboBonus > 0 && (
                            <span className="text-xs font-extrabold text-[#C25D44]">
                              · 콤보 보너스 +{bossFeedback.comboBonus} XP
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-5 h-5 text-[#C25D44]" />
                          <span>좋은 흐름이었어! 아래 힌트를 보고 다른 보기를 눌러보자</span>
                        </>
                      )}
                    </div>

                    {bossFeedback.isCorrect && (
                      <div className="inline-flex items-center gap-1 bg-white/85 px-2.5 py-1 rounded-xl border border-[#5D8A43]/40">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= bossFeedback.earnedStars
                                ? 'text-[#B47A00] fill-[#FFE18A]'
                                : 'text-[#D6C8B4]'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {bossFeedback.isCorrect ? (
                    <>
                      <p className="text-sm text-[#2D2620] leading-relaxed">
                        {question.answerNote}
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {hasNextMission ? (
                          <button
                            type="button"
                            onClick={onGoNextMission}
                            className={`clay-btn px-5 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                              isLavender
                                ? 'bg-[#A9DDF5] text-[#133554]'
                                : 'bg-[#A8DCC8] text-[#163B2D]'
                            }`}
                          >
                            <span>다음 문제 바로 풀기</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGuardedStageChange(3)}
                            className={`clay-btn px-5 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                              isLavender
                                ? 'bg-[#A9DDF5] text-[#133554]'
                                : 'bg-[#A8DCC8] text-[#163B2D]'
                            }`}
                          >
                            <span>최종 결과 · 노트 보기</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleGuardedStageChange(3)}
                          className={`px-4 py-2.5 rounded-xl bg-white border-2 text-xs sm:text-sm font-bold cursor-pointer ${
                            isLavender
                              ? 'border-[#C9C2E8] text-[#1D1B42] hover:border-[#6A52A3]'
                              : 'border-[#EAE0D0] text-[#2D2620] hover:border-[#9B785D]'
                          }`}
                        >
                          별 등급 · 메모 남기기
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-white/85 border border-[#F39A83] p-3 text-xs sm:text-sm text-[#4A1E13] space-y-1.5">
                      <div className="font-extrabold">탐정 힌트:</div>
                      <p>{question.keyFocus}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: MY DISCOVERY (with 3-Star Rating & 0.5s XP Count-up) */}
          {stage === 3 && (
            <div className="space-y-5">
              <div
                className={`rounded-3xl border-2 p-5 flex flex-col sm:flex-row items-center gap-5 ${
                  isLavender
                    ? 'border-[#C9B9E8] bg-[#F3F1FC]'
                    : 'border-[#EAE0D0] bg-[#FFF9EF]'
                }`}
              >
                <div
                  className={`w-36 h-28 rounded-2xl overflow-hidden border-2 bg-white shrink-0 flex items-center justify-center ${
                    isLavender ? 'border-[#C9B9E8]' : 'border-[#EAE0D0]'
                  }`}
                >
                  {museumImgError ? (
                    <Award className={`w-10 h-10 ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`} />
                  ) : (
                    <img
                      src={discoveryMuseumImg}
                      alt="탐정 발견 기록 수첩"
                      onError={() => setMuseumImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${isLavender ? 'text-[#4B3B94]' : 'text-[#4C7A34]'}`}>
                    <Sparkles className="w-4 h-4" />
                    <span>탐험 발견 노트에 기록됨!</span>
                  </div>
                  <h2 className={`text-lg sm:text-xl font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                    {question.sourceExam} · {question.sectionTitle} 클리어!
                  </h2>

                  {/* 3-Star Mastery Display */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                    <div className="inline-flex items-center gap-1">
                      {[1, 2, 3].map((s) => {
                        const earned = s <= progress.stars;
                        return (
                          <Star
                            key={s}
                            style={{ animationDelay: `${(s - 1) * 110}ms` }}
                            className={`w-6 h-6 ${
                              earned
                                ? 'text-[#B47A00] fill-[#FFE18A] animate-star-pop'
                                : 'text-[#D6C8B4]'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className={`text-xs font-bold ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}>
                      {progress.stars === 3
                        ? '★3 완벽 마스터!'
                        : progress.stars === 2
                          ? '★2 우수! 단서 전부 모으고 원샷 도전 시 ★3'
                          : progress.stars === 1
                            ? '★1 클리어! 단서 채집하면 별이 올라가요'
                            : '실전 도전 완료 시 별 등급 획득'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-2xl border-2 p-3.5 ${isLavender ? 'border-[#C6BEE8] bg-[#FAF9FF]' : 'border-[#EAE0D0] bg-white'}`}>
                  <div className={`text-[11px] font-bold ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>획득 XP</div>
                  <div className={`text-xl font-extrabold font-mono tabular-nums mt-0.5 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#4C7A34]'}`}>
                    +{displayXpCount}
                  </div>
                </div>
                <div className={`rounded-2xl border-2 p-3.5 ${isLavender ? 'border-[#C6BEE8] bg-[#FAF9FF]' : 'border-[#EAE0D0] bg-white'}`}>
                  <div className={`text-[11px] font-bold ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>채집 단서</div>
                  <div className={`text-xl font-extrabold font-mono tabular-nums mt-0.5 ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                    {progress.discoveredClues.length}/{clueCards.length}
                  </div>
                </div>
                <div className={`rounded-2xl border-2 p-3.5 ${isLavender ? 'border-[#C6BEE8] bg-[#FAF9FF]' : 'border-[#EAE0D0] bg-white'}`}>
                  <div className={`text-[11px] font-bold ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>정답</div>
                  <div className={`text-xl font-extrabold font-mono tabular-nums mt-0.5 ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                    {CIRCLED[question.answerIndex - 1]}
                  </div>
                </div>
              </div>

              {newlyUnlockedBadgeTitles.length > 0 && (
                <div
                  className={`rounded-2xl border-2 p-4 ${
                    isLavender
                      ? 'bg-[#E7E0FA] border-[#7963A8]'
                      : 'bg-[#FFE18A]/45 border-[#D4A72C]'
                  }`}
                >
                  <div className={`text-xs font-extrabold mb-1 ${isLavender ? 'text-[#3F297A]' : 'text-[#7B5600]'}`}>
                    새로 획득한 배지!
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newlyUnlockedBadgeTitles.map((title) => (
                      <span
                        key={title}
                        className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#2D2620]"
                      >
                        <Award className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#B47A00]'}`} />
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`rounded-2xl border-2 p-4 space-y-2 ${
                  isLavender
                    ? 'bg-[#F3F1FC] border-[#C9B9E8]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`quest-note-${question.id}`}
                    className={`text-xs font-bold ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}
                  >
                    내 오답 · 해석 노트 (자동 저장)
                  </label>
                  {customTranscript && (
                    <button
                      type="button"
                      onClick={() => onUpdateTranscript(question.id, '')}
                      className={`text-xs font-semibold hover:underline cursor-pointer ${
                        isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'
                      }`}
                    >
                      지우기
                    </button>
                  )}
                </div>
                <textarea
                  id={`quest-note-${question.id}`}
                  rows={2}
                  value={customTranscript}
                  onChange={(e) => onUpdateTranscript(question.id, e.target.value)}
                  placeholder="내가 헷갈렸던 단어나 핵심 문장 해석을 자유롭게 적어두세요."
                  className={`w-full px-3.5 py-2.5 text-sm bg-white border-2 rounded-xl focus:outline-none ${
                    isLavender
                      ? 'text-[#1D1B42] border-[#C9C2E8] focus:border-[#6A52A3]'
                      : 'text-[#2D2620] border-[#EAE0D0] focus:border-[#9B785D]'
                  }`}
                />
              </div>

              <div className="rounded-2xl border-2 border-[#9BCB83] bg-[#9BCB83]/15 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#264218]">
                  <CheckCircle2 className="w-4 h-4 text-[#4C7A34]" />
                  <span>정답 해설 ({CIRCLED[question.answerIndex - 1]})</span>
                </div>
                <p className="text-xs sm:text-sm text-[#2D2620] leading-relaxed">
                  {question.answerNote}
                </p>
              </div>

              <div
                className={`rounded-2xl border-2 p-4 space-y-2 ${
                  isLavender
                    ? 'border-[#B4C7EE] bg-[#F5F8FF]'
                    : 'border-[#EAE0D0] bg-white'
                }`}
              >
                <div className={`flex items-center gap-2 text-xs font-extrabold ${isLavender ? 'text-[#1D2D5E]' : 'text-[#2D2620]'}`}>
                  <BookOpen className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`} />
                  <span>오늘의 독해 전략 요약</span>
                </div>
                <p className={`text-xs sm:text-sm leading-relaxed ${isLavender ? 'text-[#2F3361]' : 'text-[#4B3F35]'}`}>
                  {question.keyFocus}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onBackToMap}
                    className={`clay-btn px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer ${
                      isLavender
                        ? 'bg-[#EEF3FD] text-[#1D2D5E]'
                        : 'bg-[#FFF9EF] text-[#2D2620]'
                    }`}
                  >
                    탐험 지도로
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGuardedStageChange(2)}
                    className={`px-4 py-2.5 rounded-2xl border-2 bg-white text-xs sm:text-sm font-bold cursor-pointer ${
                      isLavender
                        ? 'border-[#C9C2E8] text-[#49467A] hover:text-[#1D1B42]'
                        : 'border-[#EAE0D0] text-[#5C4D42] hover:text-[#2D2620]'
                    }`}
                  >
                    문제 다시 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSafeRestartMission(0)}
                    className={`px-4 py-2.5 rounded-2xl border-2 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                      isLavender
                        ? 'border-[#6A52A3] bg-[#DFD6FA]/60 text-[#211442] hover:bg-[#DFD6FA]'
                        : 'border-[#4D9479] bg-[#A8DCC8]/35 text-[#163B2D] hover:bg-[#A8DCC8]/60'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>기록 유지 · 처음부터 다시 풀기</span>
                  </button>
                </div>
                {hasNextMission ? (
                  <button
                    type="button"
                    onClick={onGoNextMission}
                    className={`clay-btn px-6 py-2.5 rounded-2xl text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer ${
                      isLavender
                        ? 'bg-[#A9DDF5] text-[#133554]'
                        : 'bg-[#A8DCC8] text-[#163B2D]'
                    }`}
                  >
                    <span>다음 문제 바로 풀기</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  onOpenReview && (
                    <button
                      type="button"
                      onClick={onOpenReview}
                      className={`clay-btn px-6 py-2.5 rounded-2xl text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer ${
                        isLavender
                          ? 'bg-[#C9B9E8] text-[#211442]'
                          : 'bg-[#FFE18A] text-[#2D2620]'
                      }`}
                    >
                      <span>오답 · 복습 보러 가기</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Bottom Stage Navigation (strictly locked until current stage requirement is met) */}
          {stage < 3 && (
            <div className={`pt-4 border-t-2 space-y-2.5 ${isLavender ? 'border-[#E5E2F5]' : 'border-[#F2ECE1]'}`}>
              {stage >= maxUnlockedStage && (
                <div
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold flex items-center gap-2 ${
                    isLavender
                      ? 'bg-[#EFEBF9] border-[#9B85D1] text-[#3C286E]'
                      : 'bg-[#FFF6DA]/70 border-[#E0B94B] text-[#6E4D00]'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {stage === 0
                      ? `모든 단서 카드(${progress.discoveredClues.length}/${clueCards.length})를 열어야 다음 단계(글 흐름 보기)로 넘어갈 수 있어요.`
                      : stage === 1
                        ? '글 흐름 순서 맞추기 또는 핵심 내용 확인을 완료해야 다음 단계(정답 고르기)로 넘어갈 수 있어요.'
                        : '보기 ①–⑤ 중 정답을 맞혀야 마지막 단계(결과 · 노트)로 넘어갈 수 있어요.'}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={stage === 0}
                  onClick={() => handleGuardedStageChange((stage - 1) as LearningStage)}
                  className={`px-4 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer inline-flex items-center gap-1.5 ${
                    isLavender
                      ? 'border-[#CED6F2] bg-[#F5F6FF] text-[#49467A] hover:border-[#6A52A3]'
                      : 'border-[#EAE0D0] bg-[#FFF9EF] text-[#5C4D42] hover:border-[#9B785D]'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>이전 단계</span>
                </button>

                <button
                  type="button"
                  disabled={stage >= maxUnlockedStage}
                  onClick={() => handleGuardedStageChange((stage + 1) as LearningStage)}
                  className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 ${
                    stage >= maxUnlockedStage
                      ? isLavender
                        ? 'bg-[#ECEAF6] border-2 border-[#D2CEE6] text-[#7A7799] cursor-not-allowed'
                        : 'bg-[#EFE8DB] border-2 border-[#DCD1BF] text-[#9B8B7C] cursor-not-allowed'
                      : isLavender
                        ? 'clay-btn bg-[#A9DDF5] text-[#133554] cursor-pointer'
                        : 'clay-btn bg-[#A8DCC8] text-[#163B2D] cursor-pointer'
                  }`}
                >
                  {stage >= maxUnlockedStage && <Lock className="w-3.5 h-3.5" />}
                  <span>다음 ({STAGE_META[stage + 1].titleKo})</span>
                  {stage < maxUnlockedStage && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside
          className={`${
            showSplitPane
              ? 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'lg:col-span-4 space-y-4'
          }`}
        >
          <MascotWidget
            mood={mascotMood}
            nickname={nickname}
            compact={showSplitPane}
            currentStreak={currentStreak}
            islandTheme={islandTheme}
          />

          <div
            className={`clay-card rounded-2xl p-4 space-y-2.5 ${
              isLavender ? '!bg-[#FAF9FF] !border-[#C6BEE8]' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className={`flex items-center gap-2 text-xs font-extrabold ${isLavender ? 'text-[#5E4AA3]' : 'text-[#9B785D]'}`}>
                <Lightbulb className="w-4 h-4" />
                <span>막히면 보는 탐정 힌트</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono font-bold tabular-nums ${isLavender ? 'text-[#524F80]' : 'text-[#6E5E52]'}`}>
                  단서 {progress.discoveredClues.length}/{clueCards.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowHint((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                    isLavender
                      ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#1D1B42] hover:border-[#6A52A3]'
                      : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620] hover:border-[#9B785D]'
                  }`}
                >
                  {showHint ? '접기' : '힌트 열기'}
                </button>
              </div>
            </div>
            <p className={`text-xs leading-relaxed ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}>
              {stageInfo.detectiveTip}
            </p>
            {showHint && (
              <div
                className={`rounded-xl border p-2.5 text-xs leading-relaxed ${
                  isLavender
                    ? 'bg-[#E8F1FD] border-[#7AAEE3] text-[#162C5E]'
                    : 'bg-[#FFE18A]/35 border-[#E0B94B] text-[#2D2620]'
                }`}
              >
                <span className="font-extrabold inline-flex items-center gap-1 mr-1">
                  <HelpCircle className={`w-3 h-3 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#9B785D]'}`} />
                  핵심 포인트:
                </span>
                {question.keyFocus}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile / Fullscreen Original PNG Modal */}
      {pngModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#2D2620]/50 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl h-[88vh] clay-card rounded-3xl overflow-hidden flex flex-col bg-[#FFF9EF]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-[#EAE0D0] bg-white">
              <div className="text-sm font-extrabold text-[#2D2620]">
                {question.sourceExam} 원본 시험지 ({question.pages.map((p) => `${p}p`).join('–')})
              </div>
              <button
                type="button"
                onClick={() => setPngModalOpen(false)}
                className="p-2 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-[#2D2620] hover:bg-[#F39A83]/20 cursor-pointer"
                aria-label="원본 이미지 창 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <PngViewer
                pages={question.pages}
                targetExamLabel={`${question.sourceExam} (${question.originalItemNumber}번)`}
              />
            </div>
          </div>
        </div>
      )}

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
        onViewSummary={() => {
          setFoxCelebration(null);
          handleGuardedStageChange(3);
        }}
        onGoNextMission={() => {
          setFoxCelebration(null);
          onGoNextMission();
        }}
        onClose={() => setFoxCelebration(null)}
      />
    </div>
  );
};
