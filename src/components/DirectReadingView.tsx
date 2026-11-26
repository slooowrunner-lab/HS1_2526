import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { ExamYear, ExtractedQuestion } from '../types/question';
import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';
import { SENTENCE_ANALYSES } from '../data/sentenceAnalyses';
import { formatItemNumber } from '../utils/gameStorage';
import { isTtsSupported, speakEnglish, stopSpeaking } from '../utils/tts';
import {
  playClueChime,
  playSuccessChime,
  playTryAgainSoft,
} from '../utils/soundEffects';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface DirectReadingViewProps {
  questions: ExtractedQuestion[];
  initialExamYear: ExamYear;
  nickname: string;
  totalXp: number;
  currentStreak: number;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onAwardXp: (xpDelta: number) => void;
  onRecordSentenceAttempt?: (entry: {
    question: ExtractedQuestion;
    isCorrect: boolean;
    durationSec: number;
    chunkCount: number;
    xpDelta: number;
  }) => void;
  onBackToMap: () => void;
}

interface WordTile {
  tileId: string;
  text: string;
  isDistractor: boolean;
}

interface LessonEntry {
  question: ExtractedQuestion;
  analysis: QuestionSentenceAnalysis;
}

type CheckStatus = 'idle' | 'wrong' | 'correct';
type DeckLengthMode = '8' | 'all';

const PRAISE_MESSAGES = [
  '완벽한 직독직해예요!',
  '영어 어순 그대로 정확히 읽었어요!',
  '멋져요! 문장 흐름이 한눈에 들어오네요!',
  '정확해요! 끊어 읽기 감각이 아주 좋아요!',
];

