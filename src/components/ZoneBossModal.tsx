import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Crown,
  FileImage,
  RotateCcw,
  Star,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { formatItemNumber } from '../utils/gameStorage';
import { PngViewer } from './PngViewer';

interface ZoneBossModalProps {
  zoneName: string;
  sectionTitle: string;
  zoneKey: string;
  items: ExtractedQuestion[];
  alreadyCleared: boolean;
  onClose: () => void;
  onRecordBossQuestionResult: (
    question: ExtractedQuestion,
    isCorrect: boolean,
    choiceIdx: number,
  ) => void;
  onBossZoneCleared: (zoneKey: string, bonusXp: number) => void;
  onJumpToQuestion?: (questionId: string) => void;
}

const CIRCLED = ['①', '②', '③', '④', '⑤'];

export const ZoneBossModal: React.FC<ZoneBossModalProps> = ({
  zoneName,
  sectionTitle,
  zoneKey,
  items,
  alreadyCleared,
  onClose,
  onRecordBossQuestionResult,
  onBossZoneCleared,
  onJumpToQuestion,
}) => {
  const totalSeconds = items.length * 80; // 3 items = 240s (4m), 2 items = 160s
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submittedThisQ, setSubmittedThisQ] = useState(false);
  const [results, setResults] = useState<
    { question: ExtractedQuestion; isCorrect: boolean }[]
  >([]);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [finished, setFinished] = useState(false);
  const [showMobilePng, setShowMobilePng] = useState(false);

  const currentQuestion = items[currentIdx];

  useEffect(() => {
    if (finished) return;
    if (secondsLeft <= 0) {
      setFinished(true);
      return;
    }
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [finished, secondsLeft]);

  const maxChartVal = useMemo(
    () =>
      currentQuestion?.chart
        ? Math.max(...currentQuestion.chart.data.map((d) => d.value), 1)
        : 100,
    [currentQuestion],
  );

  const handleSubmit = () => {
    if (!currentQuestion || selectedChoice === null || submittedThisQ) return;
    const isCorrect = selectedChoice === currentQuestion.answerIndex;
    setSubmittedThisQ(true);
    setResults((prev) => [...prev, { question: currentQuestion, isCorrect }]);
    onRecordBossQuestionResult(currentQuestion, isCorrect, selectedChoice);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= items.length) {
      const allCorrect =
        results.length === items.length && results.every((r) => r.isCorrect);
      if (allCorrect) {
        onBossZoneCleared(zoneKey, alreadyCleared ? 20 : 50);
      }
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedChoice(null);
      setSubmittedThisQ(false);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedChoice(null);
    setSubmittedThisQ(false);
    setResults([]);
    setSecondsLeft(totalSeconds);
    setFinished(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (finished || !currentQuestion) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!submittedThisQ && ['1', '2', '3', '4', '5'].includes(e.key)) {
        const num = Number(e.key);
        if (num <= currentQuestion.choices.length) {
          e.preventDefault();
          setSelectedChoice(num);
        }
      } else if (e.key === 'Enter') {
        if (!submittedThisQ && selectedChoice !== null) {
          e.preventDefault();
          handleSubmit();
        } else if (submittedThisQ) {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const isLavender = zoneKey.startsWith('2026-');
  const correctCount = results.filter((r) => r.isCorrect).length;
  const isVictory =
    finished && results.length === items.length && correctCount === items.length;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D2620]/60 flex items-center justify-center p-3 sm:p-5">
      <div
        className={`w-full max-w-6xl h-[92vh] clay-card rounded-3xl overflow-hidden flex flex-col ${
          isLavender ? 'bg-[#F3F1FC] !border-[#B8B4E3]' : 'bg-[#FFF9EF]'
        }`}
      >
        {/* Boss Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b-2 ${
            isLavender ? 'border-[#C9C2E8] bg-[#FAF9FF]' : 'border-[#EAE0D0] bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 ${
                isLavender
                  ? 'bg-[#C9B9E8] border-[#6A52A3]'
                  : 'bg-[#FFE18A] border-[#D4A72C]'
              }`}
            >
              <Crown className={`w-5 h-5 ${isLavender ? 'text-[#211442]' : 'text-[#9B6B00]'}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-extrabold ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                실전 미니테스트 · {sectionTitle}
              </div>
              <h2 className={`text-base sm:text-lg font-extrabold truncate ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                {zoneName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!finished && (
              <>
                <span className={`text-xs font-mono font-bold tabular-nums ${isLavender ? 'text-[#49467A]' : 'text-[#5C4D42]'}`}>
                  {currentIdx + 1} / {items.length}문제
                </span>
                <div
                  className={`px-3 py-1.5 rounded-xl border-2 font-mono text-xs sm:text-sm font-extrabold tabular-nums inline-flex items-center gap-1.5 ${
                    secondsLeft <= 30
                      ? 'bg-[#F39A83]/25 border-[#D1684E] text-[#7A2D1C]'
                      : isLavender
                        ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#1D1B42]'
                        : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                    {String(secondsLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="미니테스트 닫기"
              className={`dq-btn-3d min-w-[40px] min-h-[40px] p-2 rounded-xl border-2 flex items-center justify-center hover:bg-[#F39A83]/20 cursor-pointer ${
                isLavender
                  ? 'bg-[#F3F1FC] border-[#C9C2E8] text-[#1D1B42]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#2D2620]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!finished && items.length > 0 && (
            <div className="w-full pt-1">
              <div
                className={`h-3 rounded-full overflow-hidden border ${
                  isLavender
                    ? 'bg-[#E6E4F6] border-[#D4CEF0]'
                    : 'bg-[#EFECE5] border-[#E2DACB]'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                    isLavender
                      ? 'bg-gradient-to-r from-[#7C5CBF] to-[#4F8EDB]'
                      : 'bg-[#58CC02]'
                  }`}
                  style={{
                    width: `${Math.round(
                      ((currentIdx + (submittedThisQ ? 1 : 0)) / items.length) *
                        100,
                    )}%`,
                  }}
                >
                  <div className="h-1 bg-white/35 rounded-full mx-1.5 mt-0.5" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        {finished ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex items-center justify-center">
            <div className="max-w-lg w-full clay-card rounded-3xl p-6 sm:p-8 text-center space-y-5 bg-white">
              <div
                className={`w-16 h-16 rounded-2xl border-2 mx-auto flex items-center justify-center animate-star-pop ${
                  isVictory
                    ? 'bg-[#FFE18A] border-[#D4A72C]'
                    : 'bg-[#F39A83]/25 border-[#D1684E]'
                }`}
              >
                {isVictory ? (
                  <Crown className="w-9 h-9 text-[#9B6B00]" />
                ) : (
                  <RotateCcw className="w-8 h-8 text-[#C25D44]" />
                )}
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#2D2620]">
                  {isVictory
                    ? `${zoneName} 미니테스트 통과!`
                    : secondsLeft <= 0
                      ? '제한 시간이 종료되었어요!'
                      : '아쉽지만 한 문제만 더 집중해 보자!'}
                </h3>
                <p className="text-sm text-[#5C4D42] mt-1 tabular-nums">
                  {items.length}문제 중{' '}
                  <strong className="text-[#2D2620]">{correctCount}문제</strong>{' '}
                  정답 {isVictory ? `· 보너스 +${alreadyCleared ? 20 : 50} XP!` : ''}
                </p>
              </div>

              <div className="space-y-2 text-left">
                {items.map((it, idx) => {
                  const res = results[idx];
                  return (
                    <div
                      key={it.id}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-2 ${
                        res?.isCorrect
                          ? 'bg-[#9BCB83]/20 border-[#5D8A43] text-[#1A3110]'
                          : 'bg-[#F39A83]/15 border-[#D1684E] text-[#7A2D1C]'
                      }`}
                    >
                      <span className="font-bold truncate">
                        {it.sourceExam} · {it.sectionTitle}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold">
                          {res ? (res.isCorrect ? '정답' : '오답') : '미제출'}
                        </span>
                        {onJumpToQuestion && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onJumpToQuestion(it.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#DFD2BE] hover:border-[#9B785D] text-xs font-extrabold text-[#2D2620] cursor-pointer"
                          >
                            해설·복습 →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="dq-btn-3d min-h-[46px] px-5 py-2.5 rounded-2xl border-2 border-[#DFD2BE] bg-[#FFF9EF] text-sm font-extrabold text-[#2D2620] cursor-pointer"
                >
                  탐험 지도로
                </button>
                {!isVictory && (
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="dq-btn-3d min-h-[46px] px-5 py-2.5 rounded-2xl border-2 border-[#46A302] bg-[#58CC02] text-sm font-extrabold text-white cursor-pointer"
                  >
                    미니테스트 다시 풀기
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          currentQuestion && (
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
              {/* Left PNG Pane */}
              <div
                className={`${
                  showMobilePng ? 'block h-[420px]' : 'hidden lg:block'
                } lg:col-span-6 lg:h-full min-h-0`}
              >
                <PngViewer
                  pages={currentQuestion.pages}
                  targetExamLabel={`${currentQuestion.sourceExam} (${formatItemNumber(currentQuestion.originalItemNumber)})`}
                  targetQuestionId={currentQuestion.id}
                  islandTheme={isLavender ? 'lavender' : 'spring'}
                />
              </div>

              {/* Right Boss Question Card */}
              <div
                className={`lg:col-span-6 clay-card rounded-2xl p-5 flex flex-col justify-between gap-4 bg-white overflow-y-auto ${
                  isLavender ? '!border-[#C6BEE8]' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-mono font-bold ${isLavender ? 'text-[#6852A3]' : 'text-[#9B785D]'}`}>
                      {currentQuestion.sourceExam} · {currentQuestion.points}점
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMobilePng((v) => !v)}
                      className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#A9DDF5]/40 border border-[#72B8DB] text-xs font-bold text-[#1D4861] cursor-pointer"
                    >
                      <FileImage className="w-3.5 h-3.5" />
                      <span>{showMobilePng ? '지문 접기' : '지문 보기'}</span>
                    </button>
                  </div>

                  <h3 className={`text-lg sm:text-xl font-bold leading-relaxed ${isLavender ? 'text-[#1D1B42]' : 'text-[#2D2620]'}`}>
                    {currentQuestion.prompt}
                  </h3>

                  {/* Chart & Table inside Boss Arena */}
                  {currentQuestion.chart && (
                    <div className="rounded-xl border border-[#A9DDF5] bg-[#A9DDF5]/15 p-3.5 space-y-2">
                      <div className="text-xs font-extrabold text-[#2D2620]">
                        {currentQuestion.chart.title}
                      </div>
                      {currentQuestion.chart.data.map((row) => (
                        <div key={row.label} className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-5 text-xs truncate text-[#2D2620]">
                            {row.label}
                          </div>
                          <div className="col-span-5 h-2 bg-white rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isLavender ? 'bg-[#7963A8]' : 'bg-[#9BCB83]'}`}
                              style={{ width: `${(row.value / maxChartVal) * 100}%` }}
                            />
                          </div>
                          <div className="col-span-2 text-right font-mono text-xs font-bold tabular-nums">
                            {row.value}
                            {row.unit ?? ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQuestion.table && (
                    <div className={`overflow-x-auto border rounded-xl ${isLavender ? 'border-[#9BBCEB]' : 'border-[#A8DCC8]'}`}>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`border-b ${isLavender ? 'bg-[#F3F1FC] border-[#C9C2E8]' : 'bg-[#FFF9EF] border-[#EAE0D0]'}`}>
                            {currentQuestion.table.headers.map((h) => (
                              <th key={h} className="px-2.5 py-1.5 font-bold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isLavender ? 'divide-[#ECEAF8]' : 'divide-[#F2ECE1]'}`}>
                          {currentQuestion.table.rows.map((r, ri) => (
                            <tr key={ri}>
                              {r.map((cell, ci) => (
                                <td key={ci} className="px-2.5 py-1.5 tabular-nums">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Choices */}
                  <div className="space-y-2">
                    {currentQuestion.choices.map((ch, idx) => {
                      const num = idx + 1;
                      const isSel = selectedChoice === num;
                      const isAns = currentQuestion.answerIndex === num;

                      let cls = isLavender
                        ? 'bg-white border-[#D3D1EC] hover:border-[#6A52A3] text-[#1D1B42]'
                        : 'bg-white border-[#EAE0D0] hover:border-[#9B785D] text-[#2D2620]';
                      if (submittedThisQ && isAns) {
                        cls =
                          'bg-[#9BCB83]/25 border-[#5D8A43] text-[#1A3110] font-bold';
                      } else if (submittedThisQ && isSel && !isAns) {
                        cls = 'bg-[#F39A83]/25 border-[#D1684E] text-[#7A2D1C]';
                      } else if (isSel) {
                        cls = isLavender
                          ? 'bg-[#E5DFFA] border-[#6A52A3] text-[#1E1442] font-semibold'
                          : 'bg-[#FFE18A]/45 border-[#C9961A] text-[#2D2620] font-semibold';
                      }

                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={submittedThisQ}
                          onClick={() => setSelectedChoice(num)}
                          className={`dq-btn-3d min-h-[48px] w-full text-left px-4 py-3 rounded-2xl border-2 flex items-start justify-between gap-2 text-base cursor-pointer disabled:cursor-default ${cls}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`font-mono font-bold shrink-0 ${isLavender ? 'text-[#5D4C9E]' : 'text-[#9B785D]'}`}>
                              {CIRCLED[idx] ?? `${num}.`}
                            </span>
                            <span>{ch}</span>
                          </div>
                          {submittedThisQ && isAns && (
                            <Check className="w-4 h-4 text-[#4C7A34] shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action */}
                <div className={`pt-3 border-t space-y-3 ${isLavender ? 'border-[#E5E2F5]' : 'border-[#F2ECE1]'}`}>
                  {submittedThisQ ? (
                    <div className="rq-feedback-rise space-y-2.5">
                      <div
                        className={`rounded-2xl border-2 p-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 ${
                          selectedChoice === currentQuestion.answerIndex
                            ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1A4205]'
                            : 'bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1B1B]'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 shrink-0 ${
                            selectedChoice === currentQuestion.answerIndex
                              ? 'text-[#9B6B00] fill-[#FFE18A] animate-star-pop'
                              : 'text-[#EA2B2B]'
                          }`}
                        />
                        <span>
                          {selectedChoice === currentQuestion.answerIndex
                            ? '정답입니다!'
                            : `정답은 ${CIRCLED[currentQuestion.answerIndex - 1]}번이에요.`}{' '}
                          {currentQuestion.answerNote}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleNext}
                        className={`dq-btn-3d min-h-[46px] w-full py-2.5 rounded-2xl border-2 text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                          isLavender
                            ? 'bg-[#7C5CBF] border-[#5B40A0]'
                            : 'bg-[#58CC02] border-[#46A302]'
                        }`}
                      >
                        <span>
                          {currentIdx + 1 >= items.length
                            ? '최종 결과 확인하기'
                            : '다음 테스트 문제'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={selectedChoice === null}
                        onClick={handleSubmit}
                        className={`dq-btn-3d min-h-[48px] w-full py-3 rounded-2xl border-2 text-base font-extrabold disabled:opacity-45 cursor-pointer text-white ${
                          isLavender
                            ? 'bg-[#7C5CBF] border-[#5B40A0]'
                            : 'bg-[#58CC02] border-[#46A302]'
                        }`}
                      >
                        정답 제출하기
                      </button>
                      <div className="text-center text-xs text-[#7D6E61]">
                        키보드 1~5번으로 선택하고 Enter로 제출할 수 있어요
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
