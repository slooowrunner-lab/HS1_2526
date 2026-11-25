import React, { useEffect, useMemo, useRef, useState } from 'react';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Lightbulb,
  Link2,
  Puzzle,
  RotateCcw,
  Sparkles,
  Tag,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import {
  CHUNK_ROLE_META,
  ChunkRole,
  QuestionSentenceAnalysis,
} from '../types/sentenceAnalysis';
import {
  createEmptyQuestionLabDraft,
  QuestionLabDraft,
} from '../controllers/SentenceLabStorage';
import { playSuccessChime, playTryAgainSoft } from '../utils/soundEffects';
import { isTtsSupported, speakEnglish } from '../utils/tts';

interface SentenceChunkWorkshopProps {
  analysis: QuestionSentenceAnalysis;
  draft: QuestionLabDraft;
  onUpdateDraft: (updater: (prev: QuestionLabDraft) => QuestionLabDraft) => void;
  onClaimSentenceXp: () => void;
  onGoToBoss?: () => void;
  islandTheme?: 'spring' | 'lavender';
}

type WorkshopStep = 'match' | 'role' | 'assemble';

const STEP_INDEX: Record<WorkshopStep, number> = {
  match: 0,
  role: 1,
  assemble: 2,
};

const ROLE_ORDER: ChunkRole[] = ['S', 'V', 'O', 'C', 'M', 'CONJ'];

const ROLE_KID_PROMPT: Record<ChunkRole, string> = {
  S: '누가 / 무엇이? (~은·는·이·가)',
  V: '어떻게 하다 / ~이다? (문장의 핵심 동작)',
  O: '무엇을 / 누구에게? (~을·를·에게)',
  C: '어떤 상태·모습인지 보충 설명!',
  M: '언제·어디서·왜·어떻게 꾸며줌!',
  CONJ: '앞뒤 문장을 이어주는 연결어!',
};

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getWrongRoleHint(chosen: ChunkRole, actual: ChunkRole): string {
  if (actual === 'V') {
    return '이 조각은 문장의 동작이나 상태("~하다 / ~이다")를 나타내는 핵심 동사(V)예요!';
  }
  if (actual === 'S') {
    return '이 조각은 "~은/는/이/가"에 해당하는 문장의 주인공(주어 S)이에요!';
  }
  if (actual === 'O') {
    return '이 조각은 동사의 대상("~을/를" 또는 "~에게")인 목적어(O)예요!';
  }
  if (actual === 'C') {
    return '이 조각은 주어나 목적어의 상태·행동을 보충 설명하는 보어(C)예요!';
  }
  if (actual === 'CONJ') {
    return '이 조각은 문장 앞뒤의 논리(반전, 예시, 결과 등)를 이어주는 연결어예요!';
  }
  if (chosen === 'O' || chosen === 'C') {
    return '이 조각은 전치사나 접속사로 시작해 때·장소·이유·방법을 덧붙여 주는 수식어(M)예요!';
  }
  return '시간·장소·이유·방법을 더해주거나 명사를 뒤에서 꾸며주는 수식어(M)인지 살펴보세요!';
}

