import React, { useRef, useState } from 'react';
import {
  Check,
  Database,
  Download,
  FileImage,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldCheck,
  Table2,
  Unlock,
  Upload,
} from 'lucide-react';
import { ExtractedQuestion } from '../types/question';
import { QuestGameState } from '../types/game';
import { DataTableView } from './DataTableView';
import { PngGalleryView } from './PngGalleryView';
import { ExportStudioView } from './ExportStudioView';
import {
  buildQuestBackupJson,
  downloadTextFile,
  parseQuestBackupJson,
} from '../utils/exporters';

interface TeacherAdminViewProps {
  allQuestions: ExtractedQuestion[];
  selectedId: string;
  transcripts: Record<string, string>;
  gameState: QuestGameState;
  isUnlocked: boolean;
  onUnlockSuccess: () => void;
  onLockAndExit: () => void;
  onSelectQuestionForPlay: (id: string) => void;
  onToggleFreeExplore: () => void;
  onRestoreBackup: (state: QuestGameState, transcripts: Record<string, string>) => void;
  onRestartKeepData: () => void;
  onResetProgress: () => void;
  hasPreResetSnapshot: boolean;
  onRestorePreResetSnapshot: () => void;
}

type AdminSubTab = 'backup' | 'table' | 'gallery' | 'export';

const TEACHER_PASSCODE = '0111';

