import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';
import { parseKeyFocus } from '../utils/keyFocusParser';
import { isTtsSupported, speakEnglish } from '../utils/tts';

interface BeginnerHintModalProps {
  open: boolean;
  onClose: () => void;
  question: ExtractedQuestion;
  analysis: QuestionSentenceAnalysis | null;
  islandTheme?: 'spring' | 'lavender';
}

const CIRCLED = ['①', '②', '③', '④', '⑤'];

export const BeginnerHintModal: React.FC<BeginnerHintModalProps> = ({
  open,
  onClose,
  question,
  analysis,
  islandTheme = 'spring',
}) => {
  const isLavender = islandTheme === 'lavender';
  const [revealAnswerGuide, setRevealAnswerGuide] = useState(false);

  useEffect(() => {
    setRevealAnswerGuide(false);
  }, [question.id, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const parsedKeyFocus = useMemo(
    () => parseKeyFocus(question.keyFocus, analysis, question.footnotes),
    [question.keyFocus, analysis, question.footnotes],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="쉬운 해석 · 단어 힌트"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#1B172B]/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border-4 shadow-2xl flex flex-col overflow-hidden ${
          isLavender
            ? 'bg-[#F8F8FF] border-[#8D7AD6] text-[#151433]'
            : 'bg-[#FFFDF8] border-[#D4A72C] text-[#1E1915]'
        }`}
      >
        {/* Top Sheet Header */}
        <div
          className={`px-5 sm:px-7 py-4 border-b-2 flex items-center justify-between gap-3 shrink-0 ${
            isLavender
              ? 'bg-[#EDE8FC] border-[#C6BEE8]'
              : 'bg-[#FFF5D6] border-[#EAD9B0]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center shrink-0 ${
                isLavender
                  ? 'bg-[#DED4FA] border-[#6A52A3] text-[#281A52]'
                  : 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
              }`}
            >
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold opacity-80">
                {question.sourceExam} · {question.sectionTitle}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                쉬운 해석 · 단어 힌트 (감점 없음!)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`min-h-[44px] px-4 py-2 rounded-2xl border-2 text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isLavender
                ? 'bg-white border-[#8D7AD6] text-[#1D1B42] hover:bg-[#E7E0FA]'
                : 'bg-white border-[#C9961A] text-[#2D2620] hover:bg-[#FFE18A]/40'
            }`}
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* Scrollable Beginner Study Sheet Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* 1. Easy Korean Story Summary */}
          <section className="rounded-2xl bg-white border-2 border-[#D8E2F2] p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#1E3F73]">
              <Compass className="w-5 h-5 shrink-0 text-[#3B6FB6]" />
              <span>1단계: 이 글이 전체적으로 무슨 뜻인가요?</span>
            </div>
            <p className="text-base sm:text-lg font-semibold leading-relaxed text-[#14182E]">
              {question.topicSummary}
            </p>
          </section>

          {/* 2. Structure Outline */}
          {question.structureOutline.length > 0 && (
            <section className="rounded-2xl bg-white border-2 border-[#DCE6D5] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#244D18]">
                <ListChecks className="w-5 h-5 shrink-0 text-[#4E8336]" />
                <span>2단계: 글의 전개 순서 쉽게 따라가기</span>
              </div>
              <ol className="space-y-2.5">
                {question.structureOutline.map((line, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 rounded-xl bg-[#F7FAF5] border border-[#DCE6D5] px-4 py-3 text-sm sm:text-base font-medium leading-relaxed text-[#1B2418]"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#4E8336] text-white font-mono text-sm font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {idx + 1}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 3. Essential Vocabulary (Always Open) */}
          {(parsedKeyFocus.cards.length > 0 ||
            (question.footnotes && question.footnotes.length > 0)) && (
            <section className="rounded-2xl bg-white border-2 border-[#DFD5F2] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#3B2675]">
                <Sparkles className="w-5 h-5 shrink-0 text-[#6A52A3]" />
                <span>3단계: 이 문제에서 꼭 알아야 할 단어 · 핵심 표현</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(question.footnotes ?? []).map((fn, idx) => (
                  <div
                    key={`fn-${idx}`}
                    className="rounded-xl bg-[#F8F6FE] border border-[#D4C8F0] px-4 py-3 space-y-1"
                  >
                    <div className="text-sm sm:text-base font-extrabold text-[#211442]">
                      * {fn.term}
                    </div>
                    <div className="text-sm font-semibold text-[#45396E]">
                      뜻: {fn.meaning}
                    </div>
                  </div>
                ))}
                {parsedKeyFocus.cards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-xl bg-[#F3F8FE] border border-[#BFD8F2] px-4 py-3 space-y-1"
                  >
                    <div className="text-sm sm:text-base font-extrabold text-[#142D52]">
                      {card.term}
                    </div>
                    <div className="text-sm font-semibold text-[#23487A]">
                      뜻: {card.meaningKo}
                      {card.hint ? ` (${card.hint})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Sentence Chunk-by-Chunk Easy Translation */}
          {analysis && (
            <section className="rounded-2xl bg-white border-2 border-[#BCE0F2] p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#144363]">
                <HelpCircle className="w-5 h-5 shrink-0 text-[#2E7BAE]" />
                <span>4단계: 가장 중요한 문장, 조각씩 끊어 읽기</span>
              </div>

              <div className="rounded-xl bg-[#F4FAFE] border border-[#BCE0F2] p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-extrabold text-[#2E7BAE]">
                    원문 핵심 문장
                  </div>
                  {isTtsSupported() && (
                    <button
                      type="button"
                      onClick={() => speakEnglish(analysis.sentence)}
                      className="min-h-[34px] px-3 py-1 rounded-xl bg-white border border-[#72B8DB] text-xs sm:text-sm font-extrabold text-[#144363] inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#E6F4FC]"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>문장 듣기</span>
                    </button>
                  )}
                </div>
                <p className="text-lg sm:text-xl font-bold leading-relaxed text-[#102438]">
                  {analysis.sentence}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {analysis.chunks.map((ch) => (
                  <div
                    key={ch.id}
                    className="rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-4 py-3 space-y-1"
                  >
                    <div className="text-xs font-extrabold text-[#3B6FB6]">
                      {ch.roleLabelKo}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-[#14182E]">
                      {ch.english}
                    </div>
                    <div className="text-sm font-semibold text-[#244D18]">
                      → {ch.meaningKo}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-[#EEF8EA] border border-[#9BCB83] p-4 space-y-1.5">
                <div className="text-xs font-extrabold text-[#244D18]">
                  자연스러운 우리말 해석
                </div>
                <p className="text-base font-bold leading-relaxed text-[#142B0E]">
                  {analysis.modelTranslationKo}
                </p>
                <p className="text-sm text-[#315726] leading-relaxed">
                  직독직해: {analysis.literalFlowKo}
                </p>
              </div>
            </section>
          )}

          {/* 5. Solving Strategy & Optional Full Spoiler Help */}
          <section
            className={`rounded-2xl border-2 p-5 space-y-3 ${
              isLavender
                ? 'bg-[#F0ECFC] border-[#A995E0]'
                : 'bg-[#FFF8DF] border-[#E0B94B]'
            }`}
          >
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold">
              <Lightbulb
                className={`w-5 h-5 shrink-0 ${
                  isLavender ? 'text-[#5B48A3]' : 'text-[#9B6B00]'
                }`}
              />
              <span>5단계: 답 고를 때 이것만 확인해 보세요!</span>
            </div>

            <p className="text-sm sm:text-base font-bold leading-relaxed">
              핵심 단서: {question.keyFocus}
            </p>

            {analysis && analysis.stepHints.length > 0 && (
              <ul className="space-y-1.5 text-sm sm:text-base leading-relaxed">
                {analysis.stepHints.map((hint, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-extrabold shrink-0">•</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-2">
              {!revealAnswerGuide ? (
                <button
                  type="button"
                  onClick={() => setRevealAnswerGuide(true)}
                  className="min-h-[48px] px-5 py-3 rounded-2xl bg-white border-2 border-[#B68411] text-sm sm:text-base font-extrabold text-[#4C3600] hover:bg-[#FFE18A]/45 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>정말 모르겠어요 · 정답 번호와 쉬운 해설 미리 보기</span>
                </button>
              ) : (
                <div className="rounded-2xl bg-white border-2 border-[#4E8336] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-base font-extrabold text-[#1A390D]">
                    <CheckCircle2 className="w-5 h-5 text-[#4E8336]" />
                    <span>정답 안내: {CIRCLED[question.answerIndex - 1]}번</span>
                  </div>
                  <p className="text-sm sm:text-base font-medium leading-relaxed text-[#1E2B19]">
                    {question.answerNote}
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-[#4E8336]">
                    이제 창을 닫고 직접 단계를 눌러 완료해 보세요!
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sticky Bottom Close Action */}
        <div
          className={`px-5 sm:px-7 py-3.5 border-t-2 flex justify-end shrink-0 ${
            isLavender
              ? 'bg-[#F4F2FC] border-[#D7D0F0]'
              : 'bg-[#FFF9EF] border-[#EAE0D0]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="dq-btn-3d min-h-[52px] px-7 py-3 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-base font-extrabold text-white cursor-pointer"
          >
            힌트 다 봤어요 · 문제 풀러 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};