export const SentenceChunkWorkshop: React.FC<SentenceChunkWorkshopProps> = ({
  analysis,
  draft,
  onUpdateDraft,
  onClaimSentenceXp,
  onGoToBoss,
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const ttsAvailable = isTtsSupported();
  const [activeStep, setActiveStep] = useState<WorkshopStep>('match');
  const [matchFeedback, setMatchFeedback] = useState<{
    type: 'good' | 'retry' | 'info';
    text: string;
  } | null>(null);
  const [roleFeedback, setRoleFeedback] = useState<{
    type: 'good' | 'retry';
    text: string;
  } | null>(null);
  const [meaningHelpChunkId, setMeaningHelpChunkId] = useState<string | null>(null);
  const [showGrammarDetail, setShowGrammarDetail] = useState(false);
  const [confirmRevealModel, setConfirmRevealModel] = useState(false);
  const [showEnglishCueOnTiles, setShowEnglishCueOnTiles] = useState(true);
  const [draggedKoChunkId, setDraggedKoChunkId] = useState<string | null>(null);
  const [previousSnapshot, setPreviousSnapshot] =
    useState<QuestionLabDraft | null>(null);

  const stepIdx = STEP_INDEX[activeStep];
  const lastStepSnapshotRef = useRef<{
    qId: string;
    stepIdx: number;
    dir: 'next' | 'prev' | 'none';
  }>({
    qId: analysis.questionId,
    stepIdx,
    dir: 'none',
  });

  let stepTurnDir: 'next' | 'prev' | 'none' = lastStepSnapshotRef.current.dir;
  if (lastStepSnapshotRef.current.qId !== analysis.questionId) {
    stepTurnDir = 'none';
  } else if (lastStepSnapshotRef.current.stepIdx !== stepIdx) {
    stepTurnDir = stepIdx > lastStepSnapshotRef.current.stepIdx ? 'next' : 'prev';
  }

  useEffect(() => {
    lastStepSnapshotRef.current = {
      qId: analysis.questionId,
      stepIdx,
      dir: stepTurnDir,
    };
  }, [analysis.questionId, stepIdx, stepTurnDir]);

  const stepAnimClass =
    stepTurnDir === 'next'
      ? 'rq-page-turn-next'
      : stepTurnDir === 'prev'
        ? 'rq-page-turn-prev'
        : '';

  const chunks = analysis.chunks;
  const chunkById = useMemo(
    () => Object.fromEntries(chunks.map((c) => [c.id, c])),
    [chunks],
  );

  // Auto-select first unsolved chunk in 'match' or 'role' so controls are never stuck disabled
  useEffect(() => {
    if (chunks.length === 0) return;
    if (activeStep !== 'match' && activeStep !== 'role') return;
    const currentValid = Boolean(draft.selectedChunkId && chunkById[draft.selectedChunkId]);
    if (currentValid) return;

    const target =
      activeStep === 'match'
        ? chunks.find((c) => draft.matchedMeanings[c.id] !== c.id) ?? chunks[0]
        : chunks.find((c) => draft.roleSelections[c.id] !== c.role) ?? chunks[0];

    if (target) {
      onUpdateDraft((prev) => ({
        ...prev,
        selectedChunkId: target.id,
      }));
    }
  }, [
    activeStep,
    analysis.questionId,
    chunks,
    chunkById,
    draft.selectedChunkId,
    draft.matchedMeanings,
    draft.roleSelections,
    onUpdateDraft,
  ]);

  const availableRoles = useMemo(() => {
    const present = new Set(chunks.map((c) => c.role));
    return ROLE_ORDER.filter((r) => present.has(r));
  }, [chunks]);

  const shuffledKoChunks = useMemo(() => {
    const list = [...chunks];
    if (list.length <= 1) return list;
    const seed = hashSeed(analysis.questionId);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = (seed + i * 7) % (i + 1);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }, [chunks, analysis.questionId]);

  const expectedKoOrderIds = useMemo(
    () => [...chunks].sort((a, b) => a.koOrderIndex - b.koOrderIndex).map((c) => c.id),
    [chunks],
  );

  const selectedChunk = draft.selectedChunkId
    ? chunkById[draft.selectedChunkId] ?? null
    : null;

  const activeChunkForExercise =
    selectedChunk ??
    (activeStep === 'match'
      ? chunks.find((c) => draft.matchedMeanings[c.id] !== c.id) ?? chunks[0]
      : chunks.find((c) => draft.roleSelections[c.id] !== c.role) ?? chunks[0]) ??
    null;

  const correctMatchesCount = useMemo(
    () => chunks.filter((c) => draft.matchedMeanings[c.id] === c.id).length,
    [chunks, draft.matchedMeanings],
  );
  const correctRolesCount = useMemo(
    () => chunks.filter((c) => draft.roleSelections[c.id] === c.role).length,
    [chunks, draft.roleSelections],
  );
  const placedKoIds = useMemo(
    () => draft.koAssemblyOrder.filter((id) => Boolean(chunkById[id])),
    [draft.koAssemblyOrder, chunkById],
  );
  const isAllMatched = chunks.length > 0 && correctMatchesCount === chunks.length;
  const isAllRolesFound = chunks.length > 0 && correctRolesCount === chunks.length;
  const isAllKoPlaced = chunks.length > 0 && placedKoIds.length === chunks.length;

  const keywordMatchCount = useMemo(() => {
    const clean = draft.koSummaryDraft.trim().toLowerCase();
    if (!clean) return 0;
    return analysis.coreMeaningKeywords.filter((kw) =>
      clean.includes(kw.toLowerCase()),
    ).length;
  }, [draft.koSummaryDraft, analysis.coreMeaningKeywords]);

  const isKoOrderExact =
    isAllKoPlaced &&
    placedKoIds.every((id, idx) => id === expectedKoOrderIds[idx]);

  const hasAttemptedMeaning =
    correctMatchesCount > 0 ||
    correctRolesCount > 0 ||
    placedKoIds.length > 0 ||
    draft.koSummaryDraft.trim().length > 0;

  const handleSelectChunk = (chunkId: string) => {
    setMatchFeedback(null);
    setRoleFeedback(null);
    onUpdateDraft((prev) => ({
      ...prev,
      selectedChunkId: chunkId,
    }));
  };

  const handleStepChunkCycle = (delta: -1 | 1) => {
    if (chunks.length === 0) return;
    const curIdx = activeChunkForExercise
      ? chunks.findIndex((c) => c.id === activeChunkForExercise.id)
      : 0;
    const nextIdx = (curIdx + delta + chunks.length) % chunks.length;
    handleSelectChunk(chunks[nextIdx].id);
  };

  const handlePairMeaning = (meaningChunkId: string) => {
    const targetChunk = activeChunkForExercise;
    if (!targetChunk) {
      setMatchFeedback({
        type: 'info',
        text: '먼저 위 영어 문장에서 조각을 하나 눌러 선택해 주세요!',
      });
      return;
    }

    const isExactMatch = targetChunk.id === meaningChunkId;
    if (isExactMatch) {
      playSuccessChime();
      const nextMatched = {
        ...draft.matchedMeanings,
        [targetChunk.id]: meaningChunkId,
      };
      const nextAllMatched = chunks.every((c) => nextMatched[c.id] === c.id);
      const nextUnmatched = chunks.find(
        (c) => c.id !== targetChunk.id && nextMatched[c.id] !== c.id,
      );

      setMatchFeedback({
        type: 'good',
        text: nextAllMatched
          ? `"${targetChunk.english}" 연결 완료! 모든 조각의 뜻을 다 맞혔어요!`
          : `"${targetChunk.english}" ↔ "${chunkById[meaningChunkId].meaningKo}" 연결 성공!`,
      });

      onUpdateDraft((prev) => {
        const mergedMatched = {
          ...prev.matchedMeanings,
          [targetChunk.id]: meaningChunkId,
        };
        const finishedAll = chunks.every((c) => mergedMatched[c.id] === c.id);
        return {
          ...prev,
          matchedMeanings: mergedMatched,
          selectedChunkId: nextUnmatched ? nextUnmatched.id : targetChunk.id,
          sentenceCompleted: prev.sentenceCompleted || finishedAll,
        };
      });

      if (nextAllMatched && !draft.sentenceXpClaimed) {
        onClaimSentenceXp();
      }
    } else {
      playTryAgainSoft();
      setMatchFeedback({
        type: 'retry',
        text: `조금 달라요! "${targetChunk.english}"의 뜻이 맞는지 생각하거나 '뜻 살짝 보기'를 눌러 보세요.`,
      });
    }
  };

  const handleUnlinkMeaning = (chunkId: string) => {
    setMatchFeedback(null);
    onUpdateDraft((prev) => {
      const next = { ...prev.matchedMeanings };
      delete next[chunkId];
      return {
        ...prev,
        matchedMeanings: next,
        selectedChunkId: chunkId,
      };
    });
  };

  const handlePickRole = (chosenRole: ChunkRole) => {
    const targetChunk = activeChunkForExercise;
    if (!targetChunk) return;
    if (chosenRole === targetChunk.role) {
      playSuccessChime();
      const roleMeta = CHUNK_ROLE_META[chosenRole];
      setRoleFeedback({
        type: 'good',
        text: `정확해요! "${targetChunk.english}"는 ${roleMeta.labelKo} 역할이에요.`,
      });
      onUpdateDraft((prev) => {
        const nextRoles = {
          ...prev.roleSelections,
          [targetChunk.id]: chosenRole,
        };
        const nextUntagged = chunks.find(
          (c) => c.id !== targetChunk.id && nextRoles[c.id] !== c.role,
        );
        return {
          ...prev,
          roleSelections: nextRoles,
          selectedChunkId: nextUntagged ? nextUntagged.id : targetChunk.id,
        };
      });
    } else {
      playTryAgainSoft();
      setRoleFeedback({
        type: 'retry',
        text: getWrongRoleHint(chosenRole, targetChunk.role),
      });
    }
  };

  const handleClearRole = (chunkId: string) => {
    setRoleFeedback(null);
    onUpdateDraft((prev) => {
      const next = { ...prev.roleSelections };
      delete next[chunkId];
      return {
        ...prev,
        roleSelections: next,
        selectedChunkId: chunkId,
      };
    });
  };

  const handleToggleKoToken = (chunkId: string) => {
    if (placedKoIds.includes(chunkId)) {
      onUpdateDraft((prev) => ({
        ...prev,
        koAssemblyOrder: placedKoIds.filter((id) => id !== chunkId),
        koAssemblyChecked: false,
      }));
    } else {
      onUpdateDraft((prev) => ({
        ...prev,
        koAssemblyOrder: [...placedKoIds, chunkId],
        koAssemblyChecked: false,
      }));
    }
  };

  const handleMoveKoToken = (pos: number, delta: -1 | 1) => {
    const target = pos + delta;
    if (target < 0 || target >= placedKoIds.length) return;
    const next = [...placedKoIds];
    const [item] = next.splice(pos, 1);
    next.splice(target, 0, item);
    onUpdateDraft((prev) => ({
      ...prev,
      koAssemblyOrder: next,
      koAssemblyChecked: false,
    }));
  };

  const handleDropKoToken = (targetPos: number) => {
    if (!draggedKoChunkId) return;
    const next = [...placedKoIds];
    const existingIdx = next.indexOf(draggedKoChunkId);
    if (existingIdx !== -1) {
      next.splice(existingIdx, 1);
    }
    next.splice(targetPos, 0, draggedKoChunkId);
    setDraggedKoChunkId(null);
    onUpdateDraft((prev) => ({
      ...prev,
      koAssemblyOrder: next,
      koAssemblyChecked: false,
    }));
  };

  const handleAutoAlignNaturalOrder = () => {
    playSuccessChime();
    onUpdateDraft((prev) => ({
      ...prev,
      koAssemblyOrder: [...expectedKoOrderIds],
      koAssemblyChecked: true,
      revealedModelAnswer: true,
      sentenceCompleted: true,
    }));
    if (!draft.sentenceXpClaimed) {
      onClaimSentenceXp();
    }
  };

  const handleCheckTranslation = () => {
    const looksGood = isKoOrderExact || keywordMatchCount >= 1 || !isAllKoPlaced;
    if (draft.sentenceXpClaimed) {
      if (looksGood) {
        playSuccessChime();
      } else {
        playTryAgainSoft();
      }
    }
    onUpdateDraft((prev) => ({
      ...prev,
      koAssemblyChecked: true,
      revealedModelAnswer: true,
      sentenceCompleted: true,
    }));
    if (!draft.sentenceXpClaimed) {
      onClaimSentenceXp();
    }
  };

  const handleNextHint = () => {
    onUpdateDraft((prev) => ({
      ...prev,
      hintLevel: Math.min(analysis.stepHints.length, prev.hintLevel + 1),
    }));
  };

  const handleResetWorkshop = () => {
    setMatchFeedback(null);
    setRoleFeedback(null);
    setMeaningHelpChunkId(null);
    setConfirmRevealModel(false);
    if (hasAttemptedMeaning) {
      setPreviousSnapshot({ ...draft });
    }
    onUpdateDraft((prev) => ({
      ...createEmptyQuestionLabDraft(),
      flowOrderDraft: prev.flowOrderDraft,
      flowOrderChecked: prev.flowOrderChecked,
      flowGuessDraft: prev.flowGuessDraft,
      flowGuessChecked: prev.flowGuessChecked,
      revealedFocusCardIds: prev.revealedFocusCardIds,
      focusMiniCheckDone: prev.focusMiniCheckDone,
      sentenceXpClaimed: prev.sentenceXpClaimed,
      sentenceCompleted: prev.sentenceCompleted,
    }));
  };

  const handleRestoreWorkshopSnapshot = () => {
    if (!previousSnapshot) return;
    onUpdateDraft((prev) => ({
      ...previousSnapshot,
      flowOrderDraft: prev.flowOrderDraft,
      flowOrderChecked: prev.flowOrderChecked,
      flowGuessDraft: prev.flowGuessDraft,
      flowGuessChecked: prev.flowGuessChecked,
      revealedFocusCardIds: prev.revealedFocusCardIds,
      focusMiniCheckDone: prev.focusMiniCheckDone,
      sentenceXpClaimed: prev.sentenceXpClaimed || previousSnapshot.sentenceXpClaimed,
      sentenceCompleted: prev.sentenceCompleted || previousSnapshot.sentenceCompleted,
    }));
    setPreviousSnapshot(null);
  };

  return (
    <div
      className={`rounded-3xl border-2 p-4 sm:p-6 space-y-5 ${
        isLavender
          ? 'border-[#95AFE8] bg-[#F2F4FD]'
          : 'border-[#A8DCC8] bg-[#F7FCF9]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex items-center gap-1.5 text-sm sm:text-base font-extrabold ${
              isLavender ? 'text-[#3F297A]' : 'text-[#164E3B]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>핵심 문장 끊어 해석 (+20 XP · 힌트 무료!)</span>
          </div>
          <h3 className={`text-xl sm:text-2xl font-extrabold mt-1 ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
            핵심 문장을 덩어리씩 끊어서 쉽게 해석해 봐요
          </h3>
          <p className={`text-sm sm:text-base mt-1 leading-relaxed ${isLavender ? 'text-[#3F3D6B]' : 'text-[#5C4D42]'}`}>
            <strong>A. 뜻 맞추기</strong>와 <strong>C. 해석 조립</strong>만 해도 충분해요! (B. 성분 찾기는 선택)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
          <span
            className={`px-3.5 py-1.5 rounded-xl border-2 tabular-nums ${
              isAllMatched
                ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                : isLavender
                  ? 'bg-white border-[#C9C2E8] text-[#3F3D6B]'
                  : 'bg-white border-[#EAE0D0] text-[#4B3F35]'
            }`}
          >
            뜻 {correctMatchesCount}/{chunks.length}
          </span>
          <span
            className={`px-3.5 py-1.5 rounded-xl border-2 tabular-nums ${
              isAllRolesFound
                ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                : isLavender
                  ? 'bg-white border-[#C9C2E8] text-[#3F3D6B]'
                  : 'bg-white border-[#EAE0D0] text-[#4B3F35]'
            }`}
          >
            성분 {correctRolesCount}/{chunks.length}
          </span>
          {draft.sentenceCompleted && (
            <span
              className={`px-3.5 py-1.5 rounded-xl border-2 inline-flex items-center gap-1 ${
                isLavender
                  ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#211442]'
                  : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${isLavender ? 'text-[#4B3B94]' : 'text-[#4C7A34]'}`} />
              완료
            </span>
          )}
        </div>
      </div>

      {/* Interactive Sentence Chunks Display (Duolingo Speech Bubble Style + TTS) */}
      <div className={`rounded-2xl bg-white border-2 p-4 sm:p-5 space-y-4 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#E5E5E5]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className={`text-sm sm:text-base font-extrabold ${isLavender ? 'text-[#3F3D6B]' : 'text-[#4B3F35]'}`}>
            아래 말풍선 속 영어 조각을 눌러 뜻을 확인하세요
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {ttsAvailable && (
              <>
                <button
                  type="button"
                  onClick={() => speakEnglish(analysis.sentence, 0.94)}
                  className="dq-btn-3d min-h-[38px] px-3 py-1.5 rounded-xl bg-[#DDF4FF] border-2 border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>문장 전체 듣기</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakEnglish(analysis.sentence, 0.75)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border-2 border-[#E5E5E5] hover:border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#4B3F35] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>🐢 천천히</span>
                </button>
              </>
            )}
          </div>
        </div>

        {draft.structureOverlayVisible && (
          <div className="flex flex-wrap items-center gap-1.5">
            {availableRoles.map((r) => {
              const meta = CHUNK_ROLE_META[r];
              return (
                <span
                  key={r}
                  className={`px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-extrabold ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                >
                  {meta.badgeText}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-3.5">
          <div
            className={`rq-fox-bob w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 shrink-0 bg-[#FFF9EF] flex items-center justify-center ${
              isLavender ? 'border-[#C6BEE8]' : 'border-[#E5E5E5]'
            }`}
          >
            <img
              src={mascotImage}
              alt="여우 학습 도우미"
              className="w-full h-full object-cover"
            />
          </div>

          <div
            className={`dq-speech-bubble rq-speech-pop flex-1 rounded-2xl border-2 bg-white p-3.5 sm:p-4 flex flex-wrap items-stretch gap-3 leading-relaxed ${
              isLavender ? 'border-[#D5CEF0]' : 'border-[#E5E5E5]'
            }`}
          >
            {chunks.map((chunk) => {
              const isSelected = activeChunkForExercise?.id === chunk.id;
              const roleSolved = draft.roleSelections[chunk.id] === chunk.role;
              const meaningSolved = draft.matchedMeanings[chunk.id] === chunk.id;
              const showRoleStyle = draft.structureOverlayVisible || roleSolved;
              const roleMeta = CHUNK_ROLE_META[chunk.role];

              return (
                <div
                  key={chunk.id}
                  className={`relative rounded-2xl border-2 transition-all flex items-center gap-2 px-4 py-3 ${
                    showRoleStyle
                      ? `${roleMeta.activeBg} ${roleMeta.activeBorder} ${roleMeta.activeText}`
                      : isSelected
                        ? isLavender
                          ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#1A1238]'
                          : 'bg-[#FFE18A]/55 border-[#C9961A] text-[#1E1915]'
                        : isLavender
                          ? 'bg-[#F8F7FF] border-[#C9C6E8] hover:border-[#6A52A3] text-[#14132E]'
                          : 'bg-[#FFFDF8] border-[#DFD3C1] hover:border-[#9B785D] text-[#1E1915]'
                  } ${isSelected ? (isLavender ? 'ring-2 ring-[#8D7AD6]/60 shadow-xs' : 'ring-2 ring-[#C9961A]/65 shadow-xs') : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectChunk(chunk.id)}
                    className="text-left flex flex-col gap-1 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs sm:text-sm font-extrabold tracking-tight ${
                          showRoleStyle
                            ? `${roleMeta.pillBg} ${roleMeta.activeText}`
                            : isLavender
                              ? 'bg-[#E5E2F6] text-[#3F3A70]'
                              : 'bg-[#EAE0D0] text-[#4B3F35]'
                        }`}
                      >
                        {showRoleStyle ? roleMeta.badgeText : '? 성분'}
                      </span>
                      {meaningSolved && (
                        <span className="text-xs sm:text-sm font-extrabold text-[#245916] inline-flex items-center gap-0.5">
                          <Check className="w-3.5 h-3.5" />뜻 연결
                        </span>
                      )}
                    </div>
                    <span className="text-lg sm:text-2xl font-extrabold leading-snug">
                      {chunk.english}
                    </span>
                    {(meaningSolved || meaningHelpChunkId === chunk.id) && (
                      <span className="text-sm sm:text-base font-bold opacity-95">
                        → {chunk.meaningKo}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Chunk Explorer Card */}
      {activeChunkForExercise && (
        <div
          className={`rounded-2xl bg-white border-2 p-4 sm:p-5 space-y-3 ${
            isLavender ? 'border-[#7963A8]/70' : 'border-[#C9961A]/60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs sm:text-sm font-extrabold ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`}>
                  지금 보고 있는 조각
                </span>
                {(draft.structureOverlayVisible ||
                  draft.roleSelections[activeChunkForExercise.id] === activeChunkForExercise.role) && (
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs sm:text-sm font-extrabold border ${CHUNK_ROLE_META[activeChunkForExercise.role].activeBg} ${CHUNK_ROLE_META[activeChunkForExercise.role].activeBorder} ${CHUNK_ROLE_META[activeChunkForExercise.role].activeText}`}
                  >
                    {activeChunkForExercise.roleLabelKo}
                  </span>
                )}
              </div>
              <div className={`text-lg sm:text-xl font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                “{activeChunkForExercise.english}”
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ttsAvailable && (
                <>
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeChunkForExercise.english, 0.94)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#DDF4FF] border border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1 cursor-pointer hover:bg-[#CBEBFD]"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>조각 듣기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeChunkForExercise.english, 0.78)}
                    title="0.8배속으로 천천히 듣기"
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white border border-[#84D8FF] text-xs font-extrabold text-[#143752] cursor-pointer hover:bg-[#F2FAFF]"
                  >
                    0.8x
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  setMeaningHelpChunkId((prev) =>
                    prev === activeChunkForExercise.id ? null : activeChunkForExercise.id,
                  )
                }
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFF6DA] border border-[#E0B94B] text-xs sm:text-sm font-extrabold text-[#573B00] inline-flex items-center gap-1 cursor-pointer hover:bg-[#FFE18A]/70"
              >
                <Lightbulb className="w-4 h-4" />
                <span>
                  {meaningHelpChunkId === activeChunkForExercise.id
                    ? '뜻 힌트 닫기'
                    : '뜻 살짝 보기'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base">
            <div
              className={`rounded-xl border p-3 space-y-1 ${
                isLavender
                  ? 'bg-[#F4F2FC] border-[#D7D0F0]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0]'
              }`}
            >
              <div className={`font-extrabold ${isLavender ? 'text-[#4E3B8C]' : 'text-[#7B5600]'}`}>
                이렇게 끊어 읽어요
              </div>
              <p className={`leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {activeChunkForExercise.howToRead}
              </p>
            </div>
            <div
              className={`rounded-xl border p-3 space-y-1 ${
                isLavender
                  ? 'bg-[#EEF5FD] border-[#BCD4F2]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0]'
              }`}
            >
              <div className={`font-extrabold ${isLavender ? 'text-[#2B599C]' : 'text-[#1D5E48]'}`}>
                앞뒤 조각과 연결
              </div>
              <p className={`leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {activeChunkForExercise.relationNote}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#E6F4FC]/60 border border-[#A9DDF5] px-3.5 py-2.5 text-sm text-[#133A52]">
            <span className="font-extrabold mr-1.5">생각 질문:</span>
            {activeChunkForExercise.thinkingQuestion}
          </div>

          {(draft.matchedMeanings[activeChunkForExercise.id] === activeChunkForExercise.id ||
            meaningHelpChunkId === activeChunkForExercise.id) && (
            <div className="rounded-xl bg-[#EAF5E4] border border-[#4E8336]/50 px-3.5 py-2.5 text-sm sm:text-base text-[#1A390D]">
              <span className="font-extrabold mr-1.5">쉬운 뜻:</span>
              {activeChunkForExercise.meaningKo}
            </div>
          )}

          {activeChunkForExercise.grammarTip && (
            <div>
              <button
                type="button"
                onClick={() => setShowGrammarDetail((v) => !v)}
                className="text-xs sm:text-sm font-bold text-[#785EA8] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>추가 문법 설명 {showGrammarDetail ? '접기' : '보기'}</span>
                {showGrammarDetail ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {showGrammarDetail && (
                <div className="mt-1.5 rounded-xl bg-[#F1ECFA] border border-[#785EA8]/40 px-3.5 py-2.5 text-sm text-[#2F1F52]">
                  {activeChunkForExercise.grammarTip}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Simplified Help Toolbar */}
      <div
        className={`rounded-2xl bg-white border-2 p-3.5 space-y-3 ${
          isLavender ? 'border-[#C4CCE8]' : 'border-[#D4EADF]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleNextHint}
            className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              isLavender
                ? 'bg-[#E7E0FA] border-[#8C77C9] text-[#26184D] hover:bg-[#DDD4FA]'
                : 'bg-[#FFE18A]/55 border-[#D4A72C] text-[#2D2620] hover:bg-[#FFE18A]'
            }`}
          >
            <Lightbulb className={`w-4 h-4 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B6B00]'}`} />
            <span>
              {draft.hintLevel === 0
                ? `단계별 힌트 보기 (0/${analysis.stepHints.length})`
                : draft.hintLevel < analysis.stepHints.length
                  ? `다음 힌트 보기 (${draft.hintLevel}/${analysis.stepHints.length})`
                  : `모든 힌트 열림 (${draft.hintLevel}/${analysis.stepHints.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateDraft((prev) => ({
                ...prev,
                structureOverlayVisible: !prev.structureOverlayVisible,
              }))
            }
            className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              draft.structureOverlayVisible
                ? 'bg-[#DFD2F4] border-[#785EA8] text-[#2F1F52]'
                : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#4B3F35] hover:border-[#785EA8]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>{draft.structureOverlayVisible ? '문장 구조 가리기' : '문장 구조 색깔 보기'}</span>
          </button>

          {!draft.revealedModelAnswer && (
            <button
              type="button"
              onClick={() => {
                if (hasAttemptedMeaning) {
                  onUpdateDraft((prev) => ({
                    ...prev,
                    revealedModelAnswer: true,
                  }));
                } else {
                  setConfirmRevealModel(true);
                }
              }}
              className="dq-btn-3d min-h-[44px] px-4 py-2 rounded-xl bg-white border-2 border-[#EAE0D0] text-sm sm:text-base font-bold text-[#4B3F35] hover:border-[#9B785D] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>모범 해석 보기</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetWorkshop}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FFF9EF] border-2 border-[#EAE0D0] text-sm font-bold text-[#4B3F35] hover:border-[#D1684E] inline-flex items-center gap-1.5 cursor-pointer ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>다시 연습 (기록 유지)</span>
          </button>

          {previousSnapshot && (
            <button
              type="button"
              onClick={handleRestoreWorkshopSnapshot}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#A8DCC8]/40 border-2 border-[#4D9479] text-sm font-extrabold text-[#163B2D] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>이전 풀이 복구</span>
            </button>
          )}
        </div>

        {confirmRevealModel && !draft.revealedModelAnswer && (
          <div className="rounded-xl bg-[#FFF6DA] border-2 border-[#B68411]/50 p-3.5 flex flex-wrap items-center justify-between gap-2.5 text-sm sm:text-base text-[#4C3600]">
            <span>
              조각 뜻을 1~2개만 먼저 연결해 보고 확인하면 훨씬 오래 기억에 남아요! 그래도 지금 바로 볼까요?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRevealModel(false);
                  onUpdateDraft((prev) => ({
                    ...prev,
                    revealedModelAnswer: true,
                  }));
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FFE18A] border-2 border-[#B68411] text-sm font-extrabold text-[#2D2620] cursor-pointer"
              >
                네, 모범 해석 볼래요
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevealModel(false)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border-2 border-[#EAE0D0] text-sm font-bold text-[#4B3F35] cursor-pointer"
              >
                조금 더 생각해 볼게요
              </button>
            </div>
          </div>
        )}

        {draft.hintLevel > 0 && (
          <div className="space-y-2">
            {analysis.stepHints.slice(0, draft.hintLevel).map((hint, idx) => (
              <div
                key={idx}
                className={`rounded-xl border-2 px-4 py-3 text-base sm:text-lg leading-relaxed ${
                  isLavender
                    ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#142754]'
                    : 'bg-[#FFF6DA]/70 border-[#E0B94B] text-[#1E1915]'
                }`}
              >
                <span className={`font-extrabold mr-1.5 ${isLavender ? 'text-[#2D5CA6]' : 'text-[#8A6100]'}`}>
                  힌트 {idx + 1}.
                </span>
                {hint}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Step Interactive Practice Tabs + No-Scroll Quick Page Turn */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveStep('match')}
            className={`dq-btn-3d min-h-[50px] px-3 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeStep === 'match'
                ? isLavender
                  ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#211442]'
                  : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                : isLavender
                  ? 'bg-white border-[#CFCBE8] text-[#3F3D6B] hover:border-[#6A52A3]'
                  : 'bg-white border-[#EAE0D0] text-[#4B3F35] hover:border-[#9B785D]'
            }`}
          >
            <Link2 className="w-4 h-4 shrink-0" />
            <span>A. 뜻 맞추기</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('role')}
            className={`dq-btn-3d min-h-[50px] px-3 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeStep === 'role'
                ? 'bg-[#E6F4FC] border-[#3E85B3] text-[#133A52]'
                : isLavender
                  ? 'bg-white border-[#CFCBE8] text-[#3F3D6B] hover:border-[#3E85B3]'
                  : 'bg-white border-[#EAE0D0] text-[#4B3F35] hover:border-[#9B785D]'
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span>B. 성분 (선택)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('assemble')}
            className={`dq-btn-3d min-h-[50px] px-3 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeStep === 'assemble'
                ? isLavender
                  ? 'bg-[#E2E6FD] border-[#5663C2] text-[#1C2361]'
                  : 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                : isLavender
                  ? 'bg-white border-[#CFCBE8] text-[#3F3D6B] hover:border-[#5663C2]'
                  : 'bg-white border-[#EAE0D0] text-[#4B3F35] hover:border-[#9B785D]'
            }`}
          >
            <Puzzle className="w-4 h-4 shrink-0" />
            <span>C. 해석 조립</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={activeStep === 'match'}
            onClick={() =>
              setActiveStep(activeStep === 'assemble' ? 'role' : 'match')
            }
            aria-label="이전 해석 단계"
            className="w-11 h-12 rounded-xl border-2 border-[#E5E5E5] bg-white text-[#4B4B4B] hover:border-[#1CB0F6] disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={activeStep === 'assemble'}
            onClick={() =>
              setActiveStep(activeStep === 'match' ? 'role' : 'assemble')
            }
            aria-label="다음 해석 단계"
            className="w-11 h-12 rounded-xl border-2 border-[#58CC02] bg-[#D7FFB8] text-[#1E4600] hover:bg-[#58CC02] hover:text-white disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Animated Page-Turn Wrapper for Active Step (match / role / assemble) */}
      <div
        key={`${analysis.questionId}-step-${activeStep}`}
        className={`relative overflow-hidden ${stepAnimClass}`}
      >
        {stepTurnDir !== 'none' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/[0.06] via-white/30 to-transparent rq-page-sheen z-10"
          />
        )}

        {/* STEP 1: Match English Chunk <-> Korean Meaning */}
        {activeStep === 'match' && (
          <div className={`rounded-2xl bg-white border-2 p-4 sm:p-6 space-y-4 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#EAE0D0]'}`}>
            {/* Pinned Active Prompt Bar */}
            {activeChunkForExercise && (
              <div
                className={`rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-3 ${
                  isLavender
                    ? 'bg-[#F4F2FC] border-[#8D7AD6]'
                    : 'bg-[#FFF9EF] border-[#E0B94B]'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className={`text-xs sm:text-sm font-extrabold ${isLavender ? 'text-[#5B48A3]' : 'text-[#8C6445]'}`}>
                    지금 고를 영어 조각
                  </div>
                  <div className={`text-xl sm:text-2xl font-extrabold ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
                    “{activeChunkForExercise.english}”
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ttsAvailable && (
                    <>
                      <button
                        type="button"
                        onClick={() => speakEnglish(activeChunkForExercise.english, 0.94)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border-2 border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1 cursor-pointer hover:bg-[#DDF4FF]"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>발음 듣기</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => speakEnglish(activeChunkForExercise.english, 0.78)}
                        title="천천히 0.8배속 듣기"
                        className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#84D8FF] text-xs font-extrabold text-[#143752] cursor-pointer hover:bg-[#F2FAFF]"
                      >
                        0.8x
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setMeaningHelpChunkId((prev) =>
                        prev === activeChunkForExercise.id ? null : activeChunkForExercise.id,
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border-2 border-[#E0B94B] text-xs sm:text-sm font-extrabold text-[#573B00] inline-flex items-center gap-1 cursor-pointer hover:bg-[#FFF6DA]"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>뜻 살짝 힌트</span>
                  </button>
                </div>
              </div>
            )}

            {isAllMatched && (
              <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4 flex flex-wrap items-center justify-between gap-3 text-sm sm:text-base font-extrabold text-[#1E4600]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#46A302] shrink-0" />
                  <span>
                    모든 뜻 연결 완료! 바로 아래 <strong>3단계(정답 고르기)로 이동</strong>하거나 2·3단계로 더 연습할 수 있어요!
                  </span>
                </div>
              </div>
            )}

            {matchFeedback && (
              <div
                className={`rounded-xl border-2 px-4 py-3 text-base font-bold ${
                  matchFeedback.type === 'good'
                    ? 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                    : matchFeedback.type === 'retry'
                      ? 'bg-[#FDECE7] border-[#C85B3F] text-[#5E1F10]'
                      : 'bg-[#E6F4FC] border-[#3E85B3] text-[#133A52]'
                }`}
              >
                {matchFeedback.text}
              </div>
            )}

            {/* Shuffled Korean Meaning Choices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shuffledKoChunks.map((item) => {
                const alreadyLinked = draft.matchedMeanings[item.id] === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={alreadyLinked}
                    onClick={() => handlePairMeaning(item.id)}
                    className={`min-h-[58px] text-left px-4 py-3.5 rounded-2xl border-2 text-base sm:text-lg font-extrabold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      alreadyLinked
                        ? 'bg-[#EAF5E4]/75 border-[#4E8336]/55 text-[#2E571C] opacity-80 cursor-default'
                        : 'dq-btn-3d bg-[#FFFDF8] border-[#EAE0D0] hover:border-[#C9961A] text-[#1E1915]'
                    }`}
                  >
                    <span>{item.meaningKo}</span>
                    {alreadyLinked && <Check className="w-5 h-5 shrink-0 text-[#4E8336]" />}
                  </button>
                );
              })}
            </div>

            {/* Linked Pairs with explicit X button to unlink */}
            {correctMatchesCount > 0 && (
              <div className="pt-3 border-t border-[#F2ECE1] space-y-2.5">
                <div className="text-sm font-extrabold text-[#3A6A24]">
                  연결 완료된 짝 (X를 누르면 연결을 해제할 수 있어요)
                </div>
                <div className="space-y-2">
                  {chunks
                    .filter((c) => draft.matchedMeanings[c.id] === c.id)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-[#EAF5E4]/65 border border-[#4E8336]/50 px-4 py-3 flex items-center justify-between gap-2 text-base"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-[#1E1915]">{c.english}</span>
                          <span className="mx-2 text-[#4E8336]">↔</span>
                          <span className="font-bold text-[#1A390D]">{c.meaningKo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlinkMeaning(c.id)}
                          aria-label={`${c.english} 의미 연결 취소`}
                          title="연결 취소 (X)"
                          className="w-9 h-9 rounded-lg bg-white border border-[#B5D6A7] text-[#5C4D42] hover:bg-[#F39A83]/25 hover:text-[#7A2D1C] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setActiveStep('role')}
                className="dq-btn-3d min-h-[48px] px-4 py-2.5 rounded-2xl bg-white border-2 border-[#72B8DB] text-sm sm:text-base font-extrabold text-[#133A52] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>B. 문장 성분 (선택)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('assemble')}
                className="dq-btn-3d min-h-[50px] px-5 py-2.5 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] text-base font-extrabold text-[#1E4600] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>C. 바로 해석 조립하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Identify Sentence Constituents */}
        {activeStep === 'role' && (
          <div className="rounded-2xl bg-white border-2 border-[#EAE0D0] p-4 sm:p-6 space-y-4">
            {/* Active Chunk Banner + Quick Chunk Switcher */}
            {activeChunkForExercise && (
              <div className="rounded-2xl border-2 border-[#72B8DB] bg-[#F2FAFE] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold text-[#1B5780]">
                    이 조각은 문장에서 어떤 역할을 할까요?
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#102438]">
                    “{activeChunkForExercise.english}”
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {ttsAvailable && (
                    <button
                      type="button"
                      onClick={() => speakEnglish(activeChunkForExercise.english)}
                      aria-label="조각 발음 듣기"
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#72B8DB] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>듣기</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStepChunkCycle(-1)}
                    aria-label="이전 조각"
                    className="w-9 h-9 rounded-xl bg-white border border-[#72B8DB] text-[#143752] flex items-center justify-center cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepChunkCycle(1)}
                    aria-label="다음 조각"
                    className="w-9 h-9 rounded-xl bg-white border border-[#72B8DB] text-[#143752] flex items-center justify-center cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {roleFeedback && (
              <div
                className={`rounded-xl border-2 px-4 py-3 text-base font-bold ${
                  roleFeedback.type === 'good'
                    ? 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                    : 'bg-[#FDECE7] border-[#C85B3F] text-[#5E1F10]'
                }`}
              >
                {roleFeedback.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableRoles.map((role) => {
                const meta = CHUNK_ROLE_META[role];
                const isSolvedAsThis =
                  activeChunkForExercise &&
                  draft.roleSelections[activeChunkForExercise.id] === role;
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!activeChunkForExercise}
                    onClick={() => handlePickRole(role)}
                    className={`dq-btn-3d text-left p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      isSolvedAsThis
                        ? `${meta.activeBg} ${meta.activeBorder} ${meta.activeText} ring-2 ring-[#3E85B3]/30`
                        : 'bg-[#FFFDF8] border-[#EAE0D0] hover:border-[#3E85B3] text-[#1E1915]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-3 py-1 rounded-xl text-sm sm:text-base font-extrabold border ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                      >
                        {meta.labelKo}
                      </span>
                      {isSolvedAsThis && <CheckCircle2 className="w-5 h-5 text-[#4E8336]" />}
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-[#1E1915] mt-2">
                      {ROLE_KID_PROMPT[role]}
                    </div>
                    <p className="text-xs sm:text-sm text-[#4B3F35] mt-1 leading-relaxed">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {correctRolesCount > 0 && (
              <div className="pt-2.5 border-t border-[#F2ECE1] flex flex-wrap gap-2">
                {chunks
                  .filter((c) => draft.roleSelections[c.id] === c.role)
                  .map((c) => {
                    const meta = CHUNK_ROLE_META[c.role];
                    return (
                      <div
                        key={c.id}
                        className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-bold ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                      >
                        <span>{meta.shortTag}</span>
                        <span className="max-w-[180px] truncate">{c.english}</span>
                        <button
                          type="button"
                          onClick={() => handleClearRole(c.id)}
                          aria-label={`${c.english} 성분 표시 취소`}
                          className="w-7 h-7 rounded-lg bg-white/80 hover:bg-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={() => setActiveStep('match')}
                className="min-h-[48px] px-4 py-2.5 rounded-xl border-2 border-[#EAE0D0] bg-[#FFF9EF] text-sm sm:text-base font-bold text-[#4B3F35] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>A. 뜻 맞추기로</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('assemble')}
                className="dq-btn-3d min-h-[50px] px-5 py-2.5 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] text-base font-extrabold text-[#1E4600] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>C. 해석 조립하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Assemble Korean Translation & Self-Check */}
        {activeStep === 'assemble' && (
          <div className={`rounded-2xl bg-white border-2 p-4 sm:p-6 space-y-4 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#EAE0D0]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className={`text-lg sm:text-xl font-extrabold ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
                  자연스러운 우리말 어순으로 조립해 보세요!
                </div>
                <div className="rounded-xl bg-[#FFF9EF] border border-[#E0B94B] px-3.5 py-2 text-sm sm:text-base font-bold text-[#573B00]">
                  우리말 어순 팁: [주어(~은/는)] → [꾸미는 말(언제·어디서)] → [목적어(~을/를)] → [동사(~하다)]
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEnglishCueOnTiles((v) => !v)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                  showEnglishCueOnTiles
                    ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                    : 'bg-white border-[#E5E5E5] text-[#5C4D42]'
                }`}
              >
                {showEnglishCueOnTiles ? '영어 짝 표시 ON' : '영어 짝 표시 OFF'}
              </button>
            </div>

            {/* Answer Drop Zone */}
            <div
              className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
                isLavender
                  ? 'bg-[#F8F7FF] border-[#CFCBE8]'
                  : 'bg-[#FAFAFA] border-[#E5E5E5]'
              }`}
            >
              <div className={`flex items-center justify-between text-sm sm:text-base font-extrabold ${isLavender ? 'text-[#2D2A5E]' : 'text-[#4B3F35]'}`}>
                <span>내가 조립한 한국어 해석 ({placedKoIds.length}/{chunks.length})</span>
                {placedKoIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateDraft((prev) => ({
                        ...prev,
                        koAssemblyOrder: [],
                        koAssemblyChecked: false,
                      }))
                    }
                    className={`text-sm font-extrabold hover:underline cursor-pointer ${
                      isLavender ? 'text-[#5B48A3]' : 'text-[#1CB0F6]'
                    }`}
                  >
                    조립 비우기
                  </button>
                )}
              </div>

              {placedKoIds.length === 0 ? (
                <div
                  className={`min-h-[92px] flex flex-col justify-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed ${
                    isLavender
                      ? 'text-[#4C4C78] border-[#C6BEE8] bg-white/70'
                      : 'text-[#777777] border-[#E5E5E5] bg-white'
                  }`}
                >
                  <div className="border-b-2 border-[#E5E5E5] pb-2 text-center text-base font-bold">
                    아래 단어 타일을 순서대로 눌러 문장을 완성해 보세요
                  </div>
                  <div className="border-b-2 border-[#EFEFEF] h-4" />
                </div>
              ) : (
                <div className="space-y-2.5 bg-white rounded-xl border-2 border-[#E5E5E5] p-3.5">
                  {placedKoIds.map((chunkId, pos) => {
                    const item = chunkById[chunkId];
                    if (!item) return null;
                    const isPosRight =
                      draft.koAssemblyChecked && expectedKoOrderIds[pos] === chunkId;
                    const isPosAdjust =
                      draft.koAssemblyChecked && expectedKoOrderIds[pos] !== chunkId;
                    return (
                      <div
                        key={chunkId}
                        draggable
                        onDragStart={() => setDraggedKoChunkId(chunkId)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropKoToken(pos);
                        }}
                        className={`dq-btn-3d px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-2 text-base sm:text-lg ${
                          isPosRight
                            ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                            : isPosAdjust
                              ? 'bg-[#FFF6DA] border-[#E0B94B] text-[#4C3600]'
                              : isLavender
                                ? 'bg-[#F4F2FC] border-[#7963A8] text-[#14132E]'
                                : 'bg-white border-[#D6D6D6] text-[#1E1915]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg font-mono text-sm font-extrabold shrink-0 ${
                              isPosRight
                                ? 'bg-[#58CC02] text-white'
                                : isLavender
                                  ? 'bg-[#C9B9E8] text-[#211442]'
                                  : 'bg-[#DDF4FF] text-[#143752]'
                            }`}
                          >
                            {pos + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-extrabold block">{item.meaningKo}</span>
                            {showEnglishCueOnTiles && (
                              <span className="text-xs sm:text-sm font-semibold opacity-75 block">
                                ({item.english})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={pos === 0}
                            onClick={() => handleMoveKoToken(pos, -1)}
                            aria-label="위로 이동"
                            className={`w-9 h-9 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                              isLavender
                                ? 'bg-white border-[#C9C2E8]'
                                : 'bg-[#FAFAFA] border-[#E5E5E5]'
                            }`}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={pos === placedKoIds.length - 1}
                            onClick={() => handleMoveKoToken(pos, 1)}
                            aria-label="아래로 이동"
                            className={`w-9 h-9 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                              isLavender
                                ? 'bg-white border-[#C9C2E8]'
                                : 'bg-[#FAFAFA] border-[#E5E5E5]'
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleKoToken(chunkId)}
                            aria-label="한국어 조각 취소"
                            className="w-9 h-9 rounded-lg bg-white border border-[#E5E5E5] text-[#5C4D42] hover:bg-[#FFDFE0] hover:text-[#9A1B1B] flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {draft.koAssemblyChecked && !isKoOrderExact && (
              <div className="rounded-xl bg-[#FFF6DA] border-2 border-[#E0B94B] p-3.5 flex flex-wrap items-center justify-between gap-2.5 text-sm sm:text-base text-[#4C3600]">
                <span>우리말 어순과 조금 다른 조각이 있어요. 한 번에 자연스러운 순서로 맞춰 볼까요?</span>
                <button
                  type="button"
                  onClick={handleAutoAlignNaturalOrder}
                  className="dq-btn-3d min-h-[42px] px-4 py-2 rounded-xl bg-[#FFE18A] border-2 border-[#B68411] text-sm font-extrabold text-[#2D2620] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>자연스러운 순서로 정렬해보기</span>
                </button>
              </div>
            )}

            {/* Word-Bank 3D Tiles */}
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              {shuffledKoChunks.map((item) => {
                const isPlaced = placedKoIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable={!isPlaced}
                    onDragStart={() => setDraggedKoChunkId(item.id)}
                    onClick={() => handleToggleKoToken(item.id)}
                    title={isPlaced ? '눌러서 다시 내려놓기' : '눌러서 위 문장에 끼우기'}
                    className={`min-h-[56px] px-4 py-2.5 rounded-2xl border-2 text-base sm:text-lg font-extrabold transition-all cursor-pointer inline-flex flex-col items-start justify-center gap-0.5 ${
                      isPlaced
                        ? isLavender
                          ? 'bg-[#E5E2F4] border-[#D6D2EC] text-[#8E8AB8] shadow-none'
                          : 'bg-[#E5E5E5] border-[#E5E5E5] text-[#B0B0B0] shadow-none'
                        : isLavender
                          ? 'dq-btn-3d bg-white border-[#CFCBE8] hover:border-[#6A52A3] text-[#14132E]'
                          : 'dq-btn-3d bg-white border-[#E5E5E5] hover:border-[#1CB0F6] text-[#1E1915]'
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1.5 ${isPlaced ? 'line-through decoration-1' : ''}`}>
                      <span>{item.meaningKo}</span>
                      {isPlaced && <X className="w-4 h-4 shrink-0" />}
                    </span>
                    {showEnglishCueOnTiles && !isPlaced && (
                      <span className="text-xs font-semibold opacity-70">
                        {item.english}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Optional Student Free-Text Interpretation */}
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor={`ko-summary-${analysis.questionId}`}
                className={`text-sm sm:text-base font-bold block ${isLavender ? 'text-[#3F3D6B]' : 'text-[#4B3F35]'}`}
              >
                내가 이해한 핵심 뜻 한 줄로 써 보기 (선택 · 내 말로 풀어도 좋아요)
              </label>
              <input
                id={`ko-summary-${analysis.questionId}`}
                type="text"
                value={draft.koSummaryDraft}
                onChange={(e) =>
                  onUpdateDraft((prev) => ({
                    ...prev,
                    koSummaryDraft: e.target.value,
                  }))
                }
                placeholder="예: 센터 재개장이 전기 문제 때문에 연기된다는 안내"
                className={`w-full px-4 py-3 rounded-xl border-2 text-base focus:outline-none ${
                  isLavender
                    ? 'border-[#CFCBE8] bg-[#F8F7FF] text-[#14132E] focus:border-[#6A52A3]'
                    : 'border-[#EAE0D0] bg-[#FFFDF8] text-[#1E1915] focus:border-[#4E8336]'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setActiveStep('match')}
                className={`min-h-[48px] px-4 py-2.5 rounded-xl border-2 text-sm sm:text-base font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  isLavender
                    ? 'border-[#C9C2E8] bg-[#F4F2FC] text-[#3F3D6B]'
                    : 'border-[#EAE0D0] bg-[#FFF9EF] text-[#4B3F35]'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>A. 뜻 맞추기로</span>
              </button>

              <button
                type="button"
                disabled={!isAllKoPlaced && draft.koSummaryDraft.trim().length < 2}
                onClick={handleCheckTranslation}
                className="dq-btn-3d min-h-[54px] px-7 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-base sm:text-lg font-extrabold disabled:bg-[#E5E5E5] disabled:border-[#D4D4D4] disabled:text-[#999999] disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>내 해석 확인하기</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Translation Comparison */}
      {draft.revealedModelAnswer && (
        <div className="rounded-2xl bg-white border-2 border-[#4E8336] p-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-base font-extrabold text-[#1A390D]">
              <CheckCircle2 className="w-5 h-5 text-[#4E8336]" />
              <span>모범 해석과 비교해 보기</span>
            </div>
            {draft.koAssemblyChecked && (
              <span className="text-sm sm:text-base font-extrabold text-[#3A6A24]">
                {isKoOrderExact
                  ? '우리말 어순까지 완벽해요!'
                  : keywordMatchCount >= 2
                    ? '핵심 의미가 아주 잘 담겼어요!'
                    : '조립한 뜻의 흐름을 아래 모범 해석과 비교해 보세요!'}
              </span>
            )}
          </div>

          {draft.koSummaryDraft.trim() && (
            <div className="rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] p-3.5 text-base space-y-1">
              <div className="font-extrabold text-[#4B3F35]">내가 적은 해석</div>
              <p className="text-[#1E1915] font-medium">{draft.koSummaryDraft}</p>
            </div>
          )}

          <div className="rounded-xl bg-[#EAF5E4]/75 border border-[#4E8336]/45 p-4 space-y-1.5">
            <div className="text-sm font-extrabold text-[#1A390D]">자연스러운 모범 해석</div>
            <p className="text-lg font-bold text-[#142B0E] leading-relaxed">
              {analysis.modelTranslationKo}
            </p>
          </div>

          <div className="rounded-xl bg-[#FFFDF8] border border-[#EAE0D0] p-4 space-y-1">
            <div className="text-sm font-extrabold text-[#8C6445]">
              영어 어순 그대로 끊어 읽기 (직독직해)
            </div>
            <p className="text-base text-[#2D2620] leading-relaxed">
              {analysis.literalFlowKo}
            </p>
          </div>

          <div className="rounded-xl bg-[#F1ECFA]/70 border border-[#785EA8]/45 p-4 space-y-1">
            <div className="text-sm font-extrabold text-[#2F1F52]">
              이 문장의 핵심 구조 정리
            </div>
            <p className="text-base text-[#241642] leading-relaxed">
              {analysis.grammarDeepDive}
            </p>
          </div>

          {onGoToBoss && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onGoToBoss}
                className="dq-btn-3d min-h-[52px] px-6 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-base font-extrabold text-white inline-flex items-center gap-2 cursor-pointer"
              >
                <span>이제 문제 풀고 답 고르기</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
