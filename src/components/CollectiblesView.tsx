import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Gamepad2,
  Lock,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { MissionProgress } from '../types/game';
import { BADGE_CATALOG } from '../utils/gameStorage';
import { playSuccessChime, playTryAgainSoft } from '../utils/soundEffects';
import { speakEnglish } from '../utils/tts';
import discoveryMuseumImg from '../assets/images/discovery_museum_badge_1795522643337.jpg';

interface CollectiblesViewProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  earnedBadgeIds: string[];
  initialTab?: 'badges' | 'vocab' | 'quiz';
  onStartMission: (questionId: string) => void;
  onAwardQuizXp: (xpDelta: number) => void;
}

const TONE_CLASSES: Record<
  'butter' | 'grass' | 'mint' | 'coral' | 'lavender',
  { activeBg: string; border: string; iconBg: string }
> = {
  butter: {
    activeBg: 'bg-[#FFE18A]/35',
    border: 'border-[#D4A72C]',
    iconBg: 'bg-[#FFE18A]',
  },
  grass: {
    activeBg: 'bg-[#9BCB83]/25',
    border: 'border-[#5D8A43]',
    iconBg: 'bg-[#9BCB83]',
  },
  mint: {
    activeBg: 'bg-[#A8DCC8]/30',
    border: 'border-[#4D9479]',
    iconBg: 'bg-[#A8DCC8]',
  },
  coral: {
    activeBg: 'bg-[#F39A83]/25',
    border: 'border-[#D1684E]',
    iconBg: 'bg-[#F39A83]',
  },
  lavender: {
    activeBg: 'bg-[#C9B9E8]/30',
    border: 'border-[#7963A8]',
    iconBg: 'bg-[#C9B9E8]',
  },
};

