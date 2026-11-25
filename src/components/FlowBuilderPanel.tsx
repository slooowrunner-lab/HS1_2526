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
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const useOrderPuzzle = question.structureOutline.length >= 3;
  const [showFlowHint, setShowFlowHint] = useState(false);
  const [draggedCardIdx, setDraggedCardIdx] = useState<number | null>(null);
  const [draggedSlotPos, setDraggedSlotPos] = useState<number | null>(null);
  const [practiceReplay, setPracticeReplay] = useState(false);
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
  const selectedGuess = draft.flowGuessDraft ?? progress.guessChoiceIndex;
  const isGuessVerifiedCorrect =
    (draft.flowGuessChecked || progress.guessChoiceIndex !== null) &&
    selectedGuess !== null &&
    Boolean(guessOptions[selectedGuess]?.isReal);

  const handleSelectGuessCard = (idx: number) => {
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessDraft: idx,
      flowGuessChecked: false,
    }));
  };

  const handleCancelGuessCard = () => {
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessDraft: null,
      flowGuessChecked: false,
    }));
  };

  const handleVerifyGuess = () => {
    if (selectedGuess === null) return;
    const isReal = Boolean(guessOptions[selectedGuess]?.isReal);
    onUpdateDraft((prev) => ({
      ...prev,
      flowGuessChecked: true,
    }));
    onRecordGuess(selectedGuess, isReal);
  };

  if (!useOrderPuzzle) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#2D2620]">
              ① 글의 핵심 내용 고르기 (+10 XP)
            </h2>
            <p className="text-xs text-[#6E5E52] mt-0.5">
              카드를 눌러 선택한 뒤 X 버튼으로 취소하거나 다시 고를 수 있어요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFlowHint((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                isLavender
                  ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E] hover:border-[#5D9EC0]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#7B5600] hover:border-[#D4A72C]'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{showFlowHint ? '힌트 접기' : '흐름 힌트'}</span>
            </button>
            {selectedGuess !== null && (
              <button
                type="button"
                onClick={handleCancelGuessCard}
                className={`px-3 py-1.5 rounded-xl bg-white border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                  isLavender
                    ? 'border-[#C9C2E8] text-[#4A467A] hover:border-[#6A52A3]'
                    : 'border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>선택 초기화</span>
              </button>
            )}
          </div>
        </div>

        {showFlowHint && (
          <div
            className={`rounded-2xl border-2 p-3.5 text-xs sm:text-sm leading-relaxed ${
              isLavender
                ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#162C5E]'
                : 'bg-[#FFE18A]/35 border-[#E0B94B] text-[#2D2620]'
            }`}
          >
            <span className="font-extrabold inline-flex items-center gap-1 mr-1.5">
              <HelpCircle
                className={`w-3.5 h-3.5 ${
                  isLavender ? 'text-[#3B6FB6]' : 'text-[#9B6B00]'
                }`}
              />
              핵심 단서:
            </span>
            {question.keyFocus}
          </div>
        )}

        <div className="space-y-2.5">
          {guessOptions.map((opt, idx) => {
            const isSelected = selectedGuess === idx;
            const showCheckState = draft.flowGuessChecked && isSelected;
            const isCorrectPick = showCheckState && opt.isReal;
            const isWrongPick = showCheckState && !opt.isReal;

            let cardClass = isLavender
              ? 'bg-white border-[#D4D2EC] hover:border-[#6A52A3] text-[#1D1B42]'
              : 'bg-white border-[#EAE0D0] hover:border-[#9B785D] text-[#2D2620]';
            if (isCorrectPick || (isGuessVerifiedCorrect && opt.isReal)) {
              cardClass =
                'bg-[#9BCB83]/25 border-[#5D8A43] text-[#1A3110] ring-2 ring-[#9BCB83]/40';
            } else if (isWrongPick) {
              cardClass =
                'bg-[#F39A83]/20 border-[#D1684E] text-[#4A1E13] ring-2 ring-[#F39A83]/40';
            } else if (isSelected) {
              cardClass = isLavender
                ? 'bg-[#EAE3FA]/80 border-[#6A52A3] text-[#1E1442] ring-2 ring-[#A9DDF5]'
                : 'bg-[#FFE18A]/45 border-[#C9961A] text-[#2D2620] ring-2 ring-[#FFE18A]';
            }

            return (
              <div
                key={idx}
                className={`rounded-2xl border-2 transition-all flex items-start justify-between gap-2 p-3.5 sm:p-4 ${cardClass}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectGuessCard(idx)}
                  className="flex-1 text-left flex items-start gap-3 cursor-pointer"
                >
                  <span
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center font-mono text-xs font-extrabold shrink-0 ${
                      isSelected
                        ? isLavender
                          ? 'bg-[#C9B9E8] border-[#6A52A3] text-[#211442]'
                          : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                        : isLavender
                          ? 'bg-[#F3F2FC] border-[#C9C2E8] text-[#5B489E]'
                          : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#9B785D]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="space-y-1 flex-1">
                    <span className="text-sm font-semibold leading-relaxed block">
                      {opt.text}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                      {isSelected && !showCheckState && (
                        <span className={isLavender ? 'text-[#5A42A6]' : 'text-[#8A6100]'}>
                          ● 선택됨 (아래 확인 버튼을 누르거나 X로 취소)
                        </span>
                      )}
                      {isCorrectPick && (
                        <span className="text-[#3C6924] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
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
                    className={`w-9 h-9 rounded-xl bg-white/90 border hover:bg-[#F39A83]/25 hover:border-[#D1684E] hover:text-[#7A2D1C] flex items-center justify-center shrink-0 cursor-pointer ${
                      isLavender
                        ? 'border-[#C6BEE8] text-[#4E4A7D]'
                        : 'border-[#D4C3AE] text-[#5C4D42]'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!isGuessVerifiedCorrect ? (
            <button
              type="button"
              disabled={selectedGuess === null}
              onClick={handleVerifyGuess}
              className={`clay-btn px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5 ${
                isLavender
                  ? 'bg-[#C9B9E8] text-[#211442]'
                  : 'bg-[#FFE18A] text-[#2D2620]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>선택한 핵심 내용 확인하기</span>
            </button>
          ) : (
            <div className="w-full rounded-2xl bg-[#9BCB83]/20 border-2 border-[#5D8A43] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#1A3110]">
                핵심 요지를 정확히 찾았어요! 아래 문장 해석도 연습하거나 정답을 골라보세요.
              </div>
              <button
                type="button"
                onClick={onGoToBoss}
                className={`clay-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                  isLavender
                    ? 'bg-[#A9DDF5] text-[#133554]'
                    : 'bg-[#F39A83] text-[#2D2620]'
                }`}
              >
                <span>정답 고르러 가기</span>
                <ArrowRight className="w-4 h-4" />
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#2D2620]">
            ① 글의 흐름 순서 맞추기 (+15 XP)
          </h2>
          <p className="text-xs text-[#6E5E52] mt-0.5">
            아래 카드를 누르거나 끌어서 순서대로 채워보세요. X 버튼으로 언제든 빼고 다시 고를 수 있어요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFlowHint((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
              isLavender
                ? 'bg-[#EEF4FD] border-[#9BBCEB] text-[#1A3B6E] hover:border-[#5D9EC0]'
                : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#7B5600] hover:border-[#D4A72C]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showFlowHint ? '힌트 접기' : '순서 힌트'}</span>
          </button>

          {previousOrderBackup && (
            <button
              type="button"
              onClick={handleRestoreOrderBackup}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                isLavender
                  ? 'bg-[#DFD6FA]/60 border-[#7963A8] text-[#281A52]'
                  : 'bg-[#A8DCC8]/40 border-[#4D9479] text-[#163B2D]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>이전 배치 복구</span>
            </button>
          )}

          {(placedOrder.length > 0 || progress.storyChecked) && (
            <button
              type="button"
              onClick={handleResetOrder}
              className={`px-3 py-1.5 rounded-xl bg-white border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                isLavender
                  ? 'border-[#C9C2E8] text-[#4A467A] hover:border-[#6A52A3]'
                  : 'border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 연습 (기록 유지)</span>
            </button>
          )}
        </div>
      </div>

      {showFlowHint && (
        <div
          className={`rounded-2xl border-2 p-3.5 text-xs sm:text-sm leading-relaxed ${
            isLavender
              ? 'bg-[#EAF3FD] border-[#78AEE3] text-[#162C5E]'
              : 'bg-[#FFE18A]/35 border-[#E0B94B] text-[#2D2620]'
          }`}
        >
          <span className="font-extrabold inline-flex items-center gap-1 mr-1.5">
            <HelpCircle
              className={`w-3.5 h-3.5 ${
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
        className={`rounded-2xl border-2 p-3.5 sm:p-4 space-y-2.5 ${
          isLavender
            ? 'bg-[#F4F2FC] border-[#C9B9E8]'
            : 'bg-[#FFF9EF] border-[#EAE0D0]'
        }`}
      >
        <div className={`flex items-center justify-between text-xs font-extrabold ${isLavender ? 'text-[#434073]' : 'text-[#5C4D42]'}`}>
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
            ? 'bg-[#ECEAF8]/75 border-dashed border-[#B7B4DC] text-[#5B5B85]'
            : 'bg-[#F5EFE4]/70 border-dashed border-[#D6C8B4] text-[#8B7C6E]';
          if (hasCard) {
            if (isSlotCorrect) {
              slotStyle =
                'bg-[#EAF5E4] border-[#4E8336] text-[#1A390D]';
            } else if (isSlotWrong) {
              slotStyle =
                'bg-[#FDECE7] border-[#C85B3F] text-[#5E1F10]';
            } else {
              slotStyle = isLavender
                ? 'bg-white border-[#7963A8] text-[#1D1B42] shadow-xs'
                : 'bg-white border-[#C9961A] text-[#2D2620] shadow-xs';
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
              className={`p-3 rounded-xl border-2 flex items-start gap-2.5 transition-all ${slotStyle}`}
            >
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {hasCard && !isLockedSolved && (
                  <GripVertical
                    className={`w-4 h-4 hidden sm:block cursor-grab ${
                      isLavender ? 'text-[#6A52A3]/70' : 'text-[#9B785D]/70'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`px-2 py-0.5 rounded-lg font-mono text-xs font-extrabold tabular-nums ${
                    isSlotCorrect
                      ? 'bg-[#4E8336] text-white'
                      : isSlotWrong
                        ? 'bg-[#C85B3F] text-white'
                        : hasCard
                          ? isLavender
                            ? 'bg-[#C9B9E8] text-[#211442]'
                            : 'bg-[#FFE18A] text-[#2D2620]'
                          : isLavender
                            ? 'bg-[#E1DEF4] text-[#4E4C7A]'
                            : 'bg-[#EAE0D0] text-[#6E5E52]'
                  }`}
                >
                  0{slotPos + 1}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                  {cardText ?? '아래 전개 카드를 눌러 순서대로 채우세요'}
                </p>
                {isSlotCorrect && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#3A6A24]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    알맞은 순서입니다
                  </span>
                )}
                {isSlotWrong && (
                  <span className="mt-1 inline-block text-[11px] font-extrabold text-[#B4462A]">
                    이 자리가 아닌 것 같아요 (X로 빼거나 위/아래 버튼으로 옮겨보세요)
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
                    className={`w-8 h-8 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
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
                    className={`w-8 h-8 rounded-lg border disabled:opacity-35 flex items-center justify-center cursor-pointer ${
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
                    className={`w-9 h-9 rounded-xl bg-white border hover:bg-[#F39A83]/25 hover:border-[#D1684E] hover:text-[#7A2D1C] flex items-center justify-center cursor-pointer ${
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
          );
        })}
      </div>

      {/* Feedback Banner if checked and has errors */}
      {draft.flowOrderChecked && !isLockedSolved && wrongPositions.length > 0 && (
        <div className="rounded-xl bg-[#FDECE7] border-2 border-[#C85B3F]/60 px-4 py-3 text-xs sm:text-sm font-bold text-[#5E1F10]">
          {wrongPositions.map((n) => `0${n}`).join(', ')}번 위치의 순서를 다시 확인해 보세요! X 버튼으로 빼서 다시 놓거나 위·아래 화살표로 바꿀 수 있어요.
        </div>
      )}

      {/* Check or Completion */}
      {isLockedSolved ? (
        <div className="rounded-2xl bg-[#9BCB83]/20 border-2 border-[#5D8A43] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm font-extrabold text-[#1A3110] inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#4C7A34]" />
            <span>글의 흐름 순서를 완벽히 파악했어요!</span>
          </div>
          <button
            type="button"
            onClick={onGoToBoss}
            className={`clay-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              isLavender
                ? 'bg-[#A9DDF5] text-[#133554]'
                : 'bg-[#F39A83] text-[#2D2620]'
            }`}
          >
            <span>정답 고르러 가기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Candidate Pool */}
          <div className="space-y-2">
            <div className={`text-xs font-bold ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
              아래 카드를 순서대로 눌러 위 칸을 채워보세요 (선택된 카드도 X로 취소 가능):
            </div>
            <div className="grid grid-cols-1 gap-2">
              {shuffledOutline.map((card) => {
                const placedPos = placedOrder.indexOf(card.originalIdx);
                const isPlaced = placedPos !== -1;
                return (
                  <div
                    key={card.originalIdx}
                    draggable={!isPlaced}
                    onDragStart={() => setDraggedCardIdx(card.originalIdx)}
                    className={`rounded-2xl border-2 transition-all flex items-center justify-between gap-2 p-3 sm:p-3.5 ${
                      isPlaced
                        ? isLavender
                          ? 'bg-[#EAE3FA]/80 border-[#7963A8] text-[#1E1442]'
                          : 'bg-[#FFE18A]/35 border-[#C9961A] text-[#2D2620]'
                        : isLavender
                          ? 'bg-white border-[#D3D1EC] hover:border-[#6A52A3] text-[#1D1B42]'
                          : 'bg-white border-[#EAE0D0] hover:border-[#9B785D] text-[#2D2620]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleCandidateCard(card.originalIdx)}
                      className="flex-1 text-left flex items-start gap-2.5 cursor-pointer"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-extrabold shrink-0 mt-0.5 ${
                          isPlaced
                            ? isLavender
                              ? 'bg-[#6A52A3] text-white'
                              : 'bg-[#C9961A] text-white'
                            : isLavender
                              ? 'bg-[#F2F0FC] border border-[#C9B9E8] text-[#5B489E]'
                              : 'bg-[#FFF9EF] border border-[#EAE0D0] text-[#9B785D]'
                        }`}
                      >
                        {isPlaced ? `0${placedPos + 1} 배치됨` : '선택'}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold leading-relaxed">
                        {card.text}
                      </span>
                    </button>

                    {isPlaced && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFromSlot(card.originalIdx)}
                        aria-label={`0${placedPos + 1}번 배치 취소`}
                        title="선택 취소 (X)"
                        className={`w-9 h-9 rounded-xl bg-white border hover:bg-[#F39A83]/25 hover:border-[#D1684E] hover:text-[#7A2D1C] flex items-center justify-center shrink-0 cursor-pointer ${
                          isLavender
                            ? 'border-[#C6BEE8] text-[#4E4A7D]'
                            : 'border-[#D4C3AE] text-[#5C4D42]'
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className={`text-xs ${isLavender ? 'text-[#4C497A]' : 'text-[#6E5E52]'}`}>
              {isAllPlaced
                ? '모든 카드를 배치했어요! 순서를 확인해 보세요.'
                : `${totalSteps - placedOrder.length}개 카드를 더 배치하면 확인할 수 있어요.`}
            </span>
            <button
              type="button"
              disabled={!isAllPlaced}
              onClick={handleCheckOrder}
              className={`clay-btn px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5 ${
                isLavender
                  ? 'bg-[#C9B9E8] text-[#211442]'
                  : 'bg-[#FFE18A] text-[#2D2620]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>순서 확인하기</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
