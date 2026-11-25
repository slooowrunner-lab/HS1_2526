import React from 'react';
import { Award, Compass, Sparkles, Star, TrendingUp, X } from 'lucide-react';

export interface RewardCelebrationEvent {
  id: string;
  kind: 'level_up' | 'zone_unlock' | 'object_reward';
  title: string;
  subtitle: string;
  xpBonus?: number;
}

interface RewardAnimationControllerProps {
  event: RewardCelebrationEvent | null;
  reducedMotion: boolean;
  onDismiss: () => void;
}

const PARTICLE_OFFSETS = [
  { x: '-42px', y: '-34px', delay: '0ms', color: '#FFE18A' },
  { x: '44px', y: '-30px', delay: '60ms', color: '#9BCB83' },
  { x: '-56px', y: '8px', delay: '100ms', color: '#A9DDF5' },
  { x: '56px', y: '10px', delay: '140ms', color: '#F39A83' },
  { x: '0px', y: '-48px', delay: '80ms', color: '#C9B9E8' },
];

export const RewardAnimationController: React.FC<RewardAnimationControllerProps> = ({
  event,
  reducedMotion,
  onDismiss,
}) => {
  if (!event) return null;

  const isLevelUp = event.kind === 'level_up';
  const isZoneUnlock = event.kind === 'zone_unlock';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-50 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-auto"
    >
      <div
        className={`relative clay-card rounded-3xl p-4 flex items-center gap-3.5 ${
          isLevelUp
            ? 'bg-[#FFE18A] border-[#C9961A]'
            : isZoneUnlock
              ? 'bg-[#A8DCC8] border-[#4D9479]'
              : 'bg-[#FFF9EF] border-[#D4A72C]'
        }`}
      >
        {/* Subtle Star / Petal Burst */}
        {!reducedMotion && (
          <div className="pointer-events-none absolute inset-0 overflow-visible flex items-center justify-center">
            {PARTICLE_OFFSETS.map((p, i) => (
              <span
                key={i}
                style={
                  {
                    '--tx': p.x,
                    '--ty': p.y,
                    animationDelay: p.delay,
                    backgroundColor: p.color,
                  } as React.CSSProperties
                }
                className="rq-particle absolute w-2.5 h-2.5 rounded-full"
              />
            ))}
          </div>
        )}

        <div className="w-11 h-11 rounded-2xl bg-white border-2 border-[#EAE0D0] flex items-center justify-center shrink-0 shadow-xs">
          {isLevelUp ? (
            <TrendingUp className="w-5 h-5 text-[#9B6B00] animate-star-pop" />
          ) : isZoneUnlock ? (
            <Compass className="w-5 h-5 text-[#163B2D] animate-star-pop" />
          ) : (
            <Sparkles className="w-5 h-5 text-[#B47A00] animate-star-pop" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2D2620]">
            {isLevelUp ? (
              <Award className="w-3.5 h-3.5 text-[#9B6B00] shrink-0" />
            ) : (
              <Star className="w-3.5 h-3.5 text-[#9B6B00] fill-[#FFE18A] shrink-0" />
            )}
            <span className="truncate">{event.title}</span>
          </div>
          <p className="text-xs font-semibold text-[#3E342C] mt-0.5 leading-snug">
            {event.subtitle}
          </p>
          {event.xpBonus && event.xpBonus > 0 ? (
            <div className="text-xs font-mono font-extrabold text-[#1A4234] mt-1 tabular-nums">
              +{event.xpBonus} XP 획득!
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="보상 알림 닫기"
          className="p-1.5 rounded-lg text-[#5C4D42] hover:text-[#2D2620] hover:bg-white/50 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