export const CollectiblesView: React.FC<CollectiblesViewProps> = ({
  questions,
  progressById,
  earnedBadgeIds,
  initialTab = 'badges',
  onStartMission,
  onAwardQuizXp,
}) => {
  const [subTab, setSubTab] = useState<'badges' | 'vocab' | 'quiz'>(initialTab);
  const [vocabQuery, setVocabQuery] = useState('');
  const [vocabFilter, setVocabFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [studyMode, setStudyMode] = useState(false);
  const [revealedStudyKeys, setRevealedStudyKeys] = useState<string[]>([]);
  const [imgErr, setImgErr] = useState(false);

  // Mini Vocabulary Quiz State
  const [quizScope, setQuizScope] = useState<'all' | 'focus'>('all');
  const [quizRoundSeed, setQuizRoundSeed] = useState(1);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);

  const allVocabRows = useMemo(() => {
    const rows: {
      term: string;
      meaning: string;
      sourceExam: string;
      topicSummary: string;
      questionId: string;
      unlocked: boolean;
    }[] = [];

    questions.forEach((q) => {
      const prog = progressById[q.id];
      const clues = prog?.discoveredClues ?? [];
      (q.footnotes ?? []).forEach((fn, idx) => {
        const unlocked = clues.includes(`fn-${idx}`) || Boolean(prog?.completed);
        rows.push({
          term: fn.term,
          meaning: fn.meaning,
          sourceExam: q.sourceExam,
          topicSummary: q.topicSummary,
          questionId: q.id,
          unlocked,
        });
      });
    });

    return rows;
  }, [questions, progressById]);

  const collectedWords = useMemo(() => {
    const query = vocabQuery.trim().toLowerCase();
    return allVocabRows.filter((r) => {
      if (vocabFilter === 'unlocked' && !r.unlocked) return false;
      if (vocabFilter === 'locked' && r.unlocked) return false;
      if (!query) return true;
      return (
        r.term.toLowerCase().includes(query) ||
        r.meaning.toLowerCase().includes(query) ||
        r.sourceExam.toLowerCase().includes(query)
      );
    });
  }, [allVocabRows, vocabQuery, vocabFilter]);

  const unlockedWordCount = allVocabRows.filter((w) => w.unlocked).length;

  // Build 5-question vocabulary quiz deck (supports full/unlocked pool or focus on missed/clue-opened problems)
  const quizDeck = useMemo(() => {
    const allVocab = allVocabRows.filter(
      (w, idx, arr) => arr.findIndex((x) => x.term === w.term) === idx,
    );
    const focusPool = allVocab.filter((w) => {
      const p = progressById[w.questionId];
      return Boolean(w.unlocked || (p && (p.attempts > 0 && !p.completed)));
    });
    const unlockedPool = allVocab.filter((w) => w.unlocked);
    const pool =
      quizScope === 'focus' && focusPool.length >= 4
        ? focusPool
        : unlockedPool.length >= 4
          ? unlockedPool
          : allVocab;
    if (pool.length < 4) return [];

    const picked: typeof allVocab = [];
    for (let i = 0; i < Math.min(5, pool.length); i += 1) {
      const idx = (quizRoundSeed * 7 + i * 5) % pool.length;
      if (!picked.some((p) => p.term === pool[idx].term)) {
        picked.push(pool[idx]);
      }
    }

    return picked.map((target, qIdx) => {
      const distractors = allVocab
        .filter((w) => w.term !== target.term)
        .slice(qIdx * 3, qIdx * 3 + 3);
      const options = [target.meaning, ...distractors.map((d) => d.meaning)];
      const rotate = (quizRoundSeed + qIdx) % options.length;
      const rotated = [
        ...options.slice(rotate),
        ...options.slice(0, rotate),
      ];
      return {
        term: target.term,
        correctMeaning: target.meaning,
        sourceExam: target.sourceExam,
        topicSummary: target.topicSummary,
        options: rotated,
      };
    });
  }, [allVocabRows, progressById, quizRoundSeed, quizScope]);

  const activeQuizItem = quizDeck[quizIndex];
  const quizFinished = quizDeck.length > 0 && quizIndex >= quizDeck.length;

  const handleSelectQuizOption = (opt: string) => {
    if (quizSelected !== null || !activeQuizItem) return;
    setQuizSelected(opt);
    if (opt === activeQuizItem.correctMeaning) {
      playSuccessChime();
      setQuizScore((s) => s + 1);
      onAwardQuizXp(5);
    } else {
      playTryAgainSoft();
    }
  };

  return (
    <div className="space-y-6">
      {/* Museum Banner */}
      <div className="clay-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-40 h-28 rounded-2xl overflow-hidden border-2 border-[#EAE0D0] bg-[#FFF9EF] shrink-0 flex items-center justify-center">
          {imgErr ? (
            <Award className="w-10 h-10 text-[#9B785D]" />
          ) : (
            <img
              src={discoveryMuseumImg}
              alt="나의 수집품 박물관"
              onError={() => setImgErr(true)}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="space-y-2 text-center sm:text-left flex-1">
          <div className="text-xs font-extrabold text-[#9B785D]">
            MY COLLECTIBLES MUSEUM
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#2D2620]">
            나의 배지 & 어휘 학습관
          </h1>
          <p className="text-xs sm:text-sm text-[#5C4D42]">
            배지 {earnedBadgeIds.length} / {BADGE_CATALOG.length}개 · 수집한 각주
            영단어 {unlockedWordCount}개를 복습하고 퀴즈로 XP를 모아보세요.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setSubTab('badges')}
              className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer ${
                subTab === 'badges'
                  ? 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>모험 배지</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('vocab')}
              className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer ${
                subTab === 'vocab'
                  ? 'bg-[#A8DCC8] border-[#4D9479] text-[#163B2D]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>어휘 단서 도감</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('quiz')}
              className={`dq-btn-3d min-h-[44px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer ${
                subTab === 'quiz'
                  ? 'bg-[#C9B9E8] border-[#7963A8] text-[#2E204D]'
                  : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42]'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>어휘 미니 퀴즈 (+XP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Badges */}
      {subTab === 'badges' && (
        <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[#2D2620]">
              모험 배지 진열장
            </h2>
            <span className="text-xs font-mono font-bold text-[#5C4D42] tabular-nums">
              {earnedBadgeIds.length} / {BADGE_CATALOG.length} 획득
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {BADGE_CATALOG.map((badge) => {
              const isEarned = earnedBadgeIds.includes(badge.id);
              const tone = TONE_CLASSES[badge.tone];

              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl border-2 p-4 flex items-start gap-3.5 ${
                    isEarned
                      ? `${tone.activeBg} ${tone.border}`
                      : 'bg-[#F7F2EA] border-[#E3DACB] opacity-75'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl border-2 border-white flex items-center justify-center shrink-0 shadow-xs ${
                      isEarned ? tone.iconBg : 'bg-[#E5DDD0]'
                    }`}
                  >
                    {isEarned ? (
                      <Star className="w-5 h-5 text-[#2D2620] fill-[#FFF9EF]" />
                    ) : (
                      <Lock className="w-4 h-4 text-[#8B7F73]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-extrabold text-[#2D2620] truncate">
                        {badge.title}
                      </h3>
                      {isEarned && (
                        <Sparkles className="w-3.5 h-3.5 text-[#9B785D] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#5C4D42] mt-0.5 leading-snug">
                      {badge.subtitle}
                    </p>
                    <div className="text-xs font-bold mt-1.5 text-[#7D6E61]">
                      {isEarned ? '획득 완료' : '미획득'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: Vocabulary Glossary */}
      {subTab === 'vocab' && (
        <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2620]">
                수집한 어휘 단서 도감
              </h2>
              <p className="text-xs sm:text-sm text-[#6E5E52]">
                전체 {allVocabRows.length}개 중 {unlockedWordCount}개 수집 완료
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#9B785D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={vocabQuery}
                onChange={(e) => setVocabQuery(e.target.value)}
                placeholder="영단어 · 뜻 · 출처 검색"
                aria-label="어휘 도감 검색"
                className="w-full min-h-[44px] pl-9 pr-9 py-2 text-sm bg-[#FFF9EF] border-2 border-[#EAE0D0] rounded-2xl text-[#2D2620] focus:outline-none focus:border-[#1CB0F6]"
              />
              {vocabQuery.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setVocabQuery('')}
                  aria-label="검색어 지우기"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#EFE6D6] text-[#6E5E52] hover:bg-[#E2D6C0] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: `전체 (${allVocabRows.length})` },
                  { id: 'unlocked', label: `수집됨 (${unlockedWordCount})` },
                  {
                    id: 'locked',
                    label: `미수집 (${allVocabRows.length - unlockedWordCount})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVocabFilter(f.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                    vocabFilter === f.id
                      ? 'bg-[#A8DCC8] border-[#4D9479] text-[#163B2D]'
                      : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStudyMode((prev) => !prev);
                setRevealedStudyKeys([]);
              }}
              className={`dq-btn-3d min-h-[40px] px-4 py-1.5 rounded-xl border-2 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                studyMode
                  ? 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                  : 'bg-white border-[#EAE0D0] text-[#5C4D42]'
              }`}
            >
              {studyMode ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span>{studyMode ? '암기 모드 켜짐 (뜻 가리기)' : '암기 모드 (뜻 가리기)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {collectedWords.map((item, idx) => {
              const cardKey = `${item.questionId}-${item.term}-${idx}`;
              const isStudyRevealed = revealedStudyKeys.includes(cardKey);
              const hideMeaning = studyMode && item.unlocked && !isStudyRevealed;

              return (
                <div
                  key={cardKey}
                  className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 transition-all ${
                    item.unlocked
                      ? 'bg-[#FFF9EF] border-[#DFD2BE]'
                      : 'bg-[#F5EFE6] border-[#E3DACB] opacity-85'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#9B785D]">
                      <span>{item.sourceExam}</span>
                      <span
                        className={
                          item.unlocked ? 'text-[#4C7A34]' : 'text-[#8B7F73]'
                        }
                      >
                        {item.unlocked ? '수집됨' : '미수집'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="text-lg font-mono font-extrabold text-[#2D2620]">
                        {item.term}
                      </div>
                      <button
                        type="button"
                        onClick={() => speakEnglish(item.term, 0.9)}
                        aria-label={`${item.term} 발음 듣기`}
                        className="min-w-[36px] min-h-[36px] px-2.5 rounded-xl bg-white border-2 border-[#DFD2BE] hover:border-[#1CB0F6] text-[#1C7CB5] inline-flex items-center justify-center gap-1 text-xs font-extrabold cursor-pointer shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {hideMeaning ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedStudyKeys((prev) => [...prev, cardKey])
                        }
                        className="mt-2 w-full min-h-[40px] px-3 py-1.5 rounded-xl border-2 border-dashed border-[#C9961A] bg-[#FFF8DF] text-xs sm:text-sm font-extrabold text-[#6B4A00] cursor-pointer"
                      >
                        터치해서 뜻 확인하기
                      </button>
                    ) : (
                      <div className="text-sm text-[#5C4D42] mt-1 font-medium">
                        {item.unlocked
                          ? item.meaning
                          : '단서 탐색에서 열어볼 수 있어요'}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#EFE6D6] flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onStartMission(item.questionId)}
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-white border border-[#DFD2BE] hover:border-[#9B785D] text-xs font-extrabold text-[#5C4D42] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>문제 풀기</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: Vocabulary Mini Quiz */}
      {subTab === 'quiz' && (
        <section className="clay-card rounded-3xl p-5 sm:p-7 max-w-2xl mx-auto space-y-5">
          {quizFinished ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#FFE18A] border-2 border-[#D4A72C] mx-auto flex items-center justify-center">
                <Star className="w-8 h-8 text-[#9B6B00] fill-[#FFF9EF]" />
              </div>
              <h2 className="text-xl font-extrabold text-[#2D2620]">
                어휘 미니 퀴즈 완료!
              </h2>
              <p className="text-sm text-[#5C4D42] tabular-nums">
                {quizDeck.length}문제 중{' '}
                <strong className="text-[#4C7A34]">{quizScore}문제</strong>를
                맞혔어요! (+{quizScore * 5} XP)
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuizRoundSeed((s) => s + 1);
                  setQuizIndex(0);
                  setQuizSelected(null);
                  setQuizScore(0);
                }}
                className="dq-btn-3d min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-sm font-extrabold text-white inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>새 단어 세트로 다시 도전</span>
              </button>
            </div>
          ) : activeQuizItem ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div className="inline-flex items-center gap-1.5 bg-[#F5EFE4] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizScope('all');
                      setQuizIndex(0);
                      setQuizSelected(null);
                      setQuizScore(0);
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                      quizScope === 'all'
                        ? 'bg-white text-[#2D2620] shadow-xs'
                        : 'text-[#5C4D42] hover:text-[#2D2620]'
                    }`}
                  >
                    전체 핵심 어휘
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuizScope('focus');
                      setQuizIndex(0);
                      setQuizSelected(null);
                      setQuizScore(0);
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                      quizScope === 'focus'
                        ? 'bg-white text-[#2D2620] shadow-xs'
                        : 'text-[#5C4D42] hover:text-[#2D2620]'
                    }`}
                  >
                    내가 본 단서 집중
                  </button>
                </div>
                <span className="text-xs font-bold text-[#6E5E52]">
                  맞힐 때마다 +5 XP
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#9B785D] tabular-nums">
                  <span>
                    어휘 퀴즈 {quizIndex + 1} / {quizDeck.length} ·{' '}
                    {activeQuizItem.sourceExam}
                  </span>
                  <span className="text-[#4C7A34]">맞힌 개수: {quizScore}</span>
                </div>
                <div className="h-3.5 bg-[#EFECE5] rounded-full overflow-hidden border border-[#E2DACB]">
                  <div
                    className="h-full bg-[#58CC02] rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{
                      width: `${Math.round(
                        ((quizIndex + (quizSelected !== null ? 1 : 0)) /
                          quizDeck.length) *
                          100,
                      )}%`,
                    }}
                  >
                    <div className="h-1 bg-white/35 rounded-full mx-1.5 mt-0.5" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FFF9EF] border-2 border-[#EAE0D0] p-6 text-center space-y-2.5">
                <div className="text-xs sm:text-sm font-bold text-[#6E5E52]">
                  다음 영어 단어의 뜻으로 알맞은 것은?
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[#2D2620]">
                    {activeQuizItem.term}
                  </div>
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeQuizItem.term, 0.94)}
                    aria-label={`${activeQuizItem.term} 발음 듣기`}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border-2 border-[#DFD2BE] hover:border-[#1CB0F6] text-[#1C7CB5] inline-flex items-center gap-1 text-xs font-extrabold cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>발음</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => speakEnglish(activeQuizItem.term, 0.78)}
                    title="0.8배속 천천히 듣기"
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#DFD2BE] hover:border-[#1CB0F6] text-[#1C7CB5] text-xs font-extrabold cursor-pointer"
                  >
                    0.8x
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeQuizItem.options.map((opt) => {
                  const isChosen = quizSelected === opt;
                  const isCorrect = opt === activeQuizItem.correctMeaning;
                  const revealed = quizSelected !== null;

                  let cls =
                    'bg-white border-[#DFD2BE] hover:border-[#9B785D] text-[#2D2620]';
                  if (revealed && isCorrect) {
                    cls =
                      'bg-[#D7FFB8] border-[#58CC02] text-[#1A4205] font-extrabold';
                  } else if (isChosen && !isCorrect) {
                    cls = 'bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1B1B] font-bold';
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={revealed}
                      onClick={() => handleSelectQuizOption(opt)}
                      className={`dq-btn-3d min-h-[54px] p-4 rounded-2xl border-2 text-sm sm:text-base font-bold text-left flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${cls}`}
                    >
                      <span>{opt}</span>
                      {revealed && isCorrect && (
                        <Check className="w-5 h-5 text-[#46A302] shrink-0" />
                      )}
                      {revealed && isChosen && !isCorrect && (
                        <X className="w-5 h-5 text-[#EA2B2B] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {quizSelected !== null && (
                <div className="rq-feedback-rise space-y-2.5 pt-1">
                  <div className="rounded-xl bg-[#FAF6EE] border border-[#EAE0D0] px-3.5 py-2.5 text-xs sm:text-sm text-[#5C4D42]">
                    <span className="font-extrabold text-[#9B785D] mr-1.5">
                      지문 맥락 ({activeQuizItem.sourceExam}):
                    </span>
                    {activeQuizItem.topicSummary}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`text-sm font-extrabold ${
                        quizSelected === activeQuizItem.correctMeaning
                          ? 'text-[#46A302]'
                          : 'text-[#C25D44]'
                      }`}
                    >
                      {quizSelected === activeQuizItem.correctMeaning
                        ? '정답이에요! (+5 XP)'
                        : `정답은 "${activeQuizItem.correctMeaning}"이에요.`}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizIndex((i) => i + 1);
                        setQuizSelected(null);
                      }}
                      className="dq-btn-3d min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#58CC02] border-2 border-[#46A302] text-sm font-extrabold text-white cursor-pointer shrink-0"
                    >
                      {quizIndex + 1 >= quizDeck.length ? '결과 보기' : '다음 단어'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}
    </div>
  );
};
