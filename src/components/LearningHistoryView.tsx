import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  RotateCcw,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { SECTION_META } from '../data/sections';
import { HistoryEvent, MissionProgress, QuestGameState } from '../types/game';
import { computeLevelInfo } from '../utils/gameStorage';
import {
  buildQuestBackupJson,
  downloadTextFile,
  parseQuestBackupJson,
} from '../utils/exporters';
import { InterpretationAnalyticsDashboard } from './InterpretationAnalyticsDashboard';

interface LearningHistoryViewProps {
  questions: ExtractedQuestion[];
  progressById: Record<string, MissionProgress>;
  history: HistoryEvent[];
  xp: number;
  streakCount: number;
  gameState: QuestGameState;
  transcripts: Record<string, string>;
  onRestoreBackup: (
    restoredState: QuestGameState,
    restoredTranscripts: Record<string, string>,
  ) => void;
  onStartMission: (questionId: string) => void;
}

export const LearningHistoryView: React.FC<LearningHistoryViewProps> = ({
  questions,
  progressById,
  history,
  xp,
  streakCount,
  gameState,
  transcripts,
  onRestoreBackup,
  onStartMission,
}) => {
  const levelInfo = computeLevelInfo(xp);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const stats = useMemo(() => {
    const completed = Object.values(progressById).filter((p) => p.completed).length;
    const totalAttempts = history.length;
    const correctAttempts = history.filter((h) => h.isCorrect).length;
    const accuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    return { completed, totalAttempts, correctAttempts, accuracy };
  }, [progressById, history]);

  const sectionProgress = useMemo(() => {
    return SECTION_META.map((sec) => {
      const items = questions.filter((q) => q.sectionNumber === sec.number);
      const done = items.filter((q) => progressById[q.id]?.completed).length;
      const secHistory = history.filter((h) => h.sectionTitle === sec.title);
      const secCorrect = secHistory.filter((h) => h.isCorrect).length;
      const secAcc =
        secHistory.length > 0
          ? Math.round((secCorrect / secHistory.length) * 100)
          : null;
      const nextPractice =
        items.find((q) => !progressById[q.id]?.completed) ??
        items.find((q) => (progressById[q.id]?.stars ?? 0) < 3) ??
        items[0];
      return {
        section: sec,
        total: items.length,
        done,
        pct: items.length ? Math.round((done / items.length) * 100) : 0,
        secAcc,
        nextPracticeId: nextPractice?.id,
      };
    });
  }, [questions, progressById, history]);

  const handleDownloadBackup = () => {
    const json = buildQuestBackupJson(gameState, transcripts);
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `reading-quest-backup-${today}.json`,
      json,
      'application/json;charset=utf-8',
    );
    setBackupFeedback({
      type: 'ok',
      msg: '내 학습 기록 백업 파일을 저장했어요! 다른 기기에서도 그대로 이어서 풀 수 있어요.',
    });
  };

  const handleBackupFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = parseQuestBackupJson(rawText);
      if (!parsed.ok) {
        setBackupFeedback({ type: 'err', msg: parsed.error });
        return;
      }
      onRestoreBackup(parsed.data.gameState, parsed.data.transcripts);
      setBackupFeedback({
        type: 'ok',
        msg: '백업 파일에서 학습 기록과 노트를 모두 복원했어요!',
      });
    } catch {
      setBackupFeedback({
        type: 'err',
        msg: '백업 파일을 읽는 중 문제가 발생했어요.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Level & Accuracy Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">현재 학습 레벨</div>
          <div className="text-2xl font-extrabold text-[#2D2620] font-mono tabular-nums mt-1">
            LV.{levelInfo.level}
          </div>
          <div className="text-xs text-[#9B785D] font-semibold mt-0.5">
            {levelInfo.title}
          </div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">완료한 문제</div>
          <div className="text-2xl font-extrabold text-[#4C7A34] font-mono tabular-nums mt-1">
            {stats.completed} / {questions.length}
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5">전체 학습 진행</div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">실전 풀이 정답률</div>
          <div className="text-2xl font-extrabold text-[#2D2620] font-mono tabular-nums mt-1">
            {stats.accuracy}%
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5 tabular-nums">
            {stats.correctAttempts} / {stats.totalAttempts}회 성공
          </div>
        </div>

        <div className="clay-card rounded-2xl p-4">
          <div className="text-xs font-bold text-[#6E5E52]">최고 연속 정답</div>
          <div className="text-2xl font-extrabold text-[#C25D44] font-mono tabular-nums mt-1">
            {streakCount}연속
          </div>
          <div className="text-xs text-[#5C4D42] mt-0.5 tabular-nums">
            보유 {xp} XP
          </div>
        </div>
      </div>

      {/* Sentence Interpretation Skill Score + Weekly Accuracy & Speed Dashboard */}
      <InterpretationAnalyticsDashboard
        history={history}
        progressById={progressById}
        totalQuestions={questions.length}
        streakCount={streakCount}
        reducedMotion={gameState.profile.reducedMotion}
      />

      {/* Section Mastery Grid */}
      <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#9B785D]" />
            <h2 className="text-lg font-extrabold text-[#2D2620]">
              10개 단원별 숙련도 & 취약 보강
            </h2>
          </div>
          <span className="text-xs font-semibold text-[#6E5E52]">
            연습 버튼을 누르면 해당 유형 문제로 바로 이동해요
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sectionProgress.map((sp) => (
            <div
              key={sp.section.number}
              className="rounded-2xl border-2 border-[#EAE0D0] bg-[#FFF9EF] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                <span className="text-[#2D2620] truncate">
                  {String(sp.section.number).padStart(2, '0')}. {sp.section.title}
                </span>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  {sp.secAcc !== null && (
                    <span
                      className={`font-extrabold ${
                        sp.secAcc < 70 ? 'text-[#C25D44]' : 'text-[#4C7A34]'
                      }`}
                    >
                      정답률 {sp.secAcc}%
                    </span>
                  )}
                  <span className="font-mono text-[#5C4D42]">
                    {sp.done}/{sp.total} ({sp.pct}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-3.5 bg-white rounded-full overflow-hidden border border-[#E2DACB]">
                  <div
                    className="h-full bg-[#58CC02] rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${sp.pct}%` }}
                  >
                    <div className="h-1 bg-white/35 rounded-full mx-1 mt-0.5" />
                  </div>
                </div>
                {sp.nextPracticeId && (
                  <button
                    type="button"
                    onClick={() => onStartMission(sp.nextPracticeId!)}
                    className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white border border-[#DFD2BE] hover:border-[#58CC02] text-xs font-extrabold text-[#2D2620] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>연습</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Student-Friendly JSON Backup & Restore */}
      <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#2D2620]">
              내 학습 기록 백업 · 불러오기
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4D42] mt-0.5">
              학교 컴퓨터·집 태블릿 등 다른 기기에서 이어서 풀려면 JSON 백업 파일로 저장하고 불러오세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="dq-btn-3d min-h-[42px] px-4 py-2 rounded-2xl bg-[#DDF4FF] border-2 border-[#1CB0F6] text-xs sm:text-sm font-extrabold text-[#143752] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>백업 파일 저장</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="dq-btn-3d min-h-[42px] px-4 py-2 rounded-2xl bg-white border-2 border-[#DFD2BE] hover:border-[#58CC02] text-xs sm:text-sm font-extrabold text-[#2D2620] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>백업 파일 불러오기</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFileSelected}
              className="hidden"
            />
          </div>
        </div>

        {backupFeedback && (
          <div
            className={`rounded-2xl border-2 px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              backupFeedback.type === 'ok'
                ? 'bg-[#D7FFB8] border-[#58CC02] text-[#1E4600]'
                : 'bg-[#FFDFE0] border-[#FF4B4B] text-[#7A1212]'
            }`}
          >
            {backupFeedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{backupFeedback.msg}</span>
          </div>
        )}
      </section>

      {/* Chronological Activity Log */}
      <section className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#9B785D]" />
          <h2 className="text-lg font-extrabold text-[#2D2620]">
            최근 학습 활동 기록
          </h2>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#DFD2BE] bg-[#FFF9EF] p-8 text-center">
            <p className="text-sm font-bold text-[#2D2620]">
              아직 풀이 기록이 없어요
            </p>
            <p className="text-xs text-[#6E5E52] mt-1">
              문제 지도에서 첫 번째 문제를 풀면 기록이 차곡차곡 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.slice(0, 30).map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onStartMission(ev.questionId)}
                className="dq-btn-3d min-h-[58px] w-full text-left rounded-2xl border-2 border-[#EAE0D0] bg-[#FFF9EF] hover:border-[#1CB0F6] px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {ev.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-[#4C7A34] shrink-0" />
                  ) : (
                    <RotateCcw className="w-5 h-5 text-[#C25D44] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#2D2620] truncate">
                      {ev.sourceExam} · {ev.sectionTitle}
                    </div>
                    <div className="text-xs text-[#5C4D42] truncate">
                      {ev.note}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono shrink-0 tabular-nums">
                  {typeof ev.durationSec === 'number' && ev.durationSec > 0 && (
                    <span className="font-bold text-[#B25E00]">
                      {ev.durationSec}초
                    </span>
                  )}
                  {ev.xpDelta > 0 && (
                    <span className="font-extrabold text-[#4C7A34]">
                      +{ev.xpDelta} XP
                    </span>
                  )}
                  <span className="text-[#7D6E61]">
                    {new Date(ev.timestamp).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
