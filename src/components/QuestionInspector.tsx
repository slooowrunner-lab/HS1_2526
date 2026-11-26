import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Eye, EyeOff } from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { PngViewer } from './PngViewer';

interface QuestionInspectorProps {
  question: ExtractedQuestion;
  currentIndexInFilter: number;
  totalInFilter: number;
  onPrev: () => void;
  onNext: () => void;
  customTranscript: string;
  onUpdateTranscript: (id: string, value: string) => void;
}

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤'];

const FORMAT_LABELS: Record<ExtractedQuestion['format'], string> = {
  'multiple-choice': '일반 5지선다',
  'in-passage-choice': '지문 내 번호형',
  'chart-analysis': '도표 수치 분석',
  'notice-table': '안내문 · 표',
  'sentence-insertion': '문장 삽입',
  'paragraph-ordering': '글의 순서 배열',
  'summary-completion': '요약문 완성',
  'long-passage-set': '장문 세트',
};

export const QuestionInspector: React.FC<QuestionInspectorProps> = ({
  question,
  currentIndexInFilter,
  totalInFilter,
  onPrev,
  onNext,
  customTranscript,
  onUpdateTranscript,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    setSelectedChoice(null);
    setShowAnswer(false);
    setCopiedId(false);
  }, [question.id]);

  const handleCopyJson = async () => {
    const payload = customTranscript
      ? { ...question, customTranscript }
      : question;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const maxChartVal = question.chart
    ? Math.max(...question.chart.data.map((d) => d.value), 1)
    : 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
      {/* Left: Extracted Structured Data */}
      <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl flex flex-col">
        {/* Inspector Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              #{String(question.globalIndex).padStart(2, '0')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700">
              {question.sectionNumber} {question.sectionTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>{question.sourceExam}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {question.pages.map((p) => `${p}p`).join('–')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-slate-700">
              {question.points}점
            </span>
            <span aria-hidden="true">·</span>
            <span>{FORMAT_LABELS[question.format]}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>JSON 복사</span>
                </>
              )}
            </button>

            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndexInFilter <= 0}
                aria-label="이전 문항"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs font-mono text-slate-600 tabular-nums border-x border-slate-200">
                {currentIndexInFilter + 1} / {totalInFilter}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndexInFilter >= totalInFilter - 1}
                aria-label="다음 문항"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-35 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Prompt */}
          <div>
            {question.setRangeLabel && (
              <p className="text-xs font-medium text-blue-700 mb-1.5">
                {question.setRangeLabel}
              </p>
            )}
            <h2 className="text-lg font-semibold text-slate-900 leading-snug">
              {question.prompt}
            </h2>
          </div>

          {/* Chart Data (if 25번) */}
          {question.chart && (
            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  추출된 도표 수치 · {question.chart.title}
                </h3>
                {question.chart.subtitle && (
                  <span className="text-xs text-slate-500">
                    {question.chart.subtitle}
                  </span>
                )}
              </div>
              <div className="space-y-2.5">
                {question.chart.data.map((row) => (
                  <div key={row.label} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-5 text-xs text-slate-700 truncate" title={row.label}>
                      {row.label}
                    </div>
                    <div className="col-span-5 h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-sm"
                        style={{ width: `${(row.value / maxChartVal) * 100}%` }}
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono text-xs font-medium text-slate-900 tabular-nums">
                      {row.value}
                      {row.unit ?? ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Data (if 27-28번) */}
          {question.table && (
            <div className="pt-5 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-800 mb-3">
                추출된 안내문 표 데이터
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      {question.table.headers.map((header) => (
                        <th key={header} className="px-3 py-2 font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {question.table.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-3 py-2 text-slate-800 tabular-nums"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Topic Summary & Logical Structure */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                지문 핵심 요약
              </h3>
              <p className="text-sm text-slate-800 leading-relaxed">
                {question.topicSummary}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                단락 전개 구조
              </h3>
              <ol className="space-y-1.5">
                {question.structureOutline.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed"
                  >
                    <span className="font-mono text-xs text-slate-400 tabular-nums mt-1 shrink-0">
                      0{idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-1">
                핵심 출제 단서
              </h3>
              <p className="text-sm text-slate-800 leading-relaxed">
                {question.keyFocus}
              </p>
            </div>
          </div>

          {/* Underlined Targets & Footnotes */}
          {(question.underlinedTargets?.length || question.footnotes?.length) && (
            <div className="pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              {question.underlinedTargets && question.underlinedTargets.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">
                    밑줄 / 지시 대상
                  </h3>
                  <ul className="space-y-1 text-xs font-mono text-slate-800">
                    {question.underlinedTargets.map((target, i) => (
                      <li key={i} className="underline decoration-slate-400 underline-offset-4">
                        {target}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {question.footnotes && question.footnotes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">
                    추출된 각주 어휘
                  </h3>
                  <dl className="space-y-1 text-xs">
                    {question.footnotes.map((fn) => (
                      <div key={fn.term} className="flex items-baseline gap-2">
                        <dt className="font-mono font-medium text-slate-900">
                          * {fn.term}
                        </dt>
                        <dd className="text-slate-600">{fn.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}

          {/* Choices */}
          <div className="pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-xs font-semibold text-slate-500">
                추출된 선택지 (클릭하여 자가 점검)
              </h3>
              <button
                type="button"
                onClick={() => setShowAnswer((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {showAnswer ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>정답 숨기기</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>정답 · 해설 확인</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              {question.choices.map((choice, idx) => {
                const choiceNum = idx + 1;
                const isSelected = selectedChoice === choiceNum;
                const isCorrect = question.answerIndex === choiceNum;
                const revealState = showAnswer || selectedChoice !== null;

                let stateClasses =
                  'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
                if (revealState && isCorrect) {
                  stateClasses =
                    'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium';
                } else if (isSelected && !isCorrect) {
                  stateClasses =
                    'border-rose-400 bg-rose-50/70 text-rose-950';
                }

                return (
                  <button
                    key={choiceNum}
                    type="button"
                    onClick={() => setSelectedChoice(choiceNum)}
                    className={`w-full text-left flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm border rounded-lg transition-colors ${stateClasses}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-medium shrink-0 text-slate-500">
                        {CIRCLED_NUMBERS[idx] ?? `${choiceNum}.`}
                      </span>
                      <span>{choice}</span>
                    </div>
                    {revealState && isCorrect && (
                      <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                        정답
                      </span>
                    )}
                    {isSelected && !isCorrect && (
                      <span className="text-xs font-semibold text-rose-700 whitespace-nowrap shrink-0">
                        오답
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {(showAnswer || selectedChoice !== null) && (
              <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">
                  정답 {CIRCLED_NUMBERS[question.answerIndex - 1]} ({question.answerIndex}번)
                </span>
                <span className="mx-1.5 text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span>{question.answerNote}</span>
              </div>
            )}
          </div>

          {/* Custom User Notes / Transcript Override */}
          <div className="pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor={`note-${question.id}`}
                className="text-xs font-semibold text-slate-500"
              >
                사용자 검수 메모 / 개별 텍스트 입력 (내보내기 JSON·CSV에 자동 반영)
              </label>
              {customTranscript && (
                <button
                  type="button"
                  onClick={() => onUpdateTranscript(question.id, '')}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  초기화
                </button>
              )}
            </div>
            <textarea
              id={`note-${question.id}`}
              rows={2}
              value={customTranscript}
              onChange={(e) => onUpdateTranscript(question.id, e.target.value)}
              placeholder="우측 원본 PNG를 대조하며 추가 메모, 변형 포인트, 또는 직접 전사한 문장을 기록하세요."
              className="w-full px-3 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-y"
            />
          </div>
        </div>
      </section>

      {/* Right: Original PNG Side-by-Side Viewer */}
      <aside className="xl:col-span-6 flex flex-col">
        <PngViewer
          pages={question.pages}
          targetExamLabel={`${question.sourceExam} (${question.originalItemNumber})`}
          targetQuestionId={question.id}
          islandTheme={question.examYear === '2026' ? 'lavender' : 'spring'}
        />
      </aside>
    </div>
  );
};
