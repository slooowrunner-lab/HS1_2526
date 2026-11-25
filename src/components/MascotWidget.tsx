import React, { useState } from 'react';
import { Compass, Flag, Flame, Search, Sparkles, Star } from 'lucide-react';
import { MascotMood } from '../types/game';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface MascotWidgetProps {
  mood?: MascotMood;
  nickname: string;
  customMessage?: string;
  compact?: boolean;
  currentStreak?: number;
  islandTheme?: 'spring' | 'lavender';
}

const MOOD_COPY: Record<
  MascotMood,
  { badgeText: string; message: string; bgClass: string; borderClass: string }
> = {
  idle: {
    badgeText: '탐험 준비 완료',
    message: '안녕! 오늘도 두 탐험 섬에서 숨은 단서를 함께 찾아볼까?',
    bgClass: 'bg-[#FFF9EF]',
    borderClass: 'border-[#E8DAC8]',
  },
  start: {
    badgeText: '사건 접수',
    message: '질문을 먼저 읽고 무엇을 찾아야 할지 가설을 세워 보자!',
    bgClass: 'bg-[#A9DDF5]/25',
    borderClass: 'border-[#A9DDF5]',
  },
  clue: {
    badgeText: '단서 발견!',
    message: '좋은 눈썰미야! 돋보기로 어휘와 문장 단서를 하나씩 모아 보자.',
    bgClass: 'bg-[#FFE18A]/35',
    borderClass: 'border-[#FFE18A]',
  },
  correct: {
    badgeText: '정답 해결!',
    message: '와아, 정확히 추론했어! 별빛 배지에 한 걸음 더 가까워졌어!',
    bgClass: 'bg-[#9BCB83]/25',
    borderClass: 'border-[#9BCB83]',
  },
  retry: {
    badgeText: '다시 생각해 보기',
    message: '좋은 흐름이었어! 단서 카드와 원본 시험지를 다시 살피면 꼭 찾을 수 있어.',
    bgClass: 'bg-[#F39A83]/20',
    borderClass: 'border-[#F39A83]',
  },
  complete: {
    badgeText: '미션 클리어!',
    message: '멋지게 해결했어! 탐험 깃발을 꽂고 다음 모험으로 떠나자!',
    bgClass: 'bg-[#C9B9E8]/25',
    borderClass: 'border-[#C9B9E8]',
  },
};

export const MascotWidget: React.FC<MascotWidgetProps> = ({
  mood = 'idle',
  nickname,
  customMessage,
  compact = false,
  currentStreak = 0,
  islandTheme = 'spring',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const config = MOOD_COPY[mood];
  const isLavender = islandTheme === 'lavender';

  const cardBg = isLavender
    ? mood === 'correct'
      ? 'bg-[#EAF3FD]'
      : mood === 'retry'
        ? 'bg-[#FDECE7]'
        : mood === 'clue'
          ? 'bg-[#EDE9FC]'
          : 'bg-[#F4F2FC]'
    : config.bgClass;

  const cardBorder = isLavender
    ? mood === 'correct'
      ? 'border-[#5D9EC0]'
      : mood === 'retry'
        ? 'border-[#F39A83]'
        : mood === 'clue'
          ? 'border-[#9B85D1]'
          : 'border-[#C9B9E8]'
    : config.borderClass;

  let computedMessage = customMessage ?? config.message;
  if (!customMessage && mood === 'correct' && currentStreak >= 2) {
    computedMessage = `와아, ${currentStreak}연속 정답 콤보! 집중력이 최고조야!`;
  } else if (!customMessage && mood === 'retry') {
    computedMessage =
      '좋은 흐름이었어! 단서와 힌트를 확인하고 다시 콤보를 쌓아보자!';
  }

  const renderMoodIcon = () => {
    if (mood === 'clue')
      return <Search className={`w-3.5 h-3.5 ${isLavender ? 'text-[#5E4AA3]' : 'text-[#9B785D]'}`} />;
    if (mood === 'correct')
      return <Star className={`w-3.5 h-3.5 ${isLavender ? 'text-[#3B6FB6]' : 'text-[#5D8A43]'}`} />;
    if (mood === 'complete') return <Flag className="w-3.5 h-3.5 text-[#6E569E]" />;
    if (mood === 'retry') return <Sparkles className="w-3.5 h-3.5 text-[#C25D44]" />;
    return <Compass className={`w-3.5 h-3.5 ${isLavender ? 'text-[#5E4AA3]' : 'text-[#9B785D]'}`} />;
  };

  return (
    <div
      className={`rounded-2xl border-2 ${cardBorder} ${cardBg} ${
        compact ? 'p-3' : 'p-4'
      } flex items-center gap-3.5`}
    >
      <div
        className={`${
          compact ? 'w-14 h-14' : 'w-16 h-16'
        } rounded-2xl overflow-hidden border-2 ${
          isLavender ? 'border-[#B6A7DF] bg-[#F5F3FC]' : 'border-[#E8DAC8] bg-[#FFF9EF]'
        } shrink-0 flex items-center justify-center shadow-xs`}
      >
        {imgFailed ? (
          <div className={`flex flex-col items-center justify-center ${isLavender ? 'text-[#5E4AA3]' : 'text-[#9B785D]'}`}>
            <Search className="w-6 h-6" />
          </div>
        ) : (
          <img
            src={mascotImage}
            alt="포근한 여우 탐정 캐릭터"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-1.5 text-xs font-semibold ${isLavender ? 'text-[#474470]' : 'text-[#5C4D42]'}`}>
          {renderMoodIcon()}
          <span>{nickname}의 파트너 여우</span>
          <span className={isLavender ? 'text-[#A29EC8]' : 'text-[#B8A695]'} aria-hidden="true">
            ·
          </span>
          <span className={isLavender ? 'text-[#5E4AA3]' : 'text-[#9B785D]'}>{config.badgeText}</span>
          {currentStreak >= 2 && (
            <>
              <span className={isLavender ? 'text-[#A29EC8]' : 'text-[#B8A695]'} aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-0.5 text-[#C25D44] font-extrabold tabular-nums">
                <Flame className="w-3 h-3" />
                {currentStreak}연속
              </span>
            </>
          )}
        </div>
        <p className={`mt-1 text-xs sm:text-sm font-medium leading-snug ${isLavender ? 'text-[#1E1D40]' : 'text-[#2D2620]'}`}>
          {computedMessage}
        </p>
      </div>
    </div>
  );
};
