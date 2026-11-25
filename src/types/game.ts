import { ExamYear } from './question';

// Streamlined 4-stage learning loop:
// 0: CLUE BRIEFING (원문 PNG + 질문 + 단서 채집)
// 1: STORY & GUESS (흐름 잡기 퍼즐 / 요지 추측)
// 2: BOSS CHALLENGE (지문 나란히 보기 + 실전 도전 + 타이머)
// 3: MY DISCOVERY (발견 노트 + 어휘 + 별 등급 + XP)
export type LearningStage = 0 | 1 | 2 | 3;

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type MascotMood = 'idle' | 'start' | 'clue' | 'correct' | 'retry' | 'complete';

export type StarRating = 0 | 1 | 2 | 3;

export interface StageMeta {
  index: LearningStage;
  code: string;
  titleKo: string;
  subtitleKo: string;
  missionGoal: string;
  detectiveTip: string;
}

export interface MissionProgress {
  questionId: string;
  started: boolean;
  completed: boolean;
  stars: StarRating;
  currentStage: LearningStage;
  guessChoiceIndex: number | null;
  discoveredClues: string[];
  storyChecked: boolean;
  bossChoiceIndex: number | null;
  isCorrect: boolean | null;
  attempts: number;
  earnedXp: number;
  completedAt: string | null;
}

export interface StudentProfile {
  nickname: string;
  onboarded: boolean;
  xp: number;
  currentStreak: number;
  streakCount: number; // Best streak ever
  freeExploreMode: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  lastActiveQuestionId: string | null;
}

export interface DailyQuestState {
  dateKey: string; // YYYY-MM-DD
  solvedTodayIds: string[];
  cluesTodayCount: number;
  threePtSolvedTodayIds: string[];
  claimedRewardIds: string[];
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  questionId: string;
  sourceExam: string;
  sectionTitle: string;
  examYear: ExamYear;
  isCorrect: boolean;
  xpDelta: number;
  note: string;
}

export interface BadgeDef {
  id: string;
  title: string;
  subtitle: string;
  category: 'milestone' | 'island' | 'skill' | 'collection';
  tone: 'butter' | 'grass' | 'mint' | 'coral' | 'lavender';
}

export interface QuestGameState {
  version: number;
  profile: StudentProfile;
  progressById: Record<string, MissionProgress>;
  history: HistoryEvent[];
  dailyQuest: DailyQuestState;
  clearedBossZones: Record<string, string>; // key: `${examYear}-${sectionNumber}` -> ISO timestamp
}
