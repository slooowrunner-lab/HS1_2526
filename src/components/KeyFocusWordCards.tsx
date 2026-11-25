import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Eye, Sparkles } from 'lucide-react';
import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';
import { parseKeyFocus } from '../utils/keyFocusParser';
import { playClueChime } from '../utils/soundEffects';

interface KeyFocusWordCardsProps {
  keyFocus: string;
  analysis?: QuestionSentenceAnalysis | null;
  footnotes?: { term: string; meaning: string }[];
  interactive?: boolean;
  islandTheme?: 'spring' | 'lavender';
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

export const KeyFocusWordCards: React.FC<KeyFocusWordCardsProps> = ({
  keyFocus,
  analysis,
  footnotes,
  interactive = true,
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const parsed = useMemo(
    () => parseKeyFocus(keyFocus, analysis, footnotes),
    [keyFocus, analysis, footnotes],
  );
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const allRevealed =
    parsed.cards.length > 0 &&
    parsed.cards.every((card) => Boolean(revealedIds[card.id]));

  const toggleCard = (id: string) => {
    if (!interactive) return;
    playClueChime();
    setRevealedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClueChime();
    if (allRevealed) {
      setRevealedIds({});
    } else {
      const next: Record<string, boolean> = {};
      parsed.cards.forEach((c) => {
        next[c.id] = true;
      });
      setRevealedIds(next);
    }
  };

  if (parsed.cards.length === 0) {
    return (
      <p className={`text-xs sm:text-sm leading-relaxed ${isLavender ? 'text-[#2D2A54]' : 'text-[#4B3F35]'}`}>
        {keyFocus}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {parsed.strategySummary ? (
          <div
            className={`rounded-xl bg-white/90 border px-3 py-1.5 flex items-center gap-2 text-xs font-extrabold ${
              isLavender
                ? 'border-[#8D7AD6] text-[#3F297A]'
                : 'border-[#E0B94B] text-[#6E4D00]'
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 shrink-0 ${
                isLavender ? 'text-[#5B48A3]' : 'text-[#B47A00]'
              }`}
            />
            <span>핵심 전략: {parsed.strategySummary}</span>
          </div>
        ) : (
          <span className={`text-[11px] font-bold ${isLavender ? 'text-[#555082]' : 'text-[#7D6E61]'}`}>
            각 단어 카드를 클릭하면 간단한 한글 뜻이 나와요!
          </span>
        )}

        {interactive && (
          <button
            type="button"
            onClick={toggleAll}
            className={`px-2.5 py-1 rounded-lg bg-white border text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${
              isLavender
                ? 'border-[#8D7AD6] text-[#3F297A] hover:bg-[#E7E0FA]'
                : 'border-[#D4A72C]/70 text-[#6E4D00] hover:bg-[#FFE18A]/50'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{allRevealed ? '뜻 모두 접기' : '뜻 모두 보기'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {parsed.cards.map((card, idx) => {
          const isOpen = !interactive || Boolean(revealedIds[card.id]);
          const palette = isLavender ? LAVENDER_CARD_TONES : CARD_TONES;
          const toneCls = palette[idx % palette.length];

          return (
            <button
              key={card.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCard(card.id);
              }}
              className={`text-left rounded-2xl border-2 p-3 transition-all shadow-xs flex flex-col justify-between gap-2 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              } ${
                isOpen
                  ? isLavender
                    ? 'bg-[#E5EEFE] border-[#4A76C2] ring-2 ring-[#A9DDF5]/60'
                    : 'bg-[#EAF5E4] border-[#4E8336] ring-2 ring-[#9BCB83]/45'
                  : toneCls
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-lg bg-white/90 border text-[10px] font-extrabold ${
                    isLavender
                      ? 'border-[#C7BFE8] text-[#514A82]'
                      : 'border-[#EAE0D0] text-[#7D6E61]'
                  }`}
                >
                  {card.tag}
                </span>
                {interactive && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold ${
                      isOpen
                        ? isLavender
                          ? 'text-[#244E94]'
                          : 'text-[#3A6A24]'
                        : isLavender
                          ? 'text-[#5E4AA3]'
                          : 'text-[#9B785D]'
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <Check className="w-3 h-3" />
                        뜻 열림
                      </>
                    ) : (
                      '눌러서 뜻 보기'
                    )}
                  </span>
                )}
              </div>

              <div className={`text-sm font-extrabold leading-snug break-words ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {card.term}
              </div>

              {isOpen ? (
                <div
                  className={`rounded-lg bg-white/95 border px-2.5 py-1.5 text-xs font-bold leading-snug flex items-start gap-1.5 ${
                    isLavender
                      ? 'border-[#4A76C2]/40 text-[#162C5E]'
                      : 'border-[#4E8336]/40 text-[#1A390D]'
                  }`}
                >
                  <BookOpen
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      isLavender ? 'text-[#3D6BB8]' : 'text-[#4E8336]'
                    }`}
                  />
                  <div>
                    <span>{card.meaningKo}</span>
                    {card.hint && (
                      <span className={`block text-[11px] font-semibold mt-0.5 ${isLavender ? 'text-[#4B4E7A]' : 'text-[#5C4D42]'}`}>
                        ({card.hint})
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`text-[11px] font-semibold ${isLavender ? 'text-[#5B4F94]' : 'text-[#8A6D53]'}`}>
                  클릭하면 한글 뜻이 나와요
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
