import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Type,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { FontScaleMode, MissionProgress } from '../types/game';

interface FloatingToolkitProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  bookmarkedIds: string[];
  currentQuestionId?: string;
  isInWorkspace: boolean;
  isLavenderTheme?: boolean;
  fontScale: FontScaleMode;
  onChangeFontScale: (next: FontScaleMode) => void;
  onSelectQuestion: (questionId: string) => void;
  onOpenHintSheet?: () => void;
  onOpenTutorial?: () => void;
}

const FONT_SCALE_OPTIONS: { id: FontScaleMode; label: string; ptLabel: string }[] = [
  { id: 'md', label: '기본', ptLabel: '10pt' },
  { id: 'lg', label: '크게', ptLabel: '11.5pt' },
  { id: 'xl', label: '아주 크게', ptLabel: '13pt' },
];

export const FloatingToolkit: React.FC<FloatingToolkitProps> = ({
  questions,
  progressById,
  bookmarkedIds,
  currentQuestionId,
  isInWorkspace,
  isLavenderTheme = false,
  fontScale,
  onChangeFontScale,
  onSelectQuestion,
  onOpenHintSheet,
  onOpenTutorial,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | '2025' | '2026' | 'unsolved' | 'bookmarked'
  >('all');

  useEffect(() => {
    if (!searchModalOpen && !menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchModalOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchModalOpen, menuOpen]);

  const filteredQuestions = useMemo(() => {
    const qLower = query.trim().toLowerCase().replace(/^#/, '');
    return questions.filter((q) => {
      const prog = progressById[q.id];
      if (filterMode === '2025' && q.examYear !== '2025') return false;
      if (filterMode === '2026' && q.examYear !== '2026') return false;
      if (filterMode === 'unsolved' && prog?.completed) return false;
      if (filterMode === 'bookmarked' && !bookmarkedIds.includes(q.id)) return false;

      if (!qLower) return true;
      return (
        String(q.globalIndex).includes(qLower) ||
        String(q.originalItemNumber).includes(qLower) ||
        q.sourceExam.toLowerCase().includes(qLower) ||
        q.sectionTitle.toLowerCase().includes(qLower) ||
        q.prompt.toLowerCase().includes(qLower) ||
        q.topicSummary.toLowerCase().includes(qLower)
      );
    });
  }, [questions, progressById, bookmarkedIds, query, filterMode]);

  const activeScaleLabel =
    FONT_SCALE_OPTIONS.find((o) => o.id === fontScale)?.ptLabel ?? '10pt';

  const stepFontScale = (delta: -1 | 1) => {
    const order: FontScaleMode[] = ['md', 'lg', 'xl'];
    const idx = order.indexOf(fontScale);
    const nextIdx = Math.min(order.length - 1, Math.max(0, idx + delta));
    onChangeFontScale(order[nextIdx]);
  };

  // Keep bottom offset clear of the fixed bottom dock (non-workspace) or sticky action bar (workspace)
  const fabBottomClass = isInWorkspace
    ? 'bottom-28 sm:bottom-28'
    : 'bottom-24 sm:bottom-24';

  return (
    <>
      {/* Bottom-Right Floating Toolkit Anchor */}
      <div
        className={`fixed right-4 sm:right-6 ${fabBottomClass} z-40 flex flex-col items-end gap-2.5`}
      >
        {menuOpen && (
          <div
            role="dialog"
            aria-label="글씨 크기 및 빠른 문제 검색 도구"
            className={`rq-feedback-rise w-[calc(100vw-2rem)] max-w-[330px] rounded-3xl border-2 bg-white p-4 shadow-2xl space-y-3.5 ${
              isLavenderTheme ? 'border-[#8D7AD6]' : 'border-[#1CB0F6]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E1915]">
                <SlidersHorizontal
                  className={`w-4 h-4 ${
                    isLavenderTheme ? 'text-[#6A52A3]' : 'text-[#1CB0F6]'
                  }`}
                />
                <span>글씨 확대 · 빠른 찾기</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="빠른 도구 닫기"
                className="w-9 h-9 rounded-xl bg-[#F7F7F7] hover:bg-[#EAEAEA] text-[#4B4B4B] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Font Size Expander (10pt / 11.5pt / 13pt) */}
            <div
              className={`rounded-2xl border-2 p-3 space-y-2.5 ${
                isLavenderTheme
                  ? 'bg-[#F5F3FC] border-[#D2CCE8]'
                  : 'bg-[#F7FCFF] border-[#CFEFFF]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1E1915]">
                  <Type className="w-4 h-4 text-[#1CB0F6]" />
                  <span>글씨 크기 ({activeScaleLabel})</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={fontScale === 'md'}
                    onClick={() => stepFontScale(-1)}
                    aria-label="글씨 작게"
                    className="w-9 h-9 rounded-xl bg-white border border-[#D4D4D4] text-[#2D2620] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={fontScale === 'xl'}
                    onClick={() => stepFontScale(1)}
                    aria-label="글씨 크게"
                    className="w-9 h-9 rounded-xl bg-white border border-[#D4D4D4] text-[#2D2620] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {FONT_SCALE_OPTIONS.map((opt) => {
                  const active = fontScale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeFontScale(opt.id)}
                      className={`min-h-[42px] px-2 py-1.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-colors ${
                        active
                          ? isLavenderTheme
                            ? 'bg-[#7963A8] border-[#5B40A0] text-white'
                            : 'bg-[#1CB0F6] border-[#1899D6] text-white'
                          : 'bg-white border-[#E5E5E5] text-[#2D2620] hover:border-[#1CB0F6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Problem Search Button */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSearchModalOpen(true);
              }}
              className="dq-btn-3d w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-white text-sm font-extrabold flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="w-4 h-4 shrink-0" />
                <span>문제 빠른 검색 · 이동</span>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            {/* Quick Contextual Helpers */}
            <div className="grid grid-cols-2 gap-2">
              {isInWorkspace && onOpenHintSheet && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenHintSheet();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#FFE18A] border-2 border-[#D4A72C] text-[#2D2620] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>쉬운 힌트</span>
                </button>
              )}

              {onOpenTutorial && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenTutorial();
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#EEFFD9] border-2 border-[#58CC02] text-[#1E4600] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>푸는 법</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl bg-[#FAFAFA] border-2 border-[#E5E5E5] hover:border-[#1CB0F6] text-[#2D2620] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  isInWorkspace && onOpenHintSheet ? 'col-span-2' : ''
                }`}
              >
                <ArrowUp className="w-4 h-4 shrink-0" />
                <span>맨 위로 가기</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Floating Action Launcher Cluster */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSearchModalOpen(true);
            }}
            aria-label="문제 빠르게 검색하기"
            title="문제 빠른 검색 (번호 · 유형 · 단어)"
            className={`dq-btn-3d min-h-[54px] px-4 rounded-2xl border-2 shadow-lg flex items-center gap-2 cursor-pointer font-extrabold text-xs sm:text-sm ${
              isLavenderTheme
                ? 'bg-white border-[#8D7AD6] text-[#26184D] hover:bg-[#F5F2FF]'
                : 'bg-white border-[#1CB0F6] text-[#143752] hover:bg-[#F2FAFF]'
            }`}
          >
            <Search className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">문제 검색</span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label="글씨 크기 조절 및 빠른 도구 열기"
            title="글씨 크기 확장 · 도구 열기"
            className={`dq-btn-3d min-h-[54px] px-4 rounded-2xl border-2 shadow-lg flex items-center gap-2 cursor-pointer font-extrabold text-xs sm:text-sm text-white ${
              menuOpen
                ? 'bg-[#2D2620] border-[#1E1915]'
                : isLavenderTheme
                  ? 'bg-[#7963A8] border-[#5B40A0] hover:bg-[#8972BD]'
                  : 'bg-[#1CB0F6] border-[#1899D6] hover:bg-[#31BAFB]'
            }`}
          >
            {menuOpen ? (
              <X className="w-5 h-5 shrink-0" />
            ) : (
              <Type className="w-5 h-5 shrink-0" />
            )}
            <span>{menuOpen ? '닫기' : `글씨 ${activeScaleLabel}`}</span>
          </button>
        </div>
      </div>

      {/* Full Searchable Question Finder Modal */}
      {searchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="문제 빠른 검색"
          onClick={() => setSearchModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#1E1915]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[86vh] rounded-3xl border-4 bg-white shadow-2xl flex flex-col overflow-hidden ${
              isLavenderTheme ? 'border-[#8D7AD6]' : 'border-[#1CB0F6]'
            }`}
          >
            {/* Header + Input */}
            <div
              className={`p-4 sm:p-5 border-b-2 space-y-3 shrink-0 ${
                isLavenderTheme
                  ? 'bg-[#F5F2FF] border-[#D7D0F0]'
                  : 'bg-[#F2FAFF] border-[#CBEBFD]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1E1915] flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#1CB0F6]" />
                  <span>풀고 싶은 문제 빠르게 찾기</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  aria-label="검색 창 닫기"
                  className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#2D2620] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-5 h-5 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="번호(예: 24), 영역(도표, 빈칸), 주제어로 검색"
                  autoFocus
                  className="w-full min-h-[50px] pl-11 pr-10 py-2.5 rounded-2xl border-2 border-[#1CB0F6] bg-white text-base font-bold text-[#1E1915] focus:outline-none"
                />
                {query.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="검색어 지우기"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#EFEFEF] text-[#4B4B4B] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all', label: `전체 (${questions.length})` },
                    { id: '2025', label: '2025 3월' },
                    { id: '2026', label: '2026 3월' },
                    { id: 'unsolved', label: '안 푼 문제' },
                    { id: 'bookmarked', label: `찜한 문제 (${bookmarkedIds.length})` },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilterMode(chip.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-colors ${
                      filterMode === chip.id
                        ? 'bg-[#1CB0F6] border-[#1899D6] text-white'
                        : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:border-[#1CB0F6]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-base font-extrabold text-[#2D2620]">
                    조건에 맞는 문제가 없어요
                  </p>
                  <p className="text-xs text-[#6E5E52]">
                    검색어를 지우거나 &apos;전체&apos; 필터를 눌러 보세요.
                  </p>
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const prog = progressById[q.id];
                  const isCurrent = currentQuestionId === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setSearchModalOpen(false);
                        onSelectQuestion(q.id);
                      }}
                      className={`dq-btn-3d w-full text-left p-4 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[#DDF4FF] border-[#1CB0F6]'
                          : prog?.completed
                            ? 'bg-[#F5FCEC] border-[#9BCB83] hover:border-[#58CC02]'
                            : 'bg-white border-[#E5E5E5] hover:border-[#1CB0F6]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                          <span className="font-mono text-[#1CB0F6]">
                            #{String(q.globalIndex).padStart(2, '0')}
                          </span>
                          <span className="text-[#1E1915]">{q.sourceExam}</span>
                          <span className="text-[#6E5E52]">· {q.sectionTitle}</span>
                          {q.points === 3 && (
                            <span className="text-[#C25D44]">· 3점</span>
                          )}
                          {isCurrent && (
                            <span className="text-[#143752]">· 현재 문제</span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-[#2D2620] line-clamp-1">
                          {q.topicSummary || q.prompt}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {prog?.completed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#285E00]">
                            <CheckCircle2 className="w-4 h-4 text-[#46A302]" />
                            <span>★{prog.stars}</span>
                          </span>
                        ) : prog?.started ? (
                          <span className="text-xs font-extrabold text-[#B47A00]">
                            풀던 중
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#6E5E52]">
                            풀기
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-[#1CB0F6]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
