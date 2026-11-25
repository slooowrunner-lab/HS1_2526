import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  HelpCircle,
  Lightbulb,
  Link2,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Tag,
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

interface SentenceChunkWorkshopProps {
  analysis: QuestionSentenceAnalysis;
  draft: QuestionLabDraft;
  onUpdateDraft: (updater: (prev: QuestionLabDraft) => QuestionLabDraft) => void;
  onClaimSentenceXp: () => void;
  islandTheme?: 'spring' | 'lavender';
}

type WorkshopStep = 'match' | 'role' | 'assemble';

const ROLE_ORDER: ChunkRole[] = ['S', 'V', 'O', 'C', 'M', 'CONJ'];

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
    return '이 조각은 "~은/는/이/가"에 해당하는 문장의 주인공이에요. 누구 또는 무엇이 동사 행동을 하는지 보세요!';
  }
  if (actual === 'O') {
    return '이 조각은 동사의 대상("~을/를" 또는 "~에게")이에요. 동사 바로 뒤에서 무엇을/누구에게를 받고 있는지 살펴보세요.';
  }
  if (actual === 'C') {
    return '이 조각은 주어나 목적어의 상태·행동을 보충 설명하는 말이에요! 주어=보어 관계나 목적어가 하는 행동인지 보세요.';
  }
  if (actual === 'CONJ') {
    return '이 조각은 문장 앞뒤의 논리(반전, 예시, 결과 등)를 이어주는 연결어예요!';
  }
  if (chosen === 'O' || chosen === 'C') {
    return '이 조각은 전치사나 접속사로 시작해 때·장소·이유·방법을 덧붙여 주는 수식어(M)예요!';
  }
  return '시간·장소·이유·방법을 더해주거나 명사를 뒤에서 꾸며주는 수식어(M)인지 다시 살펴보세요!';
}

