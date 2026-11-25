import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles, Star, Trophy, X } from 'lucide-react';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface FoxFireworksCelebrationProps {
  open: boolean;
  nickname: string;
  questionLabel: string;
  earnedStars: 0 | 1 | 2 | 3;
  xpDelta: number;
  currentStreak: number;
  reducedMotion: boolean;
  hasNextMission: boolean;
  onViewSummary: () => void;
  onGoNextMission: () => void;
  onClose: () => void;
}

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  trail: { x: number; y: number }[];
  twinkle: boolean;
}

const FIREWORK_PALETTES = [
  ['#FFE18A', '#FFB703', '#FFF3C4', '#F39A83'],
  ['#A8DCC8', '#52B788', '#D8F3DC', '#FFE18A'],
  ['#F39A83', '#FF6B6B', '#FFD6A5', '#FFF9EF'],
  ['#C9B9E8', '#9D4EDD', '#A9DDF5', '#FFE18A'],
  ['#A9DDF5', '#4CC9F0', '#FFFFFF', '#FFE18A'],
];

const PRAISE_PHRASES = [
  '최고에요! 정말 멋지게 풀어냈어요!',
  '최고에요! 역시 우리 반 명탐정이에요!',
  '최고에요! 단서부터 정답까지 완벽해요!',
  '최고에요! 집중력과 추리력이 대단해요!',
];

export const FoxFireworksCelebration: React.FC<FoxFireworksCelebrationProps> = ({
  open,
  nickname,
  questionLabel,
  earnedStars,
  xpDelta,
  currentStreak,
  reducedMotion,
  hasNextMission,
  onViewSummary,
  onGoNextMission,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgErr, setImgErr] = useState(false);

  const praiseText = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < questionLabel.length; i += 1) {
      hash = (hash * 31 + questionLabel.charCodeAt(i)) | 0;
    }
    return PRAISE_PHRASES[Math.abs(hash) % PRAISE_PHRASES.length];
  }, [questionLabel]);

  // Escape key dismiss
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Multi-burst Canvas Fireworks Engine
  useEffect(() => {
    if (!open || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: FireworkParticle[] = [];

    const spawnBurst = (cx: number, cy: number, paletteIdx: number) => {
      const palette = FIREWORK_PALETTES[paletteIdx % FIREWORK_PALETTES.length];
      const count = 48;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.22;
        const speed = 2.6 + Math.random() * 6.2;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          radius: 2.2 + Math.random() * 2.8,
          color: palette[i % palette.length],
          alpha: 1,
          decay: 0.011 + Math.random() * 0.01,
          gravity: 0.065,
          trail: [],
          twinkle: Math.random() > 0.45,
        });
      }

      // Inner bright core ring
      for (let j = 0; j < 18; j += 1) {
        const angle = (Math.PI * 2 * j) / 18;
        const speed = 1.4 + Math.random() * 2.1;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 1.6,
          color: '#FFFFFF',
          alpha: 1,
          decay: 0.018 + Math.random() * 0.01,
          gravity: 0.035,
          trail: [],
          twinkle: true,
        });
      }
    };

    // Immediate opening fireworks salvo
    spawnBurst(width * 0.24, height * 0.28, 0);
    spawnBurst(width * 0.76, height * 0.26, 2);
    spawnBurst(width * 0.5, height * 0.18, 3);

    // Follow-up celebratory firework waves
    let burstStep = 0;
    const burstTimer = window.setInterval(() => {
      burstStep += 1;
      const x = width * (0.15 + Math.random() * 0.7);
      const y = height * (0.14 + Math.random() * 0.42);
      spawnBurst(x, y, burstStep + Math.floor(Math.random() * 5));
      if (burstStep >= 10) {
        window.clearInterval(burstTimer);
      }
    }, 440);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();

        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0.02) {
          particles.splice(i, 1);
          continue;
        }

        // Draw glowing trail
        if (p.trail.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t += 1) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.45;
          ctx.lineWidth = p.radius * 0.9;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Draw firework spark head
        const flicker = p.twinkle ? 0.65 + Math.random() * 0.35 : 1;
        ctx.globalAlpha = Math.min(1, p.alpha * flicker);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(burstTimer);
      window.removeEventListener('resize', resize);
    };
  }, [open, reducedMotion]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="문제 해결 축하"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1712]/55 backdrop-blur-[2px]"
    >
      {/* Fullscreen Fireworks Layer */}
      {!reducedMotion && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
        />
      )}

      {/* Fox Detective Praise Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md clay-card rounded-3xl bg-[#FFFDF8] border-4 border-[#FFE18A] p-6 sm:p-7 text-center space-y-4 animate-star-pop"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="축하 창 닫기"
          className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-[#FFF9EF] border border-[#EAE0D0] text-[#5C4D42] hover:text-[#2D2620] flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Fox Character + Speech Bubble */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <div className="relative">
            <div
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-[#FFE18A] bg-[#FFF9EF] shadow-md flex items-center justify-center ${
                reducedMotion ? '' : 'rq-char-celebrating'
              }`}
            >
              {imgErr ? (
                <Trophy className="w-12 h-12 text-[#B47A00]" />
              ) : (
                <img
                  src={mascotImage}
                  alt="칭찬하는 여우 탐정 캐릭터"
                  onError={() => setImgErr(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className=" -top-3 -right-5 absolute px-3 py-1 rounded-2xl bg-[#F39A83] border-2 border-white text-xs font-extrabold text-[#2D2620] shadow-sm inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#FFF9EF]" />
              <span>최고에요!</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFE18A]/45 border-2 border-[#D4A72C] px-4 py-2.5 text-sm sm:text-base font-extrabold text-[#2D2620] leading-snug">
            “{nickname} 탐정님, {praiseText}”
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[#9B785D]">{questionLabel}</div>
          <div className="flex items-center justify-center gap-1.5 py-1">
            {[1, 2, 3].map((s) => {
              const filled = s <= earnedStars;
              return (
                <Star
                  key={s}
                  style={{ animationDelay: `${(s - 1) * 120}ms` }}
                  className={`w-7 h-7 ${
                    filled
                      ? 'text-[#B47A00] fill-[#FFE18A] animate-star-pop'
                      : 'text-[#DDD2C0]'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
            {xpDelta > 0 && (
              <span className="px-3 py-1 rounded-xl bg-[#EAF5E4] border border-[#5D8A43] text-[#1A390D] font-mono tabular-nums">
                +{xpDelta} XP 획득!
              </span>
            )}
            {currentStreak >= 2 && (
              <span className="px-3 py-1 rounded-xl bg-[#F39A83]/25 border border-[#D1684E] text-[#7A2D1C] tabular-nums">
                {currentStreak}연속 정답 중!
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onViewSummary}
            className="clay-btn px-4 py-2.5 rounded-2xl bg-[#FFF9EF] text-xs sm:text-sm font-extrabold text-[#2D2620] cursor-pointer"
          >
            결과 · 노트 보기
          </button>

          {hasNextMission && (
            <button
              type="button"
              onClick={onGoNextMission}
              className="clay-btn px-5 py-2.5 rounded-2xl bg-[#A8DCC8] text-xs sm:text-sm font-extrabold text-[#163B2D] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>다음 문제 풀기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