export const TeacherAdminView: React.FC<TeacherAdminViewProps> = ({
  allQuestions,
  selectedId,
  transcripts,
  gameState,
  isUnlocked,
  onUnlockSuccess,
  onLockAndExit,
  onSelectQuestionForPlay,
  onToggleFreeExplore,
  onRestoreBackup,
  onRestartKeepData,
  onResetProgress,
  hasPreResetSnapshot,
  onRestorePreResetSnapshot,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [subTab, setSubTab] = useState<AdminSubTab>('backup');
  const [pasteJson, setPasteJson] = useState('');
  const [restoreFeedback, setRestoreFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifyPin = (candidate: string) => {
    if (candidate === TEACHER_PASSCODE) {
      setPinError(false);
      setPinInput('');
      onUnlockSuccess();
    } else {
      setPinError(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPin(pinInput.trim());
  };

  const handleKeypadPress = (digit: string) => {
    setPinError(false);
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    if (next.length === 4) {
      if (next === TEACHER_PASSCODE) {
        setPinError(false);
        setPinInput('');
        onUnlockSuccess();
      } else {
        setPinError(true);
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-8 clay-card rounded-3xl p-6 sm:p-8 space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FFE18A] border-2 border-[#D4A72C] mx-auto flex items-center justify-center shadow-xs">
          <Lock className="w-7 h-7 text-[#2D2620]" />
        </div>

        <div>
          <div className="text-xs font-extrabold text-[#9B785D]">
            TEACHER ACCESS ONLY
          </div>
          <h1 className="text-xl font-extrabold text-[#2D2620] mt-1">
            교사용 관리 모드 잠금
          </h1>
          <p className="text-xs sm:text-sm text-[#5C4D42] mt-1">
            정답 시트, 데이터 내보내기, 진도 초기화 메뉴를 열려면 교사용 비밀번호 4자리를 입력하세요.
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[#9B785D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinError(false);
                setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
              }}
              placeholder="비밀번호 4자리 입력"
              aria-label="교사용 비밀번호 4자리"
              autoFocus
              className="w-full pl-10 pr-4 py-3 text-center tracking-[0.5em] text-lg font-mono font-extrabold bg-[#FFF9EF] border-2 border-[#EAE0D0] rounded-2xl text-[#2D2620] focus:outline-none focus:border-[#9B785D]"
            />
          </div>

          {/* Touch-Friendly 4-Digit Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '확인'].map(
              (key) => {
                if (key === '지움') {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPinError(false);
                        setPinInput((p) => p.slice(0, -1));
                      }}
                      className="py-2.5 rounded-xl bg-[#FFF9EF] border-2 border-[#EAE0D0] text-xs font-bold text-[#6E5E52] hover:border-[#9B785D] cursor-pointer"
                    >
                      지움
                    </button>
                  );
                }
                if (key === '확인') {
                  return (
                    <button
                      key={key}
                      type="submit"
                      className="py-2.5 rounded-xl bg-[#A8DCC8] border-2 border-[#4D9479] text-xs font-extrabold text-[#163B2D] cursor-pointer"
                    >
                      확인
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="py-2.5 rounded-xl bg-white border-2 border-[#EAE0D0] text-base font-mono font-extrabold text-[#2D2620] hover:bg-[#FFF9EF] cursor-pointer"
                  >
                    {key}
                  </button>
                );
              },
            )}
          </div>

          {pinError && (
            <div className="rounded-xl bg-[#F39A83]/20 border border-[#D1684E] p-2.5 text-xs font-bold text-[#7A2D1C]">
              비밀번호가 일치하지 않습니다. 다시 확인해 주세요.
            </div>
          )}
        </form>

        <button
          type="button"
          onClick={onLockAndExit}
          className="text-xs font-bold text-[#6E5E52] hover:text-[#2D2620] cursor-pointer"
        >
          학생 탐험 지도로 돌아가기
        </button>
      </div>
    );
  }

  const handleDownloadBackup = () => {
    const json = buildQuestBackupJson(gameState, transcripts);
    downloadTextFile(
      `reading_quest_backup_${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json;charset=utf-8',
    );
  };

  const applyRestoreText = (raw: string) => {
    const result = parseQuestBackupJson(raw);
    if (!result.ok) {
      setRestoreFeedback({ ok: false, message: result.error });
      return;
    }
    onRestoreBackup(result.data.gameState, result.data.transcripts);
    setPasteJson('');
    setRestoreFeedback({
      ok: true,
      message: `${result.data.gameState.profile.nickname} 학생의 학습 진도와 메모를 성공적으로 복원했습니다.`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        applyRestoreText(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="clay-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold text-[#9B785D]">
              TEACHER & DATA STUDIO
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#2D2620] mt-0.5">
              교사용 데이터 관리 · 백업/복원 · 18p 원본 PNG
            </h1>
            <p className="text-xs sm:text-sm text-[#5C4D42] mt-0.5">
              전체 56문항 데이터 시트, 18페이지 원본 이미지 인덱스, JSON/CSV/Markdown 내보내기 및 학습 진도 백업·복원을 제공합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleFreeExplore}
              className={`clay-btn px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                gameState.profile.freeExploreMode
                  ? 'bg-[#A8DCC8] text-[#163B2D]'
                  : 'bg-[#FFF9EF] text-[#2D2620]'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>
                {gameState.profile.freeExploreMode
                  ? '자유 탐험 켜짐'
                  : '전체 문항 잠금 해제'}
              </span>
            </button>

            <button
              type="button"
              onClick={onLockAndExit}
              className="clay-btn px-3.5 py-2 rounded-xl bg-[#F39A83] text-[#2D2620] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>교사 모드 잠그고 나가기</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F2ECE1]">
          {(
            [
              { id: 'backup', label: 'JSON 백업 · 복원', icon: ShieldCheck },
              { id: 'table', label: '전체 56문항 시트', icon: Table2 },
              { id: 'gallery', label: '18p 원본 PNG 갤러리', icon: FileImage },
              { id: 'export', label: '데이터 내보내기', icon: Database },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#FFE18A] border-[#C9961A] text-[#2D2620]'
                    : 'bg-[#FFF9EF] border-[#EAE0D0] text-[#5C4D42] hover:border-[#9B785D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab 1: JSON Backup & Restore */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="clay-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-extrabold text-[#2D2620]">
              <Download className="w-5 h-5 text-[#9B785D]" />
              <span>학습 진도 & 메모 JSON 백업 저장</span>
            </div>
            <p className="text-xs sm:text-sm text-[#5C4D42] leading-relaxed">
              학생의 XP, 레벨, 채집한 단서, 풀이 기록, 그리고 학생 노트를 하나의 JSON 파일로 백업해 다른 기기로 옮길 수 있어요.
            </p>

            <div className="rounded-2xl bg-[#FFF9EF] border-2 border-[#EAE0D0] p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#6E5E52]">현재 닉네임</span>
                <div className="font-extrabold text-[#2D2620] text-sm mt-0.5">
                  {gameState.profile.nickname}
                </div>
              </div>
              <div>
                <span className="text-[#6E5E52]">보유 XP / 완료</span>
                <div className="font-mono font-extrabold text-[#2D2620] text-sm mt-0.5 tabular-nums">
                  {gameState.profile.xp} XP ·{' '}
                  {Object.values(gameState.progressById).filter((p) => p.completed).length}
                  문항
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="clay-btn px-4 py-2.5 rounded-xl bg-[#A8DCC8] text-[#163B2D] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>백업 JSON 파일 다운로드</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRestartKeepData();
                  setRestoreFeedback({
                    ok: true,
                    message:
                      '기존 XP·별·배지·메모 데이터를 모두 유지한 채 처음 위치에서 다시 시작할 수 있도록 준비했어요.',
                  });
                }}
                className="px-4 py-2.5 rounded-xl border-2 border-[#4D9479] bg-[#F7FCF9] text-xs font-extrabold text-[#163B2D] hover:bg-[#A8DCC8]/35 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>기존 데이터 유지 · 다시 시작</span>
              </button>

              {hasPreResetSnapshot && (
                <button
                  type="button"
                  onClick={() => {
                    onRestorePreResetSnapshot();
                    setRestoreFeedback({
                      ok: true,
                      message:
                        '진도 초기화 직전에 자동 저장된 기존 학습 데이터를 복구했어요!',
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl border-2 border-[#D4A72C] bg-[#FFE18A]/50 text-xs font-extrabold text-[#2D2620] hover:bg-[#FFE18A] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>초기화 전 데이터 복구</span>
                </button>
              )}

              {!confirmResetOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="px-4 py-2.5 rounded-xl border-2 border-[#EAE0D0] bg-white text-xs font-bold text-[#C25D44] hover:border-[#D1684E] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>진도 초기화</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-[#F39A83]/20 border border-[#D1684E] rounded-xl px-3 py-1.5">
                  <span className="text-xs font-bold text-[#7A2D1C]">
                    초기화 전 자동 백업 후 비울까요?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetProgress();
                      setConfirmResetOpen(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#D1684E] text-white text-xs font-bold cursor-pointer"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="px-2 py-1 text-xs font-bold text-[#5C4D42] cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="clay-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-extrabold text-[#2D2620]">
              <Upload className="w-5 h-5 text-[#9B785D]" />
              <span>백업 JSON 파일 복원하기</span>
            </div>
            <p className="text-xs sm:text-sm text-[#5C4D42] leading-relaxed">
              저장해 둔 <code className="font-mono">reading_quest_backup_*.json</code> 파일을 업로드하거나 아래에 JSON 내용을 붙여넣어 바로 복원하세요.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="clay-btn px-4 py-2.5 rounded-xl bg-[#FFE18A] text-[#2D2620] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>백업 JSON 파일 선택하여 복원</span>
            </button>

            <div className="space-y-2">
              <textarea
                rows={4}
                value={pasteJson}
                onChange={(e) => setPasteJson(e.target.value)}
                placeholder="또는 여기에 백업 JSON 텍스트를 붙여넣고 복원 버튼을 누르세요."
                className="w-full px-3.5 py-2.5 text-xs font-mono text-[#2D2620] bg-[#FFF9EF] border-2 border-[#EAE0D0] rounded-xl focus:outline-none focus:border-[#9B785D]"
              />
              <button
                type="button"
                disabled={!pasteJson.trim()}
                onClick={() => applyRestoreText(pasteJson)}
                className="clay-btn px-4 py-2 rounded-xl bg-[#FFF9EF] text-xs font-bold text-[#2D2620] disabled:opacity-40 cursor-pointer"
              >
                붙여넣은 JSON 복원 실행
              </button>
            </div>

            {restoreFeedback && (
              <div
                className={`rounded-xl border p-3 text-xs font-bold flex items-center gap-2 ${
                  restoreFeedback.ok
                    ? 'bg-[#9BCB83]/25 border-[#5D8A43] text-[#1A3110]'
                    : 'bg-[#F39A83]/20 border-[#D1684E] text-[#7A2D1C]'
                }`}
              >
                {restoreFeedback.ok && <Check className="w-4 h-4 shrink-0" />}
                <span>{restoreFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'table' && (
        <DataTableView
          questions={allQuestions}
          selectedId={selectedId}
          onSelectQuestion={onSelectQuestionForPlay}
        />
      )}

      {subTab === 'gallery' && (
        <PngGalleryView
          questions={allQuestions}
          onSelectQuestion={onSelectQuestionForPlay}
        />
      )}

      {subTab === 'export' && (
        <ExportStudioView
          filteredQuestions={allQuestions}
          allQuestions={allQuestions}
          transcripts={transcripts}
        />
      )}
    </div>
  );
};
