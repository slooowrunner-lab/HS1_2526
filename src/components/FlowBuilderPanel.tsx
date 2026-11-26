import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  GripVertical,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { MissionProgress } from '../types/game';
import { QuestionLabDraft } from '../controllers/SentenceLabStorage';
import { playTryAgainSoft } from '../utils/soundEffects';

interface GuessOptionItem {
  text: string;
  isReal: boolean;
}

interface FlowBuilderPanelProps {
  question: ExtractedQuestion;
  progress: MissionProgress;
  draft: QuestionLabDraft;
  guessOptions: GuessOptionItem[];
  onUpdateDraft: (updater: (prev: QuestionLabDraft) => QuestionLabDraft) => void;
  onCompleteStoryBuild: () => void;
  onRecordGuess: (guessIdx: number, isReal?: boolean) => void;
  onGoToBoss: () => void;
  nextStepLabel?: string;
  onSkipToBoss?: () => void;
  islandTheme?: 'spring' | 'lavender';
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const FlowBuilderPanel: React.FC<FlowBuilderPanelProps> = ({
  question,
  progress,
  draft,
  guessOptions,
  onUpdateDraft,
  onCompleteStoryBuild,
  onRecordGuess,
  onGoToBoss,
  onSkipToBoss,
  nextStepLabel = '문제 풀기',
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const useOrderPuzzle = question.structureOutline.length >= 3;
  const [showFlowHint, setShowFlowHint] = useState(false);
  const [draggedCardIdx, setDraggedCardIdx] = useState<number | null>(null);
  const [draggedSlotPos, setDraggedSlotPos] = useState<number | null>(null);
  const [practiceReplay, setPracticeReplay] = useState(false);
  const [clearedGuessExplicitly, setClearedGuessExplicitly] = useState(false);
  const [previousOrderBackup, setPreviousOrderBackup] = useState<number[] | null>(
    null,
  );

  const shuffledOutline = useMemo(() => {
    const steps = question.structureOutline.map((text, originalIdx) => ({
      text,
      originalIdx,
    }));
    if (steps.length <= 2) return steps;
    const seed = hashSeed(question.id);
    const shift = (seed % (steps.length - 1)) + 1;
    return [...steps.slice(shift), ...steps.slice(0, shift)];
  }, [question]);

  // Ensure placed order only contains valid indices
  const placedOrder = useMemo(() => {
    const valid = draft.flowOrderDraft.filter(
      (idx) => idx >= 0 && idx < question.structureOutline.length,
    );
    return Array.from(new Set(valid));
  }, [draft.flowOrderDraft, question.structureOutline.length]);

  const totalSteps = question.structureOutline.length;
  const isAllPlaced = placedOrder.length === totalSteps;
  const isAllOrderCorrect =
    isAllPlaced && placedOrder.every((origIdx, pos) => origIdx === pos);

  const isLockedSolved = progress.storyChecked && !practiceReplay;

  const handleToggleCandidateCard = (originalIdx: number) => {
    if (isLockedSolved) return;
    if (placedOrder.includes(originalIdx)) {
      // Remove if already placed
      onUpdateDraft((prev) => ({
        ...prev,
        flowOrderDraft: prev.flowOrderDraft.filter((id) => id !== originalIdx),
        flowOrderChecked: false,
      }));
      return;
    }
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderDraft: [...placedOrder, originalIdx],
      flowOrderChecked: false,
    }));
  };

  const handleRemoveFromSlot = (originalIdx: number) => {
    if (isLockedSolved) return;
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderDraft: placedOrder.filter((id) => id !== originalIdx),
      flowOrderChecked: false,
    }));
  };

  const handleMoveSlot = (pos: number, delta: -1 | 1) => {
    const targetPos = pos + delta;
    if (targetPos < 0 || targetPos >= placedOrder.length) return;
    const next = [...placedOrder];
    const [moved] = next.splice(pos, 1);
    next.splice(targetPos, 0, moved);
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderDraft: next,
      flowOrderChecked: false,
    }));
  };

  const handleDropIntoSlot = (targetPos: number) => {
    if (draggedSlotPos !== null) {
      if (draggedSlotPos === targetPos) return;
      const next = [...placedOrder];
      const [moved] = next.splice(draggedSlotPos, 1);
      next.splice(targetPos, 0, moved);
      onUpdateDraft((prev) => ({
        ...prev,
        flowOrderDraft: next,
        flowOrderChecked: false,
      }));
      setDraggedSlotPos(null);
      return;
    }
    if (draggedCardIdx !== null) {
      if (placedOrder.includes(draggedCardIdx)) {
        const currentPos = placedOrder.indexOf(draggedCardIdx);
        const next = [...placedOrder];
        next.splice(currentPos, 1);
        next.splice(targetPos, 0, draggedCardIdx);
        onUpdateDraft((prev) => ({
          ...prev,
          flowOrderDraft: next,
          flowOrderChecked: false,
        }));
      } else {
        const next = [...placedOrder];
        next.splice(targetPos, 0, draggedCardIdx);
        onUpdateDraft((prev) => ({
          ...prev,
          flowOrderDraft: next,
          flowOrderChecked: false,
        }));
      }
      setDraggedCardIdx(null);
    }
  };

  const handleCheckOrder = () => {
    if (!isAllPlaced) return;
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderChecked: true,
    }));
    if (isAllOrderCorrect) {
      setPracticeReplay(false);
      onCompleteStoryBuild();
    } else {
      playTryAgainSoft();
    }
  };

  const handleResetOrder = () => {
    if (placedOrder.length > 0) {
      setPreviousOrderBackup([...placedOrder]);
    }
    setPracticeReplay(true);
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderDraft: [],
      flowOrderChecked: false,
    }));
  };

  const handleRestoreOrderBackup = () => {
    if (!previousOrderBackup) return;
    onUpdateDraft((prev) => ({
      ...prev,
      flowOrderDraft: previousOrderBackup,
      flowOrderChecked: false,
    }));
    setPreviousOrderBackup(null);
  };

  // --- Core Topic Choice Mode (!useOrderPuzzle) ---
  const selectedGuess =
    draft.flowGuessDraft !== null
      ? draft.flowGuessDraft
      : clearedGuessExplicitly
        ? null
        : progress.guessChoiceIndex;
  const isGuessVerifiedCorrect =
    (draft.flowGuessChecked || (!clearedGuessExplicitly && progress.guessChoiceIndex !== null)) &&
    selectedGuess !== null &&
    Boolean(guessOptions[selectedGuess]?.isReal);

  const handleSelectGuessCard = (idx: number) => {
    setClearedGuessExplicitly(false);
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessDraft: idx,
      flowGuessChecked: false,
    }));
  };

  const handleCancelGuessCard = () => {
    setClearedGuessExplicitly(true);
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessDraft: null,
      flowGuessChecked: false,
    }));
  };

  const handleVerifyGuess = () => {
    if (selectedGuess === null) return;
    setClearedGuessExplicitly(false);
    const isReal = Boolean(guessOptions[selectedGuess]?.isReal);
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessDraft: selectedGuess,
      flowGuessChecked: true,
    }));
    onRecordGuess(selectedGuess, isReal);
  };

  if (!useOrderPuzzle) {
    return (
      <div className="space-y-5">
        <div
          className={`rounded-2xl border-2 px-4 py-3 text-sm sm:text-base font-extrabold flex flex-wrap items-center justify-between gap-2 ${
            isLavender
              ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E]'
              : 'bg-[#EAF9DC] border-[#78C800] text-[#285E00]'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>핵심 주제를 먼저 고르세요</span>
          </span>
          {onSkipToBoss && (
            <button
              type="button"
              onClick={onSkipToBoss}
              className="text-xs sm:text-sm font-extrabold underline underline-offset-4 cursor-pointer"
            >
              바로 풀기 ▶
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={`text-xl sm:text-2xl font-extrabold ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
              글의 핵심 내용 고르기 (+10 XP)
            </h2>
            <p className={`text-base sm:text-lg mt-1 leading-relaxed ${isLavender ? 'text-[#3F3D6B]' : 'text-[#5C4D42]'}`}>
              알맞은 카드를 누른 뒤 아래 확인 버튼을 눌러 주세요. X 버튼으로 언제든 취소할 수 있어요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFlowHint((v) => !v)}
              className={`min-h-[42px] px-4 py-2 rounded-xl border-2 text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                isLavender
                  ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E] hover:border-[#5D9EC0]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#6B4A00] hover:border-[#D4A72C]'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>{showFlowHint ? '접기' : '힌트'}</span>
            </button>
            {selectedGuess !== null && (
              <button
                type="button"
                onClick={handleCancelGuessCard}
                className={`min-h-[42px] px-4 py-2 rounded-xl bg-white border-2 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  isLavender
                    ? 'border-[#C9C2E8] text-[#3F3D6B] hover:border-[#6A52A3]'
                    : 'border-[#EAE0D0] text-[#4B3F35] hover:border-[#9B785D]'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>

        {showFlowHint && (
          <div
            className={`rounded-2xl border-2 p-4 text-sm sm:text-base leading-relaxed ${
              isLavender
                ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#142754]'
                : 'bg-[#FFE18A]/35 border-[#E0B94B] text-[#1E1915]'
            }`}
          >
            <span className="font-extrabold inline-flex items-center gap-1.5 mr-1.5">
              <HelpCircle
                className={`w-4 h-4 ${
                  isLavender ? 'text-[#3B6FB6]' : 'text-[#9B6B00]'
                }`}
              />
              핵심 단서:
            </span>
            {question.keyFocus}
          </div>
        )}

        <div className="space-y-3">
          {guessOptions.map((opt, idx) => {
            const isSelected = selectedGuess === idx;
            const showCheckState = draft.flowGuessChecked && isSelected;
            const isCorrectPick = showCheckState && opt.isReal;
            const isWrongPick = showCheckState && !opt.isReal;

            let cardClass = isLavender
              ? 'dq-btn-3d bg-white border-[#D4D2EC] hover:border-[#6A52A3] text-[#14132E]'
              : 'dq-btn-3d bg-white border-[#E5E5E5] hover:border-[#1CB0F6] text-[#1E1915]';
            if (isCorrectPick || (isGuessVerifiedCorrect && opt.isReal)) {
              cardClass =
                'dq-btn-3d bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]';
            } else if (isWrongPick) {
              cardClass =
                'dq-btn-3d bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1212]';
            } else if (isSelected) {
              cardClass = isLavender
                ? 'dq-btn-3d bg-[#EAE3FA] border-[#6A52A3] text-[#1A1238]'
                : 'dq-btn-3d bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]';
            }

            return (
              <div
                key={idx}
                className={`rounded-2xl border-2 transition-all flex items-start justify-between gap-2.5 p-3.5 sm:p-4 min-w-0 ${cardClass}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectGuessCard(idx)}
                  className="flex-1 min-w-0 text-left flex items-start gap-3 cursor-pointer"
                >
                    <span
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center font-mono text-sm sm:text-base font-extrabold shrink-0 mt-0.5 ${
                        isSelected
                          ? isLavender
                            ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#211442]'
                            : 'bg-[#1CB0F6] border-[#1899D6] text-white'
                          : isLavender
                            ? 'bg-[#F3F2FC] border-[#C9C2E8] text-[#5B489E]'
                            : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#777777]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="text-base sm:text-lg font-bold leading-relaxed block break-words [overflow-wrap:anywhere]">
                        {opt.text}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-extrabold">
                        {isSelected && !showCheckState && (
                          <span className={isLavender ? 'text-[#4F389C]' : 'text-[#1899D6]'}>
                            ● 선택됨 — 아래 확인 버튼을 눌러 완료하세요
                          </span>
                        )}
                        {isCorrectPick && (
                          <span className="text-[#285E00] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            정확한 핵심 내용이에요!
                          </span>
                        )}
                        {isWrongPick && (
                          <span className="text-[#B4462A]">
                            핵심 방향이 조금 달라요. X를 눌러 다른 카드를 골라보세요!
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                {isSelected && (
                  <button
                    type="button"
                    onClick={handleCancelGuessCard}
                    aria-label={`${idx + 1}번 선택 취소`}
                    title="선택 취소 (X)"
                    className={`w-10 h-10 rounded-xl bg-white border-2 hover:bg-[#FFDFE0] hover:border-[#FF4B4B] hover:text-[#9A1B1B] flex items-center justify-center shrink-0 cursor-pointer ${
                      isLavender
                        ? 'border-[#C6BEE8] text-[#4E4A7D]'
                        : 'border-[#E5E5E5] text-[#5C4D42]'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {!isGuessVerifiedCorrect ? (
            <button
              type="button"
              disabled={selectedGuess === null}
              onClick={handleVerifyGuess}
              className="dq-btn-3d min-h-[54px] px-7 py-3.5 rounded-2xl text-base font-extrabold bg-[#58CC02] border-2 border-[#46A302] text-white disabled:bg-[#E5E5E5] disabled:border-[#D4D4D4] disabled:text-[#999999] disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>정답 확인</span>
            </button>
          ) : (
            <div className="w-full rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm sm:text-base font-extrabold text-[#1E4600] inline-flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#46A302]" />
                <span>핵심 요지를 정확히 찾았어요! 이제 다음 단계로 넘어가 볼까요?</span>
              </div>
              <button
                type="button"
                onClick={onGoToBoss}
                className="dq-btn-3d min-h-[50px] px-6 py-3 rounded-2xl text-base font-extrabold bg-[#58CC02] border-2 border-[#46A302] text-white inline-flex items-center gap-2 cursor-pointer"
              >
                <span>{nextStepLabel}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Order Sequencing Mode (useOrderPuzzle) ---
  const wrongPositions = draft.flowOrderChecked
    ? placedOrder
        .map((origIdx, pos) => (origIdx !== pos ? pos + 1 : null))
        .filter((n): n is number => n !== null)
    : [];

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border-2 px-4 py-3 text-sm sm:text-base font-extrabold flex flex-wrap items-center justify-between gap-2 ${
          isLavender
            ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E]'
            : 'bg-[#EAF9DC] border-[#78C800] text-[#285E00]'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>글의 흐름 순서를 맞추세요</span>
        </span>
        {onSkipToBoss && (
          <button
            type="button"
            onClick={onSkipToBoss}
            className="text-xs sm:text-sm font-extrabold underline underline-offset-4 cursor-pointer"
          >
            바로 풀기 ▶
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-xl sm:text-2xl font-extrabold ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
            글의 흐름 순서 맞추기 (+15 XP)
          </h2>
          <p className={`text-base sm:text-lg mt-1 leading-relaxed ${isLavender ? 'text-[#3F3D6B]' : 'text-[#5C4D42]'}`}>
            카드를 눌러 순서대로 채워보세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFlowHint((v) => !v)}
            className={`min-h-[42px] px-4 py-2 rounded-xl border-2 text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              isLavender
                ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E] hover:border-[#5D9EC0]'
                : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#6B4A00] hover:border-[#D4A72C]'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>{showFlowHint ? '접기' : '힌트'}</span>
          </button>

          {previousOrderBackup && (
            <button
              type="button"
              onClick={handleRestoreOrderBackup}
              className={`min-h-[42px] px-4 py-2 rounded-xl border-2 text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                isLavender
                  ? 'bg-[#DFD6FA]/60 border-[#7963A8] text-[#281A52]'
                  : 'bg-[#A8DCC8]/40 border-[#4D9479] text-[#163B2D]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>복구</span>
            </button>
          )}

          {(placedOrder.length > 0 || progress.storyChecked) && (
            <button
              type="button"
              onClick={handleResetOrder}
              className={`min-h-[42px] px-4 py-2 rounded-xl bg-white border-2 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                isLavender
                  ? 'border-[#C9C2E8] text-[#3F3D6B] hover:border-[#6A52A3]'
                  : 'border-[#EAE0D0] text-[#4B3F35] hover:border-[#9B785D]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>다시 풀기</span>
            </button>
          )}
        </div>
      </div>

      {showFlowHint && (
        <div
          className={`rounded-2xl border-2 p-4 text-sm sm:text-base leading-relaxed ${
            isLavender
              ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#142754]'
              : 'bg-[#FFE18A]/35 border-[#E0B94B] text-[#1E1915]'
          }`}
        >
          <span className="font-extrabold inline-flex items-center gap-1.5 mr-1.5">
            <HelpCircle
              className={`w-4 h-4 ${
                isLavender ? 'text-[#3B6FB6]' : 'text-[#9B6B00]'
              }`}
            />
            연결 단서:
          </span>
          {question.keyFocus}
        </div>
      )}

      {/* Placed Slots */}
      <div
        className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
          isLavender
            ? 'bg-[#F4F2FC] border-[#C9B9E8]'
            : 'bg-[#FFF9EF] border-[#EAE0D0]'
        }`}
      >
        <div className={`flex items-center justify-between text-base sm:text-lg font-extrabold ${isLavender ? 'text-[#2D2A5E]' : 'text-[#4B3F35]'}`}>
          <span>내가 조립한 글 흐름 순서</span>
          <span className={`font-mono tabular-nums ${isLavender ? 'text-[#5D4B9E]' : 'text-[#9B785D]'}`}>
            {placedOrder.length} / {totalSteps}
          </span>
        </div>

        {Array.from({ length: totalSteps }).map((_, slotPos) => {
          const origIdx = placedOrder[slotPos];
          const hasCard = origIdx !== undefined;
          const cardText = hasCard ? question.structureOutline[origIdx] : null;
          const isChecked = draft.flowOrderChecked || isLockedSolved;
          const isSlotCorrect =
            hasCard && (isLockedSolved || (isChecked && origIdx === slotPos));
          const isSlotWrong =
            hasCard && isChecked && !isLockedSolved && origIdx !== slotPos;

          let slotStyle = isLavender
            ? 'bg-[#ECEAF8]/75 border-dashed border-[#B7B4DC] text-[#4C4C78]'
            : 'bg-[#F5EFE4]/70 border-dashed border-[#D6C8B4] text-[#6E5E52]';
          if (hasCard) {
            if (isSlotCorrect) {
              slotStyle =
                'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]';
            } else if (isSlotWrong) {
              slotStyle =
                'bg-[#FDECE7] border-[#C85B3F] text-[#5E1F10]';
            } else {
              slotStyle = isLavender
                ? 'bg-white border-[#7963A8] text-[#14132E] shadow-xs'
                : 'bg-white border-[#C9961A] text-[#1E1915] shadow-xs';
            }
          }

          return (
            <div
              key={slotPos}
              draggable={hasCard && !isLockedSolved}
              onDragStart={() => {
                if (hasCard) setDraggedSlotPos(slotPos);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDropIntoSlot(slotPos);
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border-2 flex flex-col gap-2.5 min-w-0 transition-all ${slotStyle}`}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {hasCard && !isLockedSolved && (
                    <GripVertical
                      className={`w-4 h-4 hidden sm:block shrink-0 cursor-grab ${
                        isLavender ? 'text-[#6A52A3]/70' : 'text-[#9B785D]/70'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-xl font-mono text-sm sm:text-base font-extrabold tabular-nums shrink-0 ${
                      isSlotCorrect
                        ? 'bg-[#4E8336] text-white'
                        : isSlotWrong
                          ? 'bg-[#C85B3F] text-white'
                          : hasCard
                            ? isLavender
                              ? 'bg-[#C9B9E8] text-[#211442]'
                              : 'bg-[#FFE18A] text-[#2D2620]'
                            : isLavender
                              ? 'bg-[#E1DEF4] text-[#3F3D6B]'
                              : 'bg-[#EAE0D0] text-[#5C4D42]'
                    }`}
                  >
                    0{slotPos + 1}
                  </span>
                  {isSlotCorrect && (
                    <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[#2E571C] truncate">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>알맞은 순서</span>
                    </span>
                  )}
                  {isSlotWrong && (
                    <span className="text-xs sm:text-sm font-extrabold text-[#B4462A] truncate">
                      순서 다시 확인
                    </span>
                  )}
                </div>

                {hasCard && !isLockedSolved && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={slotPos === 0}
                      onClick={() => handleMoveSlot(slotPos, -1)}
                      aria-label={`${slotPos + 1}번 카드를 위로 이동`}
                      className={`w-8 h-8 rounded-lg border-2 disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                        isLavender
                          ? 'bg-[#F4F2FC] border-[#C9C2E8] text-[#4A467A] hover:border-[#6A52A3]'
                          : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={slotPos === placedOrder.length - 1}
                      onClick={() => handleMoveSlot(slotPos, 1)}
                      aria-label={`${slotPos + 1}번 카드를 아래로 이동`}
                      className={`w-8 h-8 rounded-lg border-2 disabled:opacity-35 flex items-center justify-center cursor-pointer ${
                        isLavender
                          ? 'bg-[#F4F2FC] border-[#C9C2E8] text-[#4A467A] hover:border-[#6A52A3]'
                          : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
                      }`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromSlot(origIdx)}
                      aria-label={`${slotPos + 1}번 순서 카드 취소`}
                      title="선택 취소 (X)"
                      className={`w-8 h-8 rounded-lg bg-white border-2 hover:bg-[#F39A83]/25 hover:border-[#D1684E] hover:text-[#7A2D1C] flex items-center justify-center cursor-pointer ${
                        isLavender
                          ? 'border-[#C6BEE8] text-[#4E4A7D]'
                          : 'border-[#D4C3AE] text-[#5C4D42]'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full min-w-0">
                <p className="text-base sm:text-lg font-bold leading-relaxed break-words [overflow-wrap:anywhere]">
                  {cardText ?? '아래 전개 카드를 눌러 순서대로 채우세요'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback Banner if checked and has errors */}
      {draft.flowOrderChecked && !isLockedSolved && wrongPositions.length > 0 && (
        <div className="rounded-xl bg-[#FDECE7] border-2 border-[#C85B3F]/60 px-4 py-3.5 text-sm font-bold text-[#5E1F10] break-words [overflow-wrap:anywhere]">
          {wrongPositions.map((n) => `0${n}`).join(', ')}번 위치의 순서를 다시 확인해 보세요! X 버튼으로 빼서 다시 놓거나 위·아래 화살표로 바꿀 수 있어요.
        </div>
      )}

      {/* Check or Completion */}
      {isLockedSolved ? (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm sm:text-base font-extrabold text-[#1E4600] inline-flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#46A302] shrink-0" />
            <span>글의 흐름 순서를 완벽히 파악했어요!</span>
          </div>
          <button
            type="button"
            onClick={onGoToBoss}
            className="dq-btn-3d min-h-[50px] px-6 py-3 rounded-2xl text-base font-extrabold bg-[#58CC02] border-2 border-[#46A302] text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <span>{nextStepLabel}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          {/* Candidate Pool */}
          <div className="space-y-3 min-w-0">
            <div className={`text-sm sm:text-base font-bold ${isLavender ? 'text-[#3F3D6B]' : 'text-[#5C4D42]'}`}>
              아래 카드를 순서대로 눌러 위 칸을 채워보세요 (선택된 카드도 X로 취소 가능):
            </div>
            <div className="grid grid-cols-1 gap-3 min-w-0">
              {shuffledOutline.map((card) => {
                const placedPos = placedOrder.indexOf(card.originalIdx);
                const isPlaced = placedPos !== -1;
                return (
                  <div
                    key={card.originalIdx}
                    draggable={!isPlaced}
                    onDragStart={() => setDraggedCardIdx(card.originalIdx)}
                    className={`rounded-2xl border-2 transition-all flex items-start justify-between gap-2.5 p-3.5 sm:p-4 min-w-0 ${
                      isPlaced
                        ? isLavender
                          ? 'bg-[#EAE3FA]/80 border-[#7963A8] text-[#1A1238]'
                          : 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                        : isLavender
                          ? 'dq-btn-3d bg-white border-[#D3D1EC] hover:border-[#6A52A3] text-[#14132E]'
                          : 'dq-btn-3d bg-white border-[#E5E5E5] hover:border-[#1CB0F6] text-[#1E1915]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleCandidateCard(card.originalIdx)}
                      className="flex-1 min-w-0 text-left flex items-start gap-3 cursor-pointer"
                    >
                      <span
                        className={`px-2.5 py-1 rounded-xl font-mono text-xs sm:text-sm font-extrabold shrink-0 mt-0.5 ${
                          isPlaced
                            ? isLavender
                              ? 'bg-[#6A52A3] text-white'
                              : 'bg-[#1CB0F6] text-white'
                            : isLavender
                              ? 'bg-[#F2F0FC] border border-[#C9B9E8] text-[#5B489E]'
                              : 'bg-[#FAFAFA] border border-[#E5E5E5] text-[#777777]'
                        }`}
                      >
                        {isPlaced ? `0${placedPos + 1} 배치됨` : '선택'}
                      </span>
                      <span className="flex-1 min-w-0 text-base sm:text-lg font-bold leading-relaxed break-words [overflow-wrap:anywhere]">
                        {card.text}
                      </span>
                    </button>

                    {isPlaced && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFromSlot(card.originalIdx)}
                        aria-label={`0${placedPos + 1}번 배치 취소`}
                        title="선택 취소 (X)"
                        className={`w-9 h-9 rounded-xl bg-white border-2 hover:bg-[#FFDFE0] hover:border-[#FF4B4B] hover:text-[#9A1B1B] flex items-center justify-center shrink-0 cursor-pointer ${
                          isLavender
                            ? 'border-[#C6BEE8] text-[#4E4A7D]'
                            : 'border-[#E5E5E5] text-[#5C4D42]'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className={`text-sm font-bold ${isLavender ? 'text-[#3F3D6B]' : 'text-[#5C4D42]'}`}>
              {isAllPlaced
                ? '모든 카드를 배치했어요! 순서를 확인해 보세요.'
                : `${totalSteps - placedOrder.length}개 카드를 더 배치하면 확인할 수 있어요.`}
            </span>
            <button
              type="button"
              disabled={!isAllPlaced}
              onClick={handleCheckOrder}
              className="dq-btn-3d min-h-[54px] px-7 py-3.5 rounded-2xl text-base font-extrabold bg-[#58CC02] border-2 border-[#46A302] text-white disabled:bg-[#E5E5E5] disabled:border-[#D4D4D4] disabled:text-[#999999] disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>순서 확인하기</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