const XP_PER_SENTENCE = 15;

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let seed = hashString(seedStr) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export const DirectReadingView: React.FC<DirectReadingViewProps> = ({
  questions,
  initialExamYear,
  nickname,
  totalXp,
  currentStreak,
  soundEnabled,
  reducedMotion,
  onAwardXp,
  onRecordSentenceAttempt,
  onBackToMap,
}) => {
  const [selectedYear, setSelectedYear] = useState<ExamYear>(initialExamYear);
  const [deckLengthMode, setDeckLengthMode] = useState<DeckLengthMode>('8');
  const [sessionRound, setSessionRound] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [wrongIndices, setWrongIndices] = useState<number[]>([]);
  const [wrongReason, setWrongReason] = useState<string>('');
  const [hasFailedCurrent, setHasFailedCurrent] = useState(false);

  const [firstTryCount, setFirstTryCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [activeSpeechChunkIdx, setActiveSpeechChunkIdx] = useState<number | null>(
    null,
  );
  const [avatarErr, setAvatarErr] = useState(false);
  const sentenceStartedAtRef = useRef<number>(Date.now());

  const analysisMap = useMemo(() => {
    const map = new Map<string, QuestionSentenceAnalysis>();
    SENTENCE_ANALYSES.forEach((item) => {
      map.set(item.questionId, item);
    });
    return map;
  }, []);

  const allDistractorPool = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    SENTENCE_ANALYSES.forEach((analysis) => {
      analysis.chunks.forEach((chunk) => {
        const text = chunk.meaningKo.trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          list.push(text);
        }
      });
    });
    return list;
  }, []);

  const lessonEntries = useMemo<LessonEntry[]>(() => {
    const filtered = questions
      .filter((q) => q.examYear === selectedYear)
      .map((q) => {
        const analysis = analysisMap.get(q.id);
        return analysis ? { question: q, analysis } : null;
      })
      .filter((item): item is LessonEntry => Boolean(item))
      .sort((a, b) => a.question.globalIndex - b.question.globalIndex);

    if (deckLengthMode === 'all') {
      return filtered;
    }
    return filtered.slice(0, 8);
  }, [questions, selectedYear, deckLengthMode, analysisMap]);

  const safeEntry = lessonEntries[currentIndex] ?? lessonEntries[0];
  const totalCount = lessonEntries.length;

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const wordBankTiles = useMemo<WordTile[]>(() => {
    if (!safeEntry) return [];
    const { analysis, question } = safeEntry;
    const realSet = new Set(analysis.chunks.map((c) => c.meaningKo.trim()));

    const realTiles: WordTile[] = analysis.chunks.map((chunk) => ({
      tileId: `real-${chunk.id}`,
      text: chunk.meaningKo,
      isDistractor: false,
    }));

    const candidateDistractors = allDistractorPool.filter(
      (txt) => !realSet.has(txt) && txt.length <= 22,
    );
    const shuffledDistractors = deterministicShuffle(
      candidateDistractors,
      `dist-${question.id}-${sessionRound}`,
    );
    const distractorCount = analysis.chunks.length <= 4 ? 2 : 3;
    const distractorTiles: WordTile[] = shuffledDistractors
      .slice(0, distractorCount)
      .map((text, idx) => ({
        tileId: `dist-${question.id}-${idx}`,
        text,
        isDistractor: true,
      }));

    return deterministicShuffle(
      [...realTiles, ...distractorTiles],
      `bank-${question.id}-${sessionRound}`,
    );
  }, [safeEntry, allDistractorPool, sessionRound]);

  const tileById = useMemo(() => {
    const map = new Map<string, WordTile>();
    wordBankTiles.forEach((tile) => map.set(tile.tileId, tile));
    return map;
  }, [wordBankTiles]);

  const resetCurrentSentence = () => {
    setPlacedTileIds([]);
    setStatus('idle');
    setWrongIndices([]);
    setWrongReason('');
    setHintLevel(0);
    setHasFailedCurrent(false);
    setActiveSpeechChunkIdx(null);
    sentenceStartedAtRef.current = Date.now();
    stopSpeaking();
  };

  const resetSession = (nextYear?: ExamYear, nextMode?: DeckLengthMode) => {
    if (nextYear !== undefined) setSelectedYear(nextYear);
    if (nextMode !== undefined) setDeckLengthMode(nextMode);
    setSessionRound((r) => r + 1);
    setCurrentIndex(0);
    setFirstTryCount(0);
    setCompletedCount(0);
    setSessionXp(0);
    setIsFinished(false);
    resetCurrentSentence();
  };

  const handleSelectTile = (tileId: string) => {
    if (status === 'correct') return;
    if (placedTileIds.includes(tileId)) return;
    playClueChime(soundEnabled);
    setPlacedTileIds((prev) => [...prev, tileId]);
    if (status === 'wrong') {
      setStatus('idle');
      setWrongIndices([]);
      setWrongReason('');
    }
  };

  const handleRemovePlacedTile = (tileId: string) => {
    if (status === 'correct') return;
    setPlacedTileIds((prev) => prev.filter((id) => id !== tileId));
    if (status === 'wrong') {
      setStatus('idle');
      setWrongIndices([]);
      setWrongReason('');
    }
  };

  const handleClearPlaced = () => {
    if (status === 'correct') return;
    setPlacedTileIds([]);
    setStatus('idle');
    setWrongIndices([]);
    setWrongReason('');
  };

  const handleRequestHint = () => {
    if (!safeEntry || status === 'correct') return;
    playClueChime(soundEnabled);
    setHintLevel((lvl) => Math.min(lvl + 1, 2));
  };

  const handleCheckAnswer = () => {
    if (!safeEntry || placedTileIds.length === 0 || status === 'correct') return;
    const expectedChunks = safeEntry.analysis.chunks;
    const placedTiles = placedTileIds
      .map((id) => tileById.get(id))
      .filter((t): t is WordTile => Boolean(t));

    const mismatchPositions: number[] = [];
    let hasDistractor = false;

    placedTiles.forEach((tile, idx) => {
      if (tile.isDistractor) {
        hasDistractor = true;
        mismatchPositions.push(idx);
      } else if (
        idx >= expectedChunks.length ||
        tile.text.trim() !== expectedChunks[idx].meaningKo.trim()
      ) {
        mismatchPositions.push(idx);
      }
    });

    const isExactMatch =
      !hasDistractor &&
      mismatchPositions.length === 0 &&
      placedTiles.length === expectedChunks.length;

    const elapsedSec = Math.max(
      2,
      Math.min(300, Math.round((Date.now() - sentenceStartedAtRef.current) / 1000)),
    );

    if (isExactMatch) {
      playSuccessChime(soundEnabled);
      setStatus('correct');
      setWrongIndices([]);
      setWrongReason('');
      setCompletedCount((c) => c + 1);
      if (!hasFailedCurrent) {
        setFirstTryCount((c) => c + 1);
      }
      setSessionXp((x) => x + XP_PER_SENTENCE);
      onAwardXp(XP_PER_SENTENCE);
      onRecordSentenceAttempt?.({
        question: safeEntry.question,
        isCorrect: true,
        durationSec: elapsedSec,
        chunkCount: expectedChunks.length,
        xpDelta: XP_PER_SENTENCE,
      });
      return;
    }

    // Wrong answer: identify where it went wrong without spoiling the full answer
    playTryAgainSoft(soundEnabled);
    setHasFailedCurrent(true);
    setStatus('wrong');
    setShakeTrigger((n) => n + 1);
    setWrongIndices(mismatchPositions);
    onRecordSentenceAttempt?.({
      question: safeEntry.question,
      isCorrect: false,
      durationSec: elapsedSec,
      chunkCount: expectedChunks.length,
      xpDelta: 0,
    });

    if (hasDistractor) {
      setWrongReason('문장에 포함되지 않는 의미 조각이 섞여 있어요. 빨간 카드를 눌러 빼보세요!');
    } else if (mismatchPositions.length > 0) {
      const firstWrong = mismatchPositions[0] + 1;
      setWrongReason(
        `${firstWrong}번째 의미 조각이 영어 문장의 순서와 달라요. 위 영어 조각을 눌러 순서를 다시 확인해 보세요!`,
      );
    } else if (placedTiles.length < expectedChunks.length) {
      setWrongReason(
        `아직 ${expectedChunks.length - placedTiles.length}개의 의미 조각이 더 필요해요. 뒷부분까지 마저 이어 붙여 주세요!`,
      );
    } else {
      setWrongReason('의미 조각의 순서를 영어 문장 앞부분부터 차근차근 다시 맞춰보세요!');
    }
  };

  const handleNextSentence = () => {
    if (currentIndex + 1 >= totalCount) {
      playSuccessChime(soundEnabled);
      setIsFinished(true);
      stopSpeaking();
      return;
    }
    setCurrentIndex((idx) => idx + 1);
    resetCurrentSentence();
  };

  const handlePlaySentence = (rate = 0.94) => {
    if (!safeEntry || !isTtsSupported()) return;
    setActiveSpeechChunkIdx(null);
    speakEnglish(safeEntry.analysis.sentence, rate);
  };

  const handlePlayChunk = (chunkText: string, idx: number) => {
    setActiveSpeechChunkIdx(idx);
    if (isTtsSupported()) {
      speakEnglish(chunkText, 0.88);
    }
    window.setTimeout(() => {
      setActiveSpeechChunkIdx((curr) => (curr === idx ? null : curr));
    }, 1200);
  };

  // Determine which chunk index should be hinted next (either first wrong/missing position)
  const nextChunkIdxToHint = useMemo(() => {
    if (!safeEntry) return 0;
    const chunks = safeEntry.analysis.chunks;
    for (let i = 0; i < chunks.length; i += 1) {
      const placedId = placedTileIds[i];
      const placed = placedId ? tileById.get(placedId) : undefined;
      if (!placed || placed.text.trim() !== chunks[i].meaningKo.trim()) {
        return i;
      }
    }
    return 0;
  }, [safeEntry, placedTileIds, tileById]);

  if (!safeEntry) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <p className="text-base font-bold text-[#5C4D42]">
          직독직해 문장 데이터를 불러올 수 없어요.
        </p>
        <button
          type="button"
          onClick={onBackToMap}
          className="dq-btn-3d px-5 py-3 rounded-2xl bg-[#1CB0F6] border-2 border-[#1899D6] text-white font-extrabold cursor-pointer"
        >
          지도로 돌아가기
        </button>
      </div>
    );
  }

  const isLavender = selectedYear === '2026';
  const expectedChunks = safeEntry.analysis.chunks;
  const progressPct = isFinished
    ? 100
    : Math.round(
        ((currentIndex + (status === 'correct' ? 1 : 0)) / Math.max(totalCount, 1)) *
          100,
      );

  const hintChunk = expectedChunks[nextChunkIdxToHint];
  const praiseText =
    PRAISE_MESSAGES[currentIndex % PRAISE_MESSAGES.length];

  // F. Completion Summary Screen
  if (isFinished) {
    const accuracyPct =
      totalCount > 0 ? Math.round((firstTryCount / totalCount) * 100) : 100;
    const otherYear: ExamYear = selectedYear === '2025' ? '2026' : '2025';

    return (
      <div className="max-w-xl mx-auto py-6 sm:py-10 px-2 rq-view-enter">
        <div
          className={`clay-card rounded-3xl p-6 sm:p-8 text-center space-y-6 border-2 ${
            isLavender
              ? '!bg-[#FAF9FF] !border-[#C9C2E8]'
              : '!bg-[#FFFDF8] !border-[#EAE0D0]'
          }`}
        >
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-[#FFC800] bg-[#FFF6DA] shadow-md rq-char-celebrating">
                {avatarErr ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-[#C68900]" />
                  </div>
                ) : (
                  <img
                    src={mascotImage}
                    alt="여우 탐정"
                    onError={() => setAvatarErr(true)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <span className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-[#58CC02] border-2 border-white flex items-center justify-center text-white shadow-sm">
                <Trophy className="w-5 h-5" />
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D7FFB8] text-[#1E4600] text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>직독직해 훈련 완료!</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2620]">
              {nickname}님, 대단해요!
            </h1>
            <p className="text-sm font-semibold text-[#5C4D42]">
              {selectedYear === '2025' ? '제1시험지(2025년)' : '제2시험지(2026년)'}{' '}
              {completedCount}문장을 영어 어순 그대로 막힘없이 읽어냈어요.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border-2 border-[#EAE0D0] p-3.5 space-y-1">
              <div className="text-xs font-bold text-[#6E5E52]">전체 문장</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#2D2620] tabular-nums">
                {totalCount}개
              </div>
            </div>
            <div className="rounded-2xl bg-[#EEFFD9] border-2 border-[#A5ED6E] p-3.5 space-y-1">
              <div className="text-xs font-bold text-[#285E00]">한 번에 정답</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1E4600] tabular-nums">
                {firstTryCount}개
              </div>
              <div className="text-[11px] font-bold text-[#46A302] tabular-nums">
                정확도 {accuracyPct}%
              </div>
            </div>
            <div className="rounded-2xl bg-[#FFF6DA] border-2 border-[#FFC800] p-3.5 space-y-1">
              <div className="text-xs font-bold text-[#6B4A00]">획득 XP</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#9B6B00] tabular-nums">
                +{sessionXp}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => resetSession()}
              className="dq-btn-3d w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>다시 학습하기</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => resetSession(otherYear)}
                className="dq-btn-3d min-h-[48px] px-4 py-2.5 rounded-2xl bg-white border-2 border-[#D4D1EC] text-[#2D2620] text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#1CB0F6]"
              >
                <Sparkles className="w-4 h-4 text-[#1CB0F6]" />
                <span>
                  {otherYear === '2025' ? '제1시험지(2025)' : '제2시험지(2026)'} 풀기
                </span>
              </button>

              <button
                type="button"
                onClick={onBackToMap}
                className="dq-btn-3d min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FFF6DA] border-2 border-[#D4A72C] text-[#4B3200] text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>지도로 돌아가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto min-h-[calc(100vh-2.5rem)] flex flex-col justify-between gap-5 pb-4">
      {/* ① 상단 학습 진행 영역 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onBackToMap();
            }}
            aria-label="직독직해 학습 종료하고 돌아가기"
            title="지도로 돌아가기"
            className="dq-btn-3d w-11 h-11 rounded-2xl bg-white border-2 border-[#E5E5E5] text-[#6E5E52] hover:text-[#2D2620] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Horizontal Progress Bar */}
          <div className="flex-1 h-4 bg-[#E5E5E5] rounded-full overflow-hidden relative shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
                isLavender ? 'bg-[#7963A8]' : 'bg-[#58CC02]'
              }`}
              style={{ width: `${Math.max(progressPct, 4)}%` }}
            >
              <div className="absolute inset-x-2 top-0.5 h-1 rounded-full bg-white/35" />
              {!reducedMotion && (
                <div
                  aria-hidden="true"
                  className="rq-progress-glint absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm font-extrabold text-[#5C4D42] font-mono tabular-nums bg-white border-2 border-[#EAE0D0] rounded-xl px-2.5 py-1.5">
              {currentIndex + 1} / {totalCount}
            </span>
            {currentStreak >= 1 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-[#B25E00] bg-[#FFF2DF] border-2 border-[#FF9600] rounded-xl px-2.5 py-1.5 tabular-nums">
                <Flame className="w-3.5 h-3.5 text-[#FF9600] fill-[#FF9600]" />
                {currentStreak}
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-[#58A700] bg-[#EEFFD9] border-2 border-[#A5ED6E] rounded-xl px-2.5 py-1.5 font-mono tabular-nums">
              {totalXp} XP
            </span>
          </div>
        </div>

        {/* Compact Exam & Set Switcher Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5">
            {(['2025', '2026'] as const).map((yr) => {
              const active = selectedYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    if (yr !== selectedYear) resetSession(yr);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-extrabold border-2 transition-colors cursor-pointer ${
                    active
                      ? yr === '2026'
                        ? 'bg-[#EAE3FA] border-[#6A52A3] text-[#211442]'
                        : 'bg-[#FFF6DA] border-[#D4A72C] text-[#4B3200]'
                      : 'bg-white border-[#EAE0D0] text-[#6E5E52] hover:text-[#2D2620]'
                  }`}
                >
                  {yr === '2025' ? '제1시험지 (2025)' : '제2시험지 (2026)'}
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#7D6E61] px-2">
              {formatItemNumber(safeEntry.question.originalItemNumber)} ·{' '}
              {safeEntry.question.sectionTitle}
            </span>
            <button
              type="button"
              onClick={() =>
                resetSession(undefined, deckLengthMode === '8' ? 'all' : '8')
              }
              className="min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold bg-white border-2 border-[#EAE0D0] text-[#5C4D42] hover:border-[#1CB0F6] cursor-pointer"
            >
              {deckLengthMode === '8' ? '전체 28문장 풀기' : '핵심 8문장'}
            </button>
          </div>
        </div>
      </div>

      {/* ② 문제 제시 영역 + ③ 직독직해 답안 작성 영역 + ④ 단어 조각 선택 영역 */}
      <div
        key={`${safeEntry.question.id}-${sessionRound}`}
        className={`flex-1 flex flex-col justify-center gap-6 sm:gap-7 ${
          !reducedMotion ? 'rq-view-enter' : ''
        }`}
      >
        {/* Instruction Title */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#2D2620] tracking-tight">
            영어 순서대로 직독직해해 보세요
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#6E5E52]">
            영어 문장의 앞부분부터 의미 조각을 차례대로 골라보세요.
          </p>
        </div>

        {/* Mascot + Speech Bubble */}
        <div className="flex items-start gap-3.5 sm:gap-5">
          <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden border-3 bg-[#FFF6DA] shadow-sm ${
                status === 'correct'
                  ? 'border-[#58CC02] rq-char-celebrating'
                  : 'border-[#D4A72C] rq-fox-bob'
              }`}
            >
              {avatarErr ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#9B785D]" />
                </div>
              ) : (
                <img
                  src={mascotImage}
                  alt="여우 탐정"
                  onError={() => setAvatarErr(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>

          <div
            className={`dq-speech-bubble flex-1 rounded-3xl bg-white border-2 px-4 sm:px-5 py-4 shadow-[0_4px_14px_rgba(45,38,32,0.06)] ${
              isLavender ? 'border-[#D4D1EC]' : 'border-[#E5E5E5]'
            }`}
          >
            <div className="flex items-start gap-3">
              {isTtsSupported() && (
                <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handlePlaySentence(0.94)}
                    aria-label="영어 문장 전체 듣기"
                    title="문장 듣기"
                    className="dq-btn-3d w-11 h-11 rounded-2xl bg-[#E8F7FF] border-2 border-[#1CB0F6] text-[#0E74A8] flex items-center justify-center cursor-pointer"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlaySentence(0.72)}
                    aria-label="영어 문장 느리게 듣기"
                    title="느리게 듣기"
                    className="min-h-[26px] px-1.5 rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] text-[11px] font-extrabold text-[#5C4D42] hover:border-[#1CB0F6] cursor-pointer"
                  >
                    0.7x
                  </button>
                </div>
              )}

              <div className="flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-2 leading-relaxed">
                {expectedChunks.map((chunk, idx) => {
                  const isSpeechActive = activeSpeechChunkIdx === idx;
                  const isHintHighlighted =
                    hintLevel >= 1 && idx === nextChunkIdxToHint && status !== 'correct';
                  const isAlreadyMatched =
                    idx < placedTileIds.length &&
                    tileById.get(placedTileIds[idx])?.text.trim() ===
                      chunk.meaningKo.trim();

                  return (
                    <button
                      key={chunk.id}
                      type="button"
                      onClick={() => handlePlayChunk(chunk.english, idx)}
                      title="눌러서 이 의미 단위 발음 듣기"
                      className={`text-left text-lg sm:text-[21px] font-extrabold px-1.5 py-0.5 rounded-xl transition-colors cursor-pointer border-b-2 border-dotted ${
                        isHintHighlighted
                          ? 'bg-[#FFE18A]/70 border-[#D4A72C] text-[#2D2620]'
                          : isSpeechActive
                            ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#0D5B85]'
                            : isAlreadyMatched
                              ? 'bg-[#EEFFD9]/65 border-[#58CC02] text-[#235300]'
                              : 'border-[#AFAFAF] text-[#2D2620] hover:bg-[#F7F3EC]'
                      }`}
                    >
                      {chunk.english}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Hint Pill (Feature D) */}
            {hintLevel >= 1 && hintChunk && status !== 'correct' && (
              <div className="mt-3 pt-2.5 border-t border-[#F0EAE0] flex items-start gap-2 text-xs sm:text-sm font-bold text-[#7A5200] bg-[#FFF8DF] rounded-xl px-3 py-2 rq-feedback-rise">
                <Lightbulb className="w-4 h-4 text-[#D99B00] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div>
                    <span className="font-extrabold">
                      {nextChunkIdxToHint + 1}번째 조각 힌트:
                    </span>{' '}
                    “{hintChunk.english}” → {hintChunk.howToRead}
                  </div>
                  {hintLevel >= 2 && (
                    <div className="text-[#46A302] font-extrabold">
                      → 알맞은 뜻: “{hintChunk.meaningKo}”
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ③ 직독직해 답안 작성 영역 (Duolingo 2+ Horizontal Guide Lines) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-[#7D6E61]">
              내 직독직해 답안 ({placedTileIds.length}/{expectedChunks.length})
            </span>
            {placedTileIds.length > 0 && status !== 'correct' && (
              <button
                type="button"
                onClick={handleClearPlaced}
                className="text-xs font-extrabold text-[#7D6E61] hover:text-[#D14343] inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>비우기</span>
              </button>
            )}
          </div>

          <div
            key={shakeTrigger}
            className={`relative min-h-[124px] sm:min-h-[132px] py-2 ${
              status === 'wrong' && !reducedMotion ? 'rq-shake' : ''
            }`}
          >
            {/* Background Horizontal Guide Lines (always visible beneath tiles) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col justify-start"
            >
              <div className="h-[58px] border-b-2 border-[#E2DDD3]" />
              <div className="h-[58px] border-b-2 border-[#E2DDD3]" />
            </div>

            {placedTileIds.length === 0 ? (
              <div className="relative z-10 h-[116px] flex items-center justify-center">
                <span className="text-sm font-bold text-[#A5988B]">
                  아래에서 의미 조각을 순서대로 눌러 문장을 완성해 보세요
                </span>
              </div>
            ) : (
              <div className="relative z-10 flex flex-wrap items-start gap-2.5 pt-1">
                {placedTileIds.map((tileId, idx) => {
                  const tile = tileById.get(tileId);
                  if (!tile) return null;
                  const isWrongPos =
                    status === 'wrong' && wrongIndices.includes(idx);

                  return (
                    <button
                      key={tile.tileId}
                      type="button"
                      onClick={() => handleRemovePlacedTile(tile.tileId)}
                      disabled={status === 'correct'}
                      title={
                        status === 'correct'
                          ? undefined
                          : '다시 눌러서 아래로 되돌리기'
                      }
                      className={`dq-btn-3d rq-tile-pop min-h-[46px] px-4 py-2 rounded-2xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:cursor-default ${
                        status === 'correct'
                          ? 'bg-[#EEFFD9] border-[#58CC02] text-[#1E4600]'
                          : isWrongPos
                            ? 'bg-[#FFE5E5] border-[#FF4B4B] text-[#9A1B1B]'
                            : 'bg-white border-[#DCD6CC] text-[#2D2620] hover:border-[#FF9600]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[11px] font-extrabold inline-flex items-center justify-center ${
                          status === 'correct'
                            ? 'bg-[#58CC02] text-white'
                            : isWrongPos
                              ? 'bg-[#FF4B4B] text-white'
                              : 'bg-[#F0EBE2] text-[#5C4D42]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span>{tile.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ④ 하단 단어 및 의미 조각 선택 영역 */}
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {wordBankTiles.map((tile) => {
              const isSelected = placedTileIds.includes(tile.tileId);
              return (
                <button
                  key={tile.tileId}
                  type="button"
                  disabled={isSelected || status === 'correct'}
                  onClick={() => handleSelectTile(tile.tileId)}
                  aria-hidden={isSelected}
                  tabIndex={isSelected ? -1 : 0}
                  className={`min-h-[48px] px-4 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold transition-all ${
                    isSelected
                      ? 'bg-[#E9E4DB]/80 border-[#DFD8CC] text-transparent select-none pointer-events-none shadow-none'
                      : 'dq-btn-3d bg-white border-[#E5E5E5] text-[#2D2620] hover:border-[#1CB0F6] cursor-pointer'
                  }`}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar / Duolingo Feedback Sheet */}
      <div className="pt-2">
        {status === 'idle' && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t-2 border-[#EAE0D0]/80">
            <button
              type="button"
              onClick={handleRequestHint}
              className="dq-btn-3d min-h-[50px] px-4 sm:px-5 py-2.5 rounded-2xl bg-[#FFF6DA] border-2 border-[#D4A72C] text-[#4B3200] text-sm sm:text-base font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <Lightbulb className="w-5 h-5 text-[#D99B00]" />
              <span>{hintLevel >= 1 ? '핵심 힌트 더 보기' : '힌트'}</span>
            </button>

            <button
              type="button"
              onClick={handleCheckAnswer}
              disabled={placedTileIds.length === 0}
              className={`dq-btn-3d min-h-[50px] px-7 sm:px-9 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold cursor-pointer ${
                placedTileIds.length === 0
                  ? 'bg-[#E5E5E5] border-[#D4D4D4] text-[#9E9E9E] cursor-not-allowed shadow-none'
                  : 'bg-[#58CC02] border-[#46A302] text-white'
              }`}
            >
              정답 확인
            </button>
          </div>
        )}

        {status === 'wrong' && (
          <div className="rq-feedback-rise rounded-3xl bg-[#FFDFE0] border-2 border-[#FF9B9E] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="space-y-1">
              <div className="text-base sm:text-lg font-extrabold text-[#9A1B1B]">
                조금 아쉬워요! 다시 도전해 보세요
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#7A2D1C]">
                {wrongReason}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRequestHint}
                className="dq-btn-3d min-h-[46px] px-4 py-2 rounded-2xl bg-white border-2 border-[#FF9B9E] text-[#9A1B1B] text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Lightbulb className="w-4 h-4" />
                <span>힌트</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setWrongIndices([]);
                  setWrongReason('');
                }}
                className="dq-btn-3d min-h-[46px] px-5 py-2 rounded-2xl bg-[#FF4B4B] border-2 border-[#D92D2D] text-white text-sm font-extrabold cursor-pointer"
              >
                다시 고르기
              </button>
            </div>
          </div>
        )}

        {status === 'correct' && (
          <div className="rq-feedback-rise rounded-3xl bg-[#D7FFB8] border-2 border-[#7ED932] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-[#3E8E00] shrink-0" />
                <span className="text-base sm:text-lg font-extrabold text-[#1E4600]">
                  {praiseText}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#7ED932] text-xs font-extrabold text-[#3E8E00] tabular-nums">
                  +{XP_PER_SENTENCE} XP
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#285E00]">
                자연스러운 뜻: {safeEntry.analysis.modelTranslationKo}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextSentence}
              className="dq-btn-3d min-h-[48px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>
                {currentIndex + 1 >= totalCount ? '학습 결과 보기' : '다음 문장'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