export const SentenceChunkWorkshop: React.FC<SentenceChunkWorkshopProps> = ({
  analysis,
  draft,
  onUpdateDraft,
  onClaimSentenceXp,
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
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
  const [draggedKoChunkId, setDraggedKoChunkId] = useState<string | null>(null);
  const [previousSnapshot, setPreviousSnapshot] =
    useState<QuestionLabDraft | null>(null);

  const chunks = analysis.chunks;
  const chunkById = useMemo(
    () => Object.fromEntries(chunks.map((c) => [c.id, c])),
    [chunks],
  );

  // Only expose grammatical roles that actually exist in THIS sentence
  const availableRoles = useMemo(() => {
    const present = new Set(chunks.map((c) => c.role));
    return ROLE_ORDER.filter((r) => present.has(r));
  }, [chunks]);

  // Shuffled Korean meanings for Match & Assemble steps
  const shuffledKoChunks = useMemo(() => {
    const list = [...chunks];
    if (list.length <= 1) return list;
    const seed = hashSeed(analysis.questionId);
    // Deterministic Fisher-Yates shuffle that avoids original order
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = (seed + i * 7) % (i + 1);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }, [chunks, analysis.questionId]);

  // Expected Korean order (sorted by koOrderIndex)
  const expectedKoOrderIds = useMemo(
    () => [...chunks].sort((a, b) => a.koOrderIndex - b.koOrderIndex).map((c) => c.id),
    [chunks],
  );

  const selectedChunk = draft.selectedChunkId
    ? chunkById[draft.selectedChunkId] ?? null
    : null;

  // Derived progress stats
  const correctMatchesCount = useMemo(
    () =>
      chunks.filter((c) => draft.matchedMeanings[c.id] === c.id).length,
    [chunks, draft.matchedMeanings],
  );
  const correctRolesCount = useMemo(
    () =>
      chunks.filter((c) => draft.roleSelections[c.id] === c.role).length,
    [chunks, draft.roleSelections],
  );
  const placedKoIds = useMemo(
    () => draft.koAssemblyOrder.filter((id) => Boolean(chunkById[id])),
    [draft.koAssemblyOrder, chunkById],
  );
  const isAllMatched = correctMatchesCount === chunks.length;
  const isAllRolesFound = correctRolesCount === chunks.length;
  const isAllKoPlaced = placedKoIds.length === chunks.length;

  // Core meaning keyword check for free-text summary
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

  // --- Handlers ---
  const handleSelectChunk = (chunkId: string) => {
    setMatchFeedback(null);
    setRoleFeedback(null);
    onUpdateDraft((prev) => ({
      ...prev,
      selectedChunkId: prev.selectedChunkId === chunkId ? null : chunkId,
    }));
  };

  const handleDeselectChunk = () => {
    onUpdateDraft((prev) => ({
      ...prev,
      selectedChunkId: null,
    }));
  };

  const handlePairMeaning = (meaningChunkId: string) => {
    if (!selectedChunk) {
      setMatchFeedback({
        type: 'info',
        text: '먼저 위 영어 문장에서 뜻이 궁금한 영어 조각을 하나 눌러 선택해 주세요!',
      });
      return;
    }

    const isExactMatch = selectedChunk.id === meaningChunkId;
    if (isExactMatch) {
      playSuccessChime();
      setMatchFeedback({
        type: 'good',
        text: `"${selectedChunk.english}" ↔ "${chunkById[meaningChunkId].meaningKo}" 연결 성공!`,
      });
      onUpdateDraft((prev) => {
        const nextMatched = {
          ...prev.matchedMeanings,
          [selectedChunk.id]: meaningChunkId,
        };
        // Auto-advance selection to next unmatched chunk for smooth flow
        const nextUnmatched = chunks.find(
          (c) => c.id !== selectedChunk.id && nextMatched[c.id] !== c.id,
        );
        return {
          ...prev,
          matchedMeanings: nextMatched,
          selectedChunkId: nextUnmatched ? nextUnmatched.id : selectedChunk.id,
        };
      });
    } else {
      playTryAgainSoft();
      setMatchFeedback({
        type: 'retry',
        text: `조금 달라요! "${selectedChunk.english}"의 뜻이 맞는지 다시 생각하거나 '이게 무슨 뜻이지?'를 눌러 확인해 보세요.`,
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
    if (!selectedChunk) return;
    if (chosenRole === selectedChunk.role) {
      playSuccessChime();
      const roleMeta = CHUNK_ROLE_META[chosenRole];
      setRoleFeedback({
        type: 'good',
        text: `정확해요! "${selectedChunk.english}"는 ${roleMeta.labelKo} 역할이에요.`,
      });
      onUpdateDraft((prev) => {
        const nextRoles = {
          ...prev.roleSelections,
          [selectedChunk.id]: chosenRole,
        };
        const nextUntagged = chunks.find(
          (c) => c.id !== selectedChunk.id && nextRoles[c.id] !== c.role,
        );
        return {
          ...prev,
          roleSelections: nextRoles,
          selectedChunkId: nextUntagged ? nextUntagged.id : selectedChunk.id,
        };
      });
    } else {
      playTryAgainSoft();
      setRoleFeedback({
        type: 'retry',
        text: getWrongRoleHint(chosenRole, selectedChunk.role),
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
      // Preserve Stage 1 Flow builder draft & idempotent XP flag!
      flowOrderDraft: prev.flowOrderDraft,
      flowOrderChecked: prev.flowOrderChecked,
      flowGuessDraft: prev.flowGuessDraft,
      flowGuessChecked: prev.flowGuessChecked,
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
      sentenceXpClaimed: prev.sentenceXpClaimed || previousSnapshot.sentenceXpClaimed,
      sentenceCompleted: prev.sentenceCompleted || previousSnapshot.sentenceCompleted,
    }));
    setPreviousSnapshot(null);
  };

  return (
    <div
      className={`rounded-3xl border-2 p-4 sm:p-5 space-y-4 ${
        isLavender
          ? 'border-[#95AFE8] bg-[#F2F4FD]'
          : 'border-[#A8DCC8] bg-[#F7FCF9]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${
              isLavender ? 'text-[#4B3B94]' : 'text-[#1D5E48]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>② 초보자 맞춤형 의미 단위 해석 (+20 XP · 힌트 무료!)</span>
          </div>
          <h3 className={`text-sm sm:text-base font-extrabold mt-0.5 ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
            시험지 핵심 문장을 덩어리씩 끊어서 스스로 해석해 봐요
          </h3>
          <p className={`text-xs mt-0.5 ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}>
            영어 조각을 눌러 탐구하고, 뜻 연결 → 문장 성분 → 한국어 조립 순으로 익혀요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
          <span
            className={`px-2.5 py-1 rounded-xl border ${
              isAllMatched
                ? 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                : isLavender
                  ? 'bg-white border-[#C9C2E8] text-[#4C497A]'
                  : 'bg-white border-[#EAE0D0] text-[#5C4D42]'
            }`}
          >
            뜻 {correctMatchesCount}/{chunks.length}
          </span>
          <span
            className={`px-2.5 py-1 rounded-xl border ${
              isAllRolesFound
                ? 'bg-[#E6F4FC] border-[#3E85B3] text-[#133A52]'
                : isLavender
                  ? 'bg-white border-[#C9C2E8] text-[#4C497A]'
                  : 'bg-white border-[#EAE0D0] text-[#5C4D42]'
            }`}
          >
            성분 {correctRolesCount}/{chunks.length}
          </span>
          {draft.sentenceCompleted && (
            <span
              className={`px-2.5 py-1 rounded-xl border inline-flex items-center gap-1 ${
                isLavender
                  ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#211442]'
                  : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isLavender ? 'text-[#4B3B94]' : 'text-[#4C7A34]'}`} />
              완료
            </span>
          )}
        </div>
      </div>

      {/* Interactive Sentence Chunks Display */}
      <div className={`rounded-2xl bg-white border-2 p-4 space-y-3 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#EAE0D0]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs font-extrabold ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}>
            원문 핵심 문장 — 궁금한 영어 조각을 눌러 보세요
          </span>
          {draft.structureOverlayVisible && (
            <div className="flex flex-wrap items-center gap-1.5">
              {availableRoles.map((r) => {
                const meta = CHUNK_ROLE_META[r];
                return (
                  <span
                    key={r}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-extrabold ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                  >
                    {meta.badgeText}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-stretch gap-2.5 leading-relaxed">
          {chunks.map((chunk) => {
            const isSelected = draft.selectedChunkId === chunk.id;
            const roleSolved = draft.roleSelections[chunk.id] === chunk.role;
            const meaningSolved = draft.matchedMeanings[chunk.id] === chunk.id;
            const showRoleStyle =
              draft.structureOverlayVisible || roleSolved;
            const roleMeta = CHUNK_ROLE_META[chunk.role];

            return (
              <div
                key={chunk.id}
                className={`relative rounded-2xl border-2 transition-all flex items-center gap-1.5 px-3 py-2 ${
                  showRoleStyle
                    ? `${roleMeta.activeBg} ${roleMeta.activeBorder} ${roleMeta.activeText}`
                    : isSelected
                      ? isLavender
                        ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#1E1442]'
                        : 'bg-[#FFE18A]/45 border-[#C9961A] text-[#2D2620]'
                      : isLavender
                        ? 'bg-[#F8F7FF] border-[#C9C6E8] hover:border-[#6A52A3] text-[#1D1B42]'
                        : 'bg-[#FFFDF8] border-[#DFD3C1] hover:border-[#9B785D] text-[#2D2620]'
                } ${isSelected ? (isLavender ? 'ring-2 ring-[#8D7AD6]/50 shadow-xs' : 'ring-2 ring-[#C9961A]/60 shadow-xs') : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectChunk(chunk.id)}
                  className="text-left flex flex-col gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-tight ${
                        showRoleStyle
                          ? `${roleMeta.pillBg} ${roleMeta.activeText}`
                          : isLavender
                            ? 'bg-[#E5E2F6] text-[#4C477A]'
                            : 'bg-[#EAE0D0] text-[#5C4D42]'
                      }`}
                    >
                      {showRoleStyle ? roleMeta.badgeText : '? 성분'}
                    </span>
                    {meaningSolved && (
                      <span className="text-[10px] font-extrabold text-[#2E6B1E] inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3" />뜻 연결
                      </span>
                    )}
                  </div>
                  <span className="text-sm sm:text-base font-bold leading-snug">
                    {chunk.english}
                  </span>
                  {(meaningSolved || meaningHelpChunkId === chunk.id) && (
                    <span className="text-xs font-semibold opacity-90">
                      → {chunk.meaningKo}
                    </span>
                  )}
                </button>

                {isSelected && (
                  <button
                    type="button"
                    onClick={handleDeselectChunk}
                    aria-label="조각 선택 취소"
                    title="선택 취소 (X)"
                    className="w-7 h-7 rounded-lg bg-white/90 border border-[#C9B8A3] text-[#5C4D42] hover:bg-[#F39A83]/30 hover:text-[#7A2D1C] flex items-center justify-center shrink-0 cursor-pointer self-start"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Chunk Explorer Card */}
      {selectedChunk && (
        <div
          className={`rounded-2xl bg-white border-2 p-4 space-y-2.5 ${
            isLavender ? 'border-[#7963A8]/70' : 'border-[#C9961A]/60'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-extrabold ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'}`}>
                  선택한 조각 탐구
                </span>
                {(draft.structureOverlayVisible ||
                  draft.roleSelections[selectedChunk.id] === selectedChunk.role) && (
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${CHUNK_ROLE_META[selectedChunk.role].activeBg} ${CHUNK_ROLE_META[selectedChunk.role].activeBorder} ${CHUNK_ROLE_META[selectedChunk.role].activeText}`}
                  >
                    {selectedChunk.roleLabelKo}
                  </span>
                )}
              </div>
              <div className={`text-sm sm:text-base font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                “{selectedChunk.english}”
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeselectChunk}
              aria-label="조각 탐구 닫기"
              className={`w-8 h-8 rounded-xl border hover:bg-[#F39A83]/25 flex items-center justify-center shrink-0 cursor-pointer ${
                isLavender
                  ? 'bg-[#F4F2FC] border-[#C9C2E8] text-[#4E4A7D]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div
              className={`rounded-xl border p-2.5 space-y-1 ${
                isLavender
                  ? 'bg-[#F4F2FC] border-[#D7D0F0]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0]'
              }`}
            >
              <div className={`font-extrabold ${isLavender ? 'text-[#4E3B8C]' : 'text-[#7B5600]'}`}>
                이렇게 끊어 읽어요
              </div>
              <p className={`leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>{selectedChunk.howToRead}</p>
            </div>
            <div
              className={`rounded-xl border p-2.5 space-y-1 ${
                isLavender
                  ? 'bg-[#EEF5FD] border-[#BCD4F2]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0]'
              }`}
            >
              <div className={`font-extrabold ${isLavender ? 'text-[#2B599C]' : 'text-[#1D5E48]'}`}>
                앞뒤 조각과 연결
              </div>
              <p className={`leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>{selectedChunk.relationNote}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#E6F4FC]/60 border border-[#A9DDF5] px-3 py-2 text-xs text-[#133A52]">
            <span className="font-extrabold mr-1.5">생각 질문:</span>
            {selectedChunk.thinkingQuestion}
          </div>

          {(draft.matchedMeanings[selectedChunk.id] === selectedChunk.id ||
            meaningHelpChunkId === selectedChunk.id) && (
            <div className="rounded-xl bg-[#EAF5E4] border border-[#4E8336]/50 px-3 py-2 text-xs text-[#1A390D]">
              <span className="font-extrabold mr-1.5">쉬운 뜻:</span>
              {selectedChunk.meaningKo}
            </div>
          )}

          {selectedChunk.grammarTip && (
            <div>
              <button
                type="button"
                onClick={() => setShowGrammarDetail((v) => !v)}
                className="text-xs font-bold text-[#785EA8] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>추가 문법 설명 {showGrammarDetail ? '접기' : '보기'}</span>
                {showGrammarDetail ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {showGrammarDetail && (
                <div className="mt-1.5 rounded-xl bg-[#F1ECFA] border border-[#785EA8]/40 px-3 py-2 text-xs text-[#2F1F52]">
                  {selectedChunk.grammarTip}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Self-Directed Zero-Penalty Help Toolbar */}
      <div
        className={`rounded-2xl bg-white/90 border p-3 space-y-2.5 ${
          isLavender ? 'border-[#C4CCE8]' : 'border-[#D4EADF]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNextHint}
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
              isLavender
                ? 'bg-[#E7E0FA] border-[#8C77C9] text-[#26184D] hover:bg-[#DDD4FA]'
                : 'bg-[#FFE18A]/55 border-[#D4A72C] text-[#2D2620] hover:bg-[#FFE18A]'
            }`}
          >
            <Lightbulb className={`w-3.5 h-3.5 ${isLavender ? 'text-[#5B48A3]' : 'text-[#9B6B00]'}`} />
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
            onClick={() => {
              const target =
                selectedChunk ??
                chunks.find((c) => draft.matchedMeanings[c.id] !== c.id) ??
                chunks[0];
              if (!target) return;
              onUpdateDraft((prev) => ({
                ...prev,
                selectedChunkId: target.id,
              }));
              setMeaningHelpChunkId(target.id);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#E6F4FC] border border-[#72B8DB] text-xs font-extrabold text-[#133A52] hover:bg-[#CBE8F8] inline-flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>이게 무슨 뜻이지?</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateDraft((prev) => ({
                ...prev,
                structureOverlayVisible: !prev.structureOverlayVisible,
              }))
            }
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
              draft.structureOverlayVisible
                ? 'bg-[#DFD2F4] border-[#785EA8] text-[#2F1F52]'
                : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#785EA8]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{draft.structureOverlayVisible ? '문장 구조 가리기' : '문장 구조 보기'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMatchFeedback(null);
              setRoleFeedback(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-xs font-bold text-[#5C4D42] hover:border-[#9B785D] inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>다시 생각하기</span>
          </button>

          <button
            type="button"
            onClick={handleResetWorkshop}
            className="px-3 py-1.5 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-xs font-bold text-[#5C4D42] hover:border-[#D1684E] inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>다시 연습 (기록 유지)</span>
          </button>

          {previousSnapshot && (
            <button
              type="button"
              onClick={handleRestoreWorkshopSnapshot}
              className="px-3 py-1.5 rounded-xl bg-[#A8DCC8]/40 border border-[#4D9479] text-xs font-extrabold text-[#163B2D] inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>이전 풀이 복구</span>
            </button>
          )}

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
              className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE0D0] text-xs font-bold text-[#6E5E52] hover:border-[#9B785D] inline-flex items-center gap-1 cursor-pointer ml-auto"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>모범 해석 보기</span>
            </button>
          )}
        </div>

        {confirmRevealModel && !draft.revealedModelAnswer && (
          <div className="rounded-xl bg-[#FFF6DA] border border-[#B68411]/50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4C3600]">
            <span>
              조각 뜻이나 성분을 1~2개만 먼저 연결해 보고 확인하면 훨씬 오래 기억에 남아요! 그래도 지금 바로 볼까요?
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
                className="px-2.5 py-1 rounded-lg bg-[#FFE18A] border border-[#B68411] font-extrabold text-[#2D2620] cursor-pointer"
              >
                네, 모범 해석 볼래요
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevealModel(false)}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#EAE0D0] font-bold text-[#5C4D42] cursor-pointer"
              >
                조금 더 생각해 볼게요
              </button>
            </div>
          </div>
        )}

        {draft.hintLevel > 0 && (
          <div className="space-y-1.5">
            {analysis.stepHints.slice(0, draft.hintLevel).map((hint, idx) => (
              <div
                key={idx}
                className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                  isLavender
                    ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#162C5E]'
                    : 'bg-[#FFF6DA]/70 border-[#E0B94B] text-[#2D2620]'
                }`}
              >
                <span className={`font-extrabold mr-1.5 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#8A6100]'}`}>
                  힌트 {idx + 1}.
                </span>
                {hint}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Step Interactive Practice Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveStep('match')}
          className={`px-3 py-2.5 rounded-2xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeStep === 'match'
              ? isLavender
                ? 'bg-[#DFD6FA] border-[#6A52A3] text-[#211442]'
                : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
              : isLavender
                ? 'bg-white border-[#CFCBE8] text-[#4C497A] hover:border-[#6A52A3]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
          }`}
        >
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          <span>1. 의미 연결</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('role')}
          className={`px-3 py-2.5 rounded-2xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeStep === 'role'
              ? 'bg-[#E6F4FC] border-[#3E85B3] text-[#133A52]'
              : isLavender
                ? 'bg-white border-[#CFCBE8] text-[#4C497A] hover:border-[#3E85B3]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
          }`}
        >
          <Tag className="w-3.5 h-3.5 shrink-0" />
          <span>2. 성분 찾기</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('assemble')}
          className={`px-3 py-2.5 rounded-2xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            activeStep === 'assemble'
              ? isLavender
                ? 'bg-[#E2E6FD] border-[#5663C2] text-[#1C2361]'
                : 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
              : isLavender
                ? 'bg-white border-[#CFCBE8] text-[#4C497A] hover:border-[#5663C2]'
                : 'bg-white border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
          }`}
        >
          <Puzzle className="w-3.5 h-3.5 shrink-0" />
          <span>3. 해석 조립</span>
        </button>
      </div>

      {/* STEP 1: Match English Chunk <-> Korean Meaning */}
      {activeStep === 'match' && (
        <div className={`rounded-2xl bg-white border-2 p-4 space-y-3.5 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#EAE0D0]'}`}>
          <div className={`text-xs font-bold ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}>
            {selectedChunk ? (
              <span>
                선택한 영어 조각{' '}
                <strong className={`underline ${isLavender ? 'text-[#1D1B42] decoration-[#6A52A3]' : 'text-[#2D2620] decoration-[#C9961A]'}`}>
                  “{selectedChunk.english}”
                </strong>
                의 알맞은 우리말 뜻을 아래에서 골라 연결해 주세요.
              </span>
            ) : (
              '먼저 위 영어 문장에서 조각을 하나 누른 뒤, 아래 우리말 뜻 카드를 눌러 짝지어 보세요.'
            )}
          </div>

          {matchFeedback && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shuffledKoChunks.map((item) => {
              const alreadyLinked = draft.matchedMeanings[item.id] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={alreadyLinked}
                  onClick={() => handlePairMeaning(item.id)}
                  className={`text-left px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    alreadyLinked
                      ? 'bg-[#EAF5E4]/60 border-[#4E8336]/40 text-[#3B622A] opacity-70 cursor-default'
                      : 'bg-[#FFFDF8] border-[#EAE0D0] hover:border-[#C9961A] text-[#2D2620]'
                  }`}
                >
                  <span>{item.meaningKo}</span>
                  {alreadyLinked && <Check className="w-4 h-4 shrink-0 text-[#4E8336]" />}
                </button>
              );
            })}
          </div>

          {/* Linked Pairs with explicit X button to unlink */}
          {correctMatchesCount > 0 && (
            <div className="pt-2 border-t border-[#F2ECE1] space-y-2">
              <div className="text-[11px] font-extrabold text-[#4E8336]">
                연결 완료된 짝 (X를 누르면 연결을 해제할 수 있어요)
              </div>
              <div className="space-y-1.5">
                {chunks
                  .filter((c) => draft.matchedMeanings[c.id] === c.id)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl bg-[#EAF5E4]/50 border border-[#4E8336]/50 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-[#2D2620]">{c.english}</span>
                        <span className="mx-1.5 text-[#4E8336]">↔</span>
                        <span className="font-semibold text-[#1A390D]">{c.meaningKo}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkMeaning(c.id)}
                        aria-label={`${c.english} 의미 연결 취소`}
                        title="연결 취소 (X)"
                        className="w-8 h-8 rounded-lg bg-white border border-[#B5D6A7] text-[#5C4D42] hover:bg-[#F39A83]/25 hover:text-[#7A2D1C] flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActiveStep('role')}
              className="clay-btn px-4 py-2 rounded-xl bg-[#E6F4FC] border border-[#3E85B3] text-xs font-extrabold text-[#133A52] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>2단계: 문장 성분 찾기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Identify Sentence Constituents (S / V / O / C / M / CONJ) */}
      {activeStep === 'role' && (
        <div className="rounded-2xl bg-white border-2 border-[#EAE0D0] p-4 space-y-3.5">
          <div className="text-xs font-bold text-[#5C4D42]">
            {selectedChunk ? (
              <span>
                선택한 조각{' '}
                <strong className="text-[#2D2620] underline decoration-[#3E85B3]">
                  “{selectedChunk.english}”
                </strong>
                은(는) 문장에서 어떤 역할을 할까요?
              </span>
            ) : (
              '위 문장에서 성분을 확인하고 싶은 영어 조각을 먼저 눌러 주세요.'
            )}
          </div>

          {roleFeedback && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                roleFeedback.type === 'good'
                  ? 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                  : 'bg-[#FDECE7] border-[#C85B3F] text-[#5E1F10]'
              }`}
            >
              {roleFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableRoles.map((role) => {
              const meta = CHUNK_ROLE_META[role];
              const isSolvedAsThis =
                selectedChunk && draft.roleSelections[selectedChunk.id] === role;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={!selectedChunk}
                  onClick={() => handlePickRole(role)}
                  className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    isSolvedAsThis
                      ? `${meta.activeBg} ${meta.activeBorder} ${meta.activeText} ring-2 ring-[#3E85B3]/30`
                      : 'bg-[#FFFDF8] border-[#EAE0D0] hover:border-[#3E85B3] text-[#2D2620]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-extrabold border ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                    >
                      {meta.labelKo}
                    </span>
                    {isSolvedAsThis && <CheckCircle2 className="w-4 h-4 text-[#4E8336]" />}
                  </div>
                  <p className="text-[11px] text-[#5C4D42] mt-1">{meta.description}</p>
                </button>
              );
            })}
          </div>

          {/* Confirmed Role Chips with X button */}
          {correctRolesCount > 0 && (
            <div className="pt-2 border-t border-[#F2ECE1] flex flex-wrap gap-2">
              {chunks
                .filter((c) => draft.roleSelections[c.id] === c.role)
                .map((c) => {
                  const meta = CHUNK_ROLE_META[c.role];
                  return (
                    <div
                      key={c.id}
                      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-xl border text-xs font-bold ${meta.activeBg} ${meta.activeBorder} ${meta.activeText}`}
                    >
                      <span>{meta.shortTag}</span>
                      <span className="max-w-[140px] truncate">{c.english}</span>
                      <button
                        type="button"
                        onClick={() => handleClearRole(c.id)}
                        aria-label={`${c.english} 성분 표시 취소`}
                        className="w-6 h-6 rounded-lg bg-white/75 hover:bg-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setActiveStep('match')}
              className="px-3 py-2 rounded-xl border border-[#EAE0D0] bg-[#FFF9EF] text-xs font-bold text-[#5C4D42] inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>1단계로</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('assemble')}
              className="clay-btn px-4 py-2 rounded-xl bg-[#EAF5E4] border border-[#4E8336] text-xs font-extrabold text-[#1A390D] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>3단계: 해석 조립하기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Assemble Korean Translation & Self-Check */}
      {activeStep === 'assemble' && (
        <div className={`rounded-2xl bg-white border-2 p-4 space-y-3.5 ${isLavender ? 'border-[#CFCBE8]' : 'border-[#EAE0D0]'}`}>
          <div>
            <div className={`text-xs sm:text-sm font-extrabold ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
              영어와 우리말 어순 차이를 생각하며 자연스러운 순서로 조립해 보세요!
            </div>
            <p className={`text-xs mt-0.5 ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
              보통 우리말은 <strong>주어 → 수식어/목적어 → 동사</strong> 순으로 끝나면 자연스러워요.
            </p>
          </div>

          {/* Assembly Drop Zone */}
          <div
            className={`rounded-2xl border-2 p-3.5 space-y-2 ${
              isLavender
                ? 'bg-[#F4F2FC] border-[#C9B9E8]'
                : 'bg-[#FFF9EF] border-[#EAE0D0]'
            }`}
          >
            <div className={`flex items-center justify-between text-xs font-extrabold ${isLavender ? 'text-[#434073]' : 'text-[#5C4D42]'}`}>
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
                  className={`text-xs font-bold hover:underline cursor-pointer ${
                    isLavender ? 'text-[#5B48A3]' : 'text-[#9B785D]'
                  }`}
                >
                  조립 비우기
                </button>
              )}
            </div>

            {placedKoIds.length === 0 ? (
              <div
                className={`py-4 text-center text-xs border border-dashed rounded-xl ${
                  isLavender
                    ? 'text-[#5B5B85] border-[#B7B4DC]'
                    : 'text-[#8B7C6E] border-[#D6C8B4]'
                }`}
              >
                아래 우리말 조각 카드를 차례대로 눌러 문장을 완성해 보세요.
              </div>
            ) : (
              <div className="space-y-1.5">
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
                      className={`px-3 py-2 rounded-xl border-2 flex items-center justify-between gap-2 text-xs sm:text-sm ${
                        isPosRight
                          ? 'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]'
                          : isPosAdjust
                            ? 'bg-[#FFF6DA] border-[#B68411] text-[#4C3600]'
                            : isLavender
                              ? 'bg-white border-[#6A52A3] text-[#1D1B42]'
                              : 'bg-white border-[#C9961A] text-[#2D2620]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-extrabold shrink-0 ${
                            isLavender
                              ? 'bg-[#C9B9E8] text-[#211442]'
                              : 'bg-[#FFE18A] text-[#2D2620]'
                          }`}
                        >
                          {pos + 1}
                        </span>
                        <span className="font-semibold">{item.meaningKo}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={pos === 0}
                          onClick={() => handleMoveKoToken(pos, -1)}
                          aria-label="위로 이동"
                          className={`w-7 h-7 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                            isLavender
                              ? 'bg-[#F4F2FC] border-[#C9C2E8]'
                              : 'bg-[#FFF9EF] border-[#EAE0D0]'
                          }`}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={pos === placedKoIds.length - 1}
                          onClick={() => handleMoveKoToken(pos, 1)}
                          aria-label="아래로 이동"
                          className={`w-7 h-7 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                            isLavender
                              ? 'bg-[#F4F2FC] border-[#C9C2E8]'
                              : 'bg-[#FFF9EF] border-[#EAE0D0]'
                          }`}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleKoToken(chunkId)}
                          aria-label="한국어 조각 취소"
                          className="w-8 h-8 rounded-lg bg-white border border-[#D4C3AE] text-[#5C4D42] hover:bg-[#F39A83]/25 hover:text-[#7A2D1C] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Korean Token Pool */}
          <div className="flex flex-wrap gap-2">
            {shuffledKoChunks.map((item) => {
              const isPlaced = placedKoIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  draggable={!isPlaced}
                  onDragStart={() => setDraggedKoChunkId(item.id)}
                  onClick={() => handleToggleKoToken(item.id)}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isPlaced
                      ? isLavender
                        ? 'bg-[#E5DFFA] border-[#6A52A3] text-[#211442]'
                        : 'bg-[#FFE18A]/45 border-[#C9961A] text-[#2D2620]'
                      : isLavender
                        ? 'bg-white border-[#CFCBE8] hover:border-[#6A52A3] text-[#1D1B42]'
                        : 'bg-white border-[#EAE0D0] hover:border-[#4E8336] text-[#2D2620]'
                  }`}
                >
                  <span>{item.meaningKo}</span>
                  {isPlaced && <X className="w-3.5 h-3.5 text-[#7A2D1C]" />}
                </button>
              );
            })}
          </div>

          {/* Optional Student Free-Text Interpretation */}
          <div className="space-y-1.5 pt-1">
            <label
              htmlFor={`ko-summary-${analysis.questionId}`}
              className={`text-xs font-bold block ${isLavender ? 'text-[#4C497A]' : 'text-[#5C4D42]'}`}
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
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm focus:outline-none ${
                isLavender
                  ? 'border-[#CFCBE8] bg-[#F8F7FF] text-[#1D1B42] focus:border-[#6A52A3]'
                  : 'border-[#EAE0D0] bg-[#FFFDF8] text-[#2D2620] focus:border-[#4E8336]'
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveStep('role')}
              className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                isLavender
                  ? 'border-[#C9C2E8] bg-[#F4F2FC] text-[#4C497A]'
                  : 'border-[#EAE0D0] bg-[#FFF9EF] text-[#5C4D42]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>2단계로</span>
            </button>

            <button
              type="button"
              disabled={!isAllKoPlaced && draft.koSummaryDraft.trim().length < 2}
              onClick={handleCheckTranslation}
              className={`clay-btn px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5 ${
                isLavender
                  ? 'bg-[#A9DDF5] text-[#133554]'
                  : 'bg-[#9BCB83] text-[#1A3110]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>내 해석 확인하기</span>
            </button>
          </div>
        </div>
      )}

      {/* Model Translation Comparison (Revealed ONLY after attempt or explicit request) */}
      {draft.revealedModelAnswer && (
        <div className="rounded-2xl bg-white border-2 border-[#4E8336] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#1A390D]">
              <CheckCircle2 className="w-4 h-4 text-[#4E8336]" />
              <span>모범 해석과 비교해 보기</span>
            </div>
            {draft.koAssemblyChecked && (
              <span className="text-xs font-extrabold text-[#4E8336]">
                {isKoOrderExact
                  ? '우리말 어순까지 완벽해요!'
                  : keywordMatchCount >= 2
                    ? '핵심 의미가 아주 잘 담겼어요!'
                    : '조립한 뜻의 흐름을 아래 모범 해석과 비교해 보세요!'}
              </span>
            )}
          </div>

          {draft.koSummaryDraft.trim() && (
            <div className="rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] p-3 text-xs space-y-1">
              <div className="font-extrabold text-[#5C4D42]">내가 적은 해석</div>
              <p className="text-[#2D2620]">{draft.koSummaryDraft}</p>
            </div>
          )}

          <div className="rounded-xl bg-[#EAF5E4]/65 border border-[#4E8336]/40 p-3 space-y-1.5">
            <div className="text-xs font-extrabold text-[#1A390D]">자연스러운 모범 해석</div>
            <p className="text-xs sm:text-sm font-bold text-[#2D2620] leading-relaxed">
              {analysis.modelTranslationKo}
            </p>
          </div>

          <div className="rounded-xl bg-[#FFFDF8] border border-[#EAE0D0] p-3 space-y-1">
            <div className="text-[11px] font-extrabold text-[#9B785D]">
              영어 어순 그대로 끊어 읽기 (직독직해)
            </div>
            <p className="text-xs text-[#4B3F35] leading-relaxed">
              {analysis.literalFlowKo}
            </p>
          </div>

          <div className="rounded-xl bg-[#F1ECFA]/60 border border-[#785EA8]/40 p-3 space-y-1">
            <div className="text-[11px] font-extrabold text-[#2F1F52]">
              이 문장의 핵심 구조 정리
            </div>
            <p className="text-xs text-[#2F1F52] leading-relaxed">
              {analysis.grammarDeepDive}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
