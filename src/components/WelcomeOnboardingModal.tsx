import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  FileImage,
  Flame,
  Map as MapIcon,
  Search,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { ExamYear } from '../types/question';
import { isTtsSupported, speakEnglish } from '../utils/tts';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface WelcomeOnboardingModalProps {
  initialNickname: string;
  initialStep?: 1 | 2;
  mode?: 'onboarding' | 'tutorial';
  onClose?: () => void;
  onComplete: (
    nickname: string,
    startImmediately: boolean,
    preferredYear?: ExamYear,
    dailyGoal?: number,
  ) => void;
}

const DAILY_GOALS = [
  { count: 1, label: '하루 1문제', reward: '가볍게 +30 XP' },
  { count: 3, label: '하루 3문제', reward: '추천 · +100 XP' },
  { count: 5, label: '하루 5문제', reward: '집중 · +180 XP' },
];

const DEMO_OPTIONS = [
  { id: 'temptation', label: '유혹', isCorrect: true },
  { id: 'library', label: '도서관', isCorrect: false },
  { id: 'schedule', label: '시간표', isCorrect: false },
];

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  initialNickname,
  initialStep = 1,
  mode = 'onboarding',
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [nameInput, setNameInput] = useState(
    initialNickname === '꼬마 탐정' || initialNickname === '영어 탐험가'
      ? ''
      : initialNickname,
  );
  const [preferredYear, setPreferredYear] = useState<ExamYear>('2025');
  const [dailyGoal, setDailyGoal] = useState<number>(3);
  const [demoPick, setDemoPick] = useState<string | null>(null);
  const [demoChecked, setDemoChecked] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  // StrictMode-safe directional page-turn tracking across steps 1..2
  const lastStepRef = useRef<{ step: 1 | 2; dir: 'next' | 'prev' | 'none' }>({
    step: initialStep,
    dir: 'none',
  });
  let stepTurnDir: 'next' | 'prev' | 'none' = lastStepRef.current.dir;
  if (lastStepRef.current.step !== step) {
    stepTurnDir = step > lastStepRef.current.step ? 'next' : 'prev';
  }
  useEffect(() => {
    lastStepRef.current = { step, dir: stepTurnDir };
  }, [step, stepTurnDir]);

  const stepAnimClass =
    stepTurnDir === 'next'
      ? 'rq-page-turn-next'
      : stepTurnDir === 'prev'
        ? 'rq-page-turn-prev'
        : '';

  const progressPct = step === 1 ? 55 : 100;
  const cleanName = nameInput.trim() || '영어 탐험가';
  const selectedDemoOption = DEMO_OPTIONS.find((o) => o.id === demoPick) ?? null;

  const handleFinish = (startImmediately: boolean) => {
    onComplete(cleanName, startImmediately, preferredYear, dailyGoal);
  };

  const renderFoxAvatar = (size: 'md' | 'lg' = 'md') => (
    <div
      className={`rq-fox-bob ${
        size === 'lg' ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16'
      } rounded-3xl overflow-hidden border-2 border-[#E5E5E5] bg-[#FFF9EF] shrink-0 flex items-center justify-center shadow-xs`}
    >
      {imgErr ? (
        <Sparkles className="w-8 h-8 text-[#58CC02]" />
      ) : (
        <img
          src={mascotImage}
          alt="여우 캐릭터"
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
      className="fixed inset-0 z-50 bg-[#1E1915]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white border-2 border-[#E5E5E5] shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Top Onboarding / Tutorial Bar */}
        <div className="px-5 sm:px-7 pt-5 pb-3 flex items-center gap-4 border-b border-[#F0F0F0]">
          {step === 2 && mode === 'onboarding' ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              aria-label="이전 화면으로 돌아가기"
              className="w-11 h-11 rounded-xl border-2 border-[#E5E5E5] bg-white hover:bg-[#F7F7F7] text-[#4B4B4B] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : mode === 'tutorial' && onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="푸는 법 창 닫기"
              className="w-11 h-11 rounded-xl border-2 border-[#E5E5E5] bg-white hover:bg-[#F7F7F7] text-[#4B4B4B] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-[#EAF9DC] border-2 border-[#58CC02]/40 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-[#46A302]" />
            </div>
          )}

          <div className="flex-1 h-4 bg-[#E5E5E5] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-[#58CC02] rounded-full transition-all duration-300 relative overflow-hidden"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
              <div
                aria-hidden="true"
                className="rq-progress-glint absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/45 to-transparent"
              />
            </div>
          </div>

          {mode === 'onboarding' ? (
            <button
              type="button"
              onClick={() => handleFinish(false)}
              className="min-h-[44px] text-sm font-extrabold text-[#5C4D42] hover:text-[#1E1915] px-3 py-1.5 rounded-xl hover:bg-[#F7F7F7] whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1"
            >
              <MapIcon className="w-4 h-4" />
              <span>전체 문제 보기</span>
            </button>
          ) : (
            <span className="text-xs sm:text-sm font-extrabold text-[#46A302] whitespace-nowrap shrink-0">
              푸는 법 안내
            </span>
          )}
        </div>

        {/* Body with 3D Page-Turn Motion Graphics */}
        <div
          key={`welcome-step-${step}`}
          className={`relative overflow-hidden p-5 sm:p-7 space-y-5 ${stepAnimClass}`}
        >
          {stepTurnDir !== 'none' && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-black/[0.07] via-white/35 to-transparent rq-page-sheen z-10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/[0.08] to-transparent rq-page-fold-shadow z-10"
              />
            </>
          )}

          {/* STEP 1: One-Screen Quick Setup + Instant Start */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                {renderFoxAvatar('lg')}
                <div className="dq-speech-bubble rq-speech-pop flex-1 rounded-2xl border-2 border-[#E5E5E5] bg-white px-5 py-4">
                  <div className="text-xs font-extrabold text-[#58A700] tracking-wide mb-1">
                    READING QUEST · 중학 영어 독해
                  </div>
                  <h1
                    id="welcome-heading"
                    className="text-xl sm:text-2xl font-extrabold text-[#1E1915] leading-snug"
                  >
                    반가워요! 바로 영어 독해를 시작해 볼까요?
                  </h1>
                  <p className="text-sm sm:text-base text-[#5C4D42] mt-1 leading-relaxed">
                    이름을 안 적어도 바로 첫 문제로 시작할 수 있고, 기록은 자동 저장돼요.
                  </p>
                </div>
              </div>

              {/* Optional Nickname */}
              <div className="space-y-1.5">
                <label
                  htmlFor="student-onboarding-name"
                  className="block text-sm font-extrabold text-[#3C3C3C]"
                >
                  이름 또는 별명 (안 써도 괜찮아요)
                </label>
                <input
                  id="student-onboarding-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFinish(true);
                    }
                  }}
                  maxLength={14}
                  placeholder="예: 민준, 지우 (Enter를 누르면 바로 시작)"
                  autoFocus
                  className="w-full px-4 py-3.5 text-base font-bold text-[#1E1915] bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl focus:outline-none focus:bg-white focus:border-[#1CB0F6] placeholder:font-normal placeholder:text-[#8A8A8A]"
                />
              </div>

              {/* Start Exam Selector */}
              <div className="space-y-2">
                <div className="text-sm font-extrabold text-[#3C3C3C]">
                  어느 시험지부터 풀까요?
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferredYear('2025')}
                    className={`dq-btn-3d relative text-left p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      preferredYear === '2025'
                        ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                        : 'bg-white border-[#E5E5E5] text-[#1E1915] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFE18A] border-2 border-[#E0B94B] flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-[#7A5200]" />
                      </div>
                      <div>
                        <div className="text-base font-extrabold">2025년 3월 학력평가</div>
                        <div className="text-xs font-bold text-[#4C7A34]">28문제 · 봄빛 초원 테마</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreferredYear('2026')}
                    className={`dq-btn-3d relative text-left p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      preferredYear === '2026'
                        ? 'bg-[#EAE3FA] border-[#7963A8] text-[#1E1442]'
                        : 'bg-white border-[#E5E5E5] text-[#1E1915] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-lg bg-[#1CB0F6] text-white text-xs font-extrabold">
                      최신 기출
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#DED6FA] border-2 border-[#8B72C9] flex items-center justify-center shrink-0">
                        <Compass className="w-5 h-5 text-[#3F297A]" />
                      </div>
                      <div>
                        <div className="text-base font-extrabold">2026년 3월 학력평가</div>
                        <div className="text-xs font-bold text-[#5E48A3]">28문제 · 라벤더 호수 테마</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Daily Goal Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-extrabold text-[#3C3C3C]">
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#FF9600]" />
                    <span>오늘 목표 (언제든 바꿀 수 있어요)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {DAILY_GOALS.map((g) => {
                    const active = dailyGoal === g.count;
                    return (
                      <button
                        key={g.count}
                        type="button"
                        onClick={() => setDailyGoal(g.count)}
                        className={`dq-btn-3d p-2.5 sm:p-3 rounded-2xl border-2 text-left cursor-pointer ${
                          active
                            ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                            : 'bg-white border-[#E5E5E5] text-[#1E1915] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <div className="text-sm font-extrabold">{g.label}</div>
                        <div className="text-xs font-bold text-[#5C4D42] mt-0.5">
                          {g.reward}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Visual 4-Step Guide + Live 1-Question Demo */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                {renderFoxAvatar('md')}
                <div className="dq-speech-bubble rq-speech-pop flex-1 rounded-2xl border-2 border-[#E5E5E5] bg-white px-5 py-3.5">
                  <h2
                    id="welcome-heading"
                    className="text-lg sm:text-xl font-extrabold text-[#1E1915]"
                  >
                    문제 푸는 법! 이렇게 4단계로 풀면 쉬워요
                  </h2>
                  <p className="text-sm text-[#5C4D42] mt-1">
                    어려우면 언제든 <strong>시험지 나란히 보기</strong>와{' '}
                    <strong>쉬운 해석·단어 힌트</strong>를 눌러 보세요!
                  </p>
                </div>
              </div>

              {/* Visual 4-Step Walkthrough */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FFFDF8] p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#FFE18A] text-[#2D2620] font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                    01
                  </span>
                  <div>
                    <div className="text-sm sm:text-base font-extrabold text-[#1E1915] flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-[#9B785D]" />
                      <span>단어 · 단서 확인</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5C4D42] mt-1 leading-relaxed">
                      어려운 단어와 핵심 단서를 눌러 뜻을 확인해요. 바로 3단계로 넘어가도 돼요!
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FFFDF8] p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#DDF4FF] text-[#143752] font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                    02
                  </span>
                  <div>
                    <div className="text-sm sm:text-base font-extrabold text-[#1E1915] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#1CB0F6]" />
                      <span>흐름 · 문장 해석</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5C4D42] mt-1 leading-relaxed">
                      글의 순서나 영어 문장 조각을 눌러 쉽게 해석해요.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FFFDF8] p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#EAE3FA] text-[#26184D] font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                    03
                  </span>
                  <div>
                    <div className="text-sm sm:text-base font-extrabold text-[#1E1915] flex items-center gap-1.5">
                      <FileImage className="w-4 h-4 text-[#6A52A3]" />
                      <span>시험지 보며 문제 풀기</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5C4D42] mt-1 leading-relaxed">
                      원본 시험지를 옆에 띄워두고 ①~⑤ 중 정답을 골라 제출해요.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FFFDF8] p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#D7FFB8] text-[#1E4600] font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                    04
                  </span>
                  <div>
                    <div className="text-sm sm:text-base font-extrabold text-[#1E1915] flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-[#B47A00] fill-[#FFE18A]" />
                      <span>해설 · 오답 메모</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5C4D42] mt-1 leading-relaxed">
                      정답 해설과 함께 나만의 한 줄 오답 메모가 자동 저장돼요!
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Mini Practice Demo */}
              <div className="rounded-2xl border-2 border-[#1CB0F6]/50 bg-[#F7FCFF] p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-[#143752]">
                    10초 맛보기 — 밑줄 친 단어의 뜻을 눌러보세요!
                  </span>
                  <span className="text-xs font-extrabold text-[#58A700]">
                    체험 1문제
                  </span>
                </div>

                <div className="rounded-xl bg-white border-2 border-[#E5E5E5] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-base sm:text-lg font-extrabold text-[#1E1915]">
                  <span>
                    They used a clever strategy called{' '}
                    <span className="underline decoration-dotted decoration-2 decoration-[#1CB0F6] underline-offset-4 text-[#143752]">
                      temptation
                    </span>{' '}
                    bundling.
                  </span>
                  {isTtsSupported() && (
                    <button
                      type="button"
                      onClick={() => speakEnglish('They used a clever strategy called temptation bundling.')}
                      className="min-h-[40px] px-3 py-1 rounded-xl bg-[#DDF4FF] border border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#CBEBFD]"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>발음 듣기</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {DEMO_OPTIONS.map((opt) => {
                    const isSelected = demoPick === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDemoPick(opt.id);
                          setDemoChecked(true);
                        }}
                        className={`dq-btn-3d min-h-[48px] px-3 py-2.5 rounded-2xl border-2 text-sm sm:text-base font-extrabold cursor-pointer ${
                          demoChecked && isSelected && opt.isCorrect
                            ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                            : demoChecked && isSelected && !opt.isCorrect
                              ? 'bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1212]'
                              : isSelected
                                ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#143752]'
                                : 'bg-white border-[#E5E5E5] text-[#1E1915] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {demoChecked && selectedDemoOption && (
                  <div
                    className={`rounded-xl px-4 py-2.5 text-sm font-extrabold flex items-center gap-2 ${
                      selectedDemoOption.isCorrect
                        ? 'bg-[#D7FFB8] text-[#285E00]'
                        : 'bg-[#FFDFE0] text-[#9A1B1B]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedDemoOption.isCorrect
                        ? '정답이에요! 실제 문제도 이렇게 누르면 바로 확인할 수 있어요!'
                        : 'temptation은 "유혹"이라는 뜻이에요. "유혹"을 눌러보세요!'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pinned Bottom Action Footer */}
        <div className="px-5 sm:px-7 py-4 bg-[#FAFAFA] border-t-2 border-[#E5E5E5] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="dq-btn-3d min-h-[50px] px-5 py-2.5 rounded-2xl bg-white border-2 border-[#E5E5E5] text-sm sm:text-base font-extrabold text-[#4B3F35] hover:bg-[#F7F7F7] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-5 h-5 text-[#1CB0F6]" />
                <span>푸는 법 먼저 보기 (10초)</span>
              </button>
              <button
                type="button"
                onClick={() => handleFinish(true)}
                className="dq-btn-3d flex-1 min-h-[54px] px-7 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white font-extrabold text-base sm:text-lg inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>바로 첫 문제 풀기</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          ) : mode === 'tutorial' && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="dq-btn-3d w-full min-h-[52px] px-7 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>확인 완료 · 돌아가기</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleFinish(false)}
                className="dq-btn-3d min-h-[50px] px-5 py-2.5 rounded-2xl bg-white border-2 border-[#E5E5E5] text-sm sm:text-base font-extrabold text-[#4B3F35] hover:bg-[#F7F7F7] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapIcon className="w-5 h-5" />
                <span>전체 문제 목록 보기</span>
              </button>
              <button
                type="button"
                onClick={() => handleFinish(true)}
                className="dq-btn-3d flex-1 min-h-[54px] px-7 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white font-extrabold text-base sm:text-lg inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>바로 첫 문제 풀기</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
