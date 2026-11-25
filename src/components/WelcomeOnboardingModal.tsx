import React, { useState } from 'react';
import { ArrowRight, Compass, Map as MapIcon, Sparkles } from 'lucide-react';
import mascotImage from '../assets/images/mascot_fox_detective_1795522642644.jpg';

interface WelcomeOnboardingModalProps {
  initialNickname: string;
  onComplete: (nickname: string, startImmediately: boolean) => void;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  initialNickname,
  onComplete,
}) => {
  const [nameInput, setNameInput] = useState(
    initialNickname === '꼬마 탐정' ? '' : initialNickname,
  );
  const [imgErr, setImgErr] = useState(false);

  const handleSubmit = (startImmediately: boolean) => {
    const clean = nameInput.trim() || '꼬마 탐정';
    onComplete(clean, startImmediately);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
      className="fixed inset-0 z-50 bg-[#2D2620]/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md clay-card rounded-3xl bg-[#FFF9EF] p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#D4A72C] bg-white shrink-0 flex items-center justify-center shadow-xs">
            {imgErr ? (
              <Sparkles className="w-7 h-7 text-[#9B785D]" />
            ) : (
              <img
                src={mascotImage}
                alt="여우 탐정 캐릭터"
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-1 text-xs font-extrabold text-[#9B785D]">
              <Compass className="w-3.5 h-3.5" />
              <span>READING QUEST 탐험 시작</span>
            </div>
            <h1
              id="welcome-heading"
              className="text-xl font-extrabold text-[#2D2620] mt-0.5 leading-snug"
            >
              안녕! 탐정 이름을 알려줄래?
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#5C4D42] leading-relaxed">
          이름만 입력하면 바로 <strong className="text-[#2D2620]">1번 문제</strong>부터 시작하거나
          전체 지도를 둘러볼 수 있어요. (입력한 기록은 이 기기에 자동 저장됩니다)
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(true);
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="student-onboarding-name"
              className="block text-xs font-extrabold text-[#5C4D42] mb-1.5"
            >
              내 이름 또는 별명
            </label>
            <input
              id="student-onboarding-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={14}
              placeholder="예: 민준, 영어탐정 (비워두면 꼬마 탐정)"
              autoFocus
              className="w-full px-4 py-3 text-sm font-bold text-[#2D2620] bg-white border-2 border-[#DFD2BE] rounded-2xl focus:outline-none focus:border-[#9B785D] placeholder:font-normal placeholder:text-[#9D8E80]"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="submit"
              className="clay-btn w-full py-3.5 px-5 rounded-2xl bg-[#F39A83] text-[#2D2620] font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>첫 문제 바로 풀기</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="w-full py-2.5 px-4 rounded-2xl bg-white border-2 border-[#EAE0D0] text-xs sm:text-sm font-bold text-[#5C4D42] hover:text-[#2D2620] hover:border-[#9B785D] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <MapIcon className="w-4 h-4" />
              <span>전체 지도부터 구경하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
