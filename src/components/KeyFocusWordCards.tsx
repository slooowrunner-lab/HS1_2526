import React, { useMemo, useState } from 'react';
import { BookOpen, Check, CheckCircle2, Eye, Sparkles, Volume2 } from 'lucide-react';
import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';
import { parseKeyFocus } from '../utils/keyFocusParser';
import { playClueChime, playSuccessChime } from '../utils/soundEffects';
import { isTtsSupported, speakEnglish } from '../utils/tts';

interface KeyFocusWordCardsProps {
  keyFocus: string;
  analysis?: QuestionSentenceAnalysis | null;
  footnotes?: { term: string; meaning: string }[];
  interactive?: boolean;
  islandTheme?: 'spring' | 'lavender';
  revealedCardIds?: string[];
  onToggleCard?: (id: string) => void;
  onRevealAll?: (ids: string[]) => void;
  miniCheckDone?: boolean;
  onCompleteMiniCheck?: () => void;
}

const CARD_TONES = [
  'bg-[#FFFDF8] border-[#D4A72C]/60 hover:border-[#C9961A]',
  'bg-[#F7FCF9] border-[#4D9479]/50 hover:border-[#4D9479]',
  'bg-[#F4FAFE] border-[#5D9EC0]/50 hover:border-[#3E85B3]',
  'bg-[#FAF6FE] border-[#7963A8]/45 hover:border-[#7963A8]',
];

const LAVENDER_CARD_TONES = [
  'bg-[#F7F4FF] border-[#9C86D4]/70 hover:border-[#6A52A3]',
  'bg-[#EEF6FE] border-[#6FA7DC]/70 hover:border-[#3E76B8]',
  'bg-[#F3F2FE] border-[#7E84D4]/65 hover:border-[#5258B5]',
  'bg-[#EAF3FC] border-[#5D9EC0]/65 hover:border-[#3978A8]',
];

const FALLBACK_DISTRACTORS = ['도서관', '시간표', '운동장', '계절 변화', '우체국'];

export const KeyFocusWordCards: React.FC<KeyFocusWordCardsProps> = ({
  keyFocus,
  analysis,
  footnotes,
  interactive = true,
  islandTheme = 'spring',
  revealedCardIds,
  onToggleCard,
  onRevealAll,
  miniCheckDone = false,
  onCompleteMiniCheck,
}) => {
  const isLavender = islandTheme === 'lavender';
  const ttsAvailable = isTtsSupported();
  const parsed = useMemo(
    () => parseKeyFocus(keyFocus, analysis, footnotes),
    [keyFocus, analysis, footnotes],
  );
  const [localRevealedIds, setLocalRevealedIds] = useState<Record<string, boolean>>({});
  const [miniPick, setMiniPick] = useState<string | null>(null);
  const [miniFeedback, setMiniFeedback] = useState<'idle' | 'correct' | 'retry'>('idle');

  const isControlled = Array.isArray(revealedCardIds) && Boolean(onToggleCard);
  const revealedMap = useMemo(() => {
    if (isControlled && revealedCardIds) {
      const m: Record<string, boolean> = {};
      revealedCardIds.forEach((id) => {
        m[id] = true;
      });
      return m;
    }
    return localRevealedIds;
  }, [isControlled, revealedCardIds, localRevealedIds]);

  const allRevealed =
    parsed.cards.length > 0 &&
    parsed.cards.every((card) => Boolean(revealedMap[card.id]));

  const toggleCard = (id: string) => {
    if (!interactive) return;
    playClueChime();
    if (onToggleCard) {
      onToggleCard(id);
    }
    if (!isControlled) {
      setLocalRevealedIds((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));
    }
  };

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClueChime();
    const allIds = parsed.cards.map((c) => c.id);
    if (onRevealAll) {
      onRevealAll(allRevealed ? [] : allIds);
    }
    if (!isControlled) {
      if (allRevealed) {
        setLocalRevealedIds({});
      } else {
        const next: Record<string, boolean> = {};
        parsed.cards.forEach((c) => {
          next[c.id] = true;
        });
        setLocalRevealedIds(next);
      }
    }
  };

  const miniQuiz = useMemo(() => {
    const englishCards = parsed.cards.filter((c) => /[A-Za-z]{2,}/.test(c.term) && c.meaningKo.trim().length > 0);
    if (englishCards.length === 0) return null;
    const target = englishCards[0];
    const pool = parsed.cards
      .filter((c) => c.id !== target.id && c.meaningKo !== target.meaningKo)
      .map((c) => c.meaningKo);
    for (const d of FALLBACK_DISTRACTORS) {
      if (pool.length >= 2) break;
      if (d !== target.meaningKo && !pool.includes(d)) pool.push(d);
    }
    const choices = [target.meaningKo, pool[0], pool[1]].filter(Boolean);
    const seed = target.term.length % choices.length;
    const rotated = choices.map((_, i) => choices[(i + seed) % choices.length]);
    return {
      term: target.term,
      answer: target.meaningKo,
      choices: rotated,
    };
  }, [parsed.cards]);

  if (parsed.cards.length === 0) {
    return (
      <p className={`text-base sm:text-lg font-medium leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
        {keyFocus}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {parsed.strategySummary ? (
          <div
            className={`rounded-xl bg-white border-2 px-4 py-2.5 flex items-center gap-2 text-sm sm:text-base font-extrabold ${
              isLavender
                ? 'border-[#8D7AD6] text-[#2F1F63]'
                : 'border-[#E0B94B] text-[#573B00]'
            }`}
          >
            <Sparkles
              className={`w-4 h-4 shrink-0 ${
                isLavender ? 'text-[#5B48A3]' : 'text-[#B47A00]'
              }`}
            />
            <span>핵심 전략: {parsed.strategySummary}</span>
          </div>
        ) : (
          <span className={`text-sm sm:text-base font-bold ${isLavender ? 'text-[#3D396B]' : 'text-[#5C4D42]'}`}>
            각 단어 카드를 누르면 뜻이 열리고, 🔊 버튼으로 발음도 들을 수 있어요!
          </span>
        )}

        {interactive && (
          <button
            type="button"
            onClick={toggleAll}
            className={`dq-btn-3d min-h-[42px] px-4 py-2 rounded-xl bg-white border-2 text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              isLavender
                ? 'border-[#8D7AD6] text-[#2F1F63] hover:bg-[#E7E0FA]'
                : 'border-[#D4A72C]/70 text-[#573B00] hover:bg-[#FFE18A]/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>{allRevealed ? '뜻 모두 접기' : '뜻 모두 보기'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {parsed.cards.map((card, idx) => {
          const isOpen = !interactive || Boolean(revealedMap[card.id]);
          const palette = isLavender ? LAVENDER_CARD_TONES : CARD_TONES;
          const toneCls = palette[idx % palette.length];
          const hasEnglish = /[A-Za-z]/.test(card.term);

          return (
            <div
              key={card.id}
              onClick={(e) => {
                e.stopPropagation();
                toggleCard(card.id);
              }}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCard(card.id);
                }
              }}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={`text-left rounded-2xl border-2 p-4 transition-all shadow-xs flex flex-col justify-between gap-2.5 min-h-[124px] ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              } ${
                isOpen
                  ? isLavender
                    ? 'bg-[#E5EEFE] border-[#4A76C2] ring-2 ring-[#A9DDF5]/60'
                    : 'bg-[#EAF5E4] border-[#4E8336] ring-2 ring-[#9BCB83]/45'
                  : toneCls
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-lg bg-white border text-xs sm:text-sm font-extrabold ${
                    isLavender
                      ? 'border-[#C7BFE8] text-[#3F3A70]'
                      : 'border-[#EAE0D0] text-[#5C4D42]'
                  }`}
                >
                  {card.tag}
                </span>
                <div className="flex items-center gap-1.5">
                  {ttsAvailable && hasEnglish && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakEnglish(card.term);
                      }}
                      aria-label={`${card.term} 영어 발음 듣기`}
                      className={`min-h-[32px] px-2 py-1 rounded-lg bg-white border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                        isLavender
                          ? 'border-[#B4A7DE] text-[#3F2F80] hover:bg-[#EDE9FE]'
                          : 'border-[#D4A72C]/70 text-[#6E4D00] hover:bg-[#FFF3CC]'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>듣기</span>
                    </button>
                  )}
                  {interactive && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-extrabold ${
                        isOpen
                          ? isLavender
                            ? 'text-[#1D4487]'
                            : 'text-[#2E571C]'
                          : isLavender
                            ? 'text-[#4B3994]'
                            : 'text-[#8C6445]'
                      }`}
                    >
                      {isOpen ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          열림
                        </>
                      ) : (
                        '눌러보기'
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div className={`text-lg sm:text-xl font-extrabold leading-snug break-words ${isLavender ? 'text-[#14132E]' : 'text-[#1E1915]'}`}>
                {card.term}
              </div>

              {isOpen ? (
                <div
                  className={`rounded-xl bg-white border px-3 py-2.5 text-base font-bold leading-snug flex items-start gap-2 ${
                    isLavender
                      ? 'border-[#4A76C2]/45 text-[#132652]'
                      : 'border-[#4E8336]/45 text-[#17330B]'
                  }`}
                >
                  <BookOpen
                    className={`w-4 h-4 shrink-0 mt-1 ${
                      isLavender ? 'text-[#3D6BB8]' : 'text-[#4E8336]'
                    }`}
                  />
                  <div>
                    <span>{card.meaningKo}</span>
                    {card.hint && (
                      <span className={`block text-xs sm:text-sm font-semibold mt-0.5 ${isLavender ? 'text-[#3F436E]' : 'text-[#4B3F35]'}`}>
                        ({card.hint})
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`text-sm font-bold ${isLavender ? 'text-[#4B3F82]' : 'text-[#73583F]'}`}>
                  누르면 한글 뜻이 나와요
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Optional 1-question quick meaning check */}
      {interactive && miniQuiz && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`rounded-2xl border-2 p-4 space-y-2.5 ${
            miniCheckDone || miniFeedback === 'correct'
              ? 'bg-[#EAF5E4] border-[#58CC02]'
              : isLavender
                ? 'bg-[#F6F4FF] border-[#C5BBE8]'
                : 'bg-[#FFFDF8] border-[#E5DCCF]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-extrabold text-[#1E1915]">
              <CheckCircle2 className={`w-4 h-4 ${miniCheckDone || miniFeedback === 'correct' ? 'text-[#46A302]' : 'text-[#1CB0F6]'}`} />
              <span>단어 뜻 3초 확인 (선택):</span>
              <span className={`px-2.5 py-0.5 rounded-lg bg-white border font-extrabold ${isLavender ? 'border-[#B5A8E0] text-[#2F1F63]' : 'border-[#EAE0D0] text-[#2D2620]'}`}>
                {miniQuiz.term}
              </span>
              {ttsAvailable && (
                <button
                  type="button"
                  onClick={() => speakEnglish(miniQuiz.term)}
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-white border border-[#E5E5E5] text-xs font-extrabold text-[#4B3F35] inline-flex items-center gap-1 cursor-pointer hover:bg-[#F7F7F7]"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>발음</span>
                </button>
              )}
            </div>
            {(miniCheckDone || miniFeedback === 'correct') && (
              <span className="text-xs sm:text-sm font-extrabold text-[#2E6B00]">
                확인 완료!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {miniQuiz.choices.map((choice) => {
              const isPicked = miniPick === choice;
              const isRight = choice === miniQuiz.answer;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    setMiniPick(choice);
                    if (isRight) {
                      setMiniFeedback('correct');
                      playSuccessChime();
                      onCompleteMiniCheck?.();
                    } else {
                      setMiniFeedback('retry');
                      playClueChime();
                    }
                  }}
                  className={`dq-btn-3d min-h-[44px] px-3.5 py-2 rounded-xl border-2 text-sm sm:text-base font-extrabold cursor-pointer transition-colors ${
                    (miniCheckDone || (isPicked && miniFeedback === 'correct')) && isRight
                      ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                      : isPicked && miniFeedback === 'retry'
                        ? 'bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1212]'
                        : 'bg-white border-[#E5E5E5] text-[#1E1915] hover:bg-[#F7F7F7]'
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          {miniFeedback === 'retry' && (
            <p className="text-xs sm:text-sm font-bold text-[#9A1B1B]">
              위 단어 카드를 한 번 눌러 뜻을 본 다음 다시 골라 보세요!
            </p>
          )}
        </div>
      )}
    </div>
  );
};
