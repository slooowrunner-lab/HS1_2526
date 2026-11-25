import { ExtractedQuestion } from '../types/question';
import {
  BadgeDef,
  DailyQuestState,
  LearningStage,
  MissionProgress,
  NodeStatus,
  QuestGameState,
  StageMeta,
  StarRating,
} from '../types/game';

export const QUEST_STORAGE_KEY = 'reading_quest_state_v1';

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createEmptyDailyQuest(dateKey = getTodayDateKey()): DailyQuestState {
  return {
    dateKey,
    solvedTodayIds: [],
    cluesTodayCount: 0,
    threePtSolvedTodayIds: [],
    claimedRewardIds: [],
  };
}

export const DAILY_QUEST_CATALOG = [
  {
    id: 'dq_solve_2',
    title: '오늘의 독해 2문제 해결하기',
    target: 2,
    xpReward: 25,
  },
  {
    id: 'dq_clues_4',
    title: '단서 · 어휘 카드 4개 채집하기',
    target: 4,
    xpReward: 20,
  },
  {
    id: 'dq_three_pt_1',
    title: '3점 고난도 미션 1개 클리어하기',
    target: 1,
    xpReward: 30,
  },
] as const;

export const STAGE_META: StageMeta[] = [
  {
    index: 0,
    code: '1단계',
    titleKo: '단서 모으기',
    subtitleKo: '시험지 속 힌트 단어와 핵심 포인트를 먼저 확인해요',
    missionGoal: '발문과 원본 시험지를 보고 아래 단서 카드를 눌러 뜻을 확인하세요.',
    detectiveTip: '어려운 단어(*각주)와 핵심 포인트만 먼저 봐도 글의 주제가 금방 보여요.',
  },
  {
    index: 1,
    code: '2단계',
    titleKo: '글 흐름 보기',
    subtitleKo: '글의 전개 순서나 핵심 내용을 먼저 짚어봐요',
    missionGoal: '글 흐름 카드를 순서대로 누르거나 핵심 주제를 골라보세요.',
    detectiveTip: '처음 → 중간 → 결론의 연결고리를 찾으면 정답이 훨씬 쉬워져요.',
  },
  {
    index: 2,
    code: '3단계',
    titleKo: '정답 고르기',
    subtitleKo: '원본 시험지와 함께 보며 ①–⑤ 중 정답을 선택해요',
    missionGoal: '시험지 내용과 대조해 보기 ①–⑤ 중 정답을 눌러 제출하세요.',
    detectiveTip: '헷갈릴 땐 원본 시험지에서 밑줄 친 문장과 앞뒤 연결어를 다시 확인해 보세요.',
  },
  {
    index: 3,
    code: '4단계',
    titleKo: '결과 · 노트',
    subtitleKo: '정답 해설, 별 등급, 오늘의 요약을 확인해요',
    missionGoal: '해설과 별 등급을 확인하고 바로 다음 문제로 이어가세요.',
    detectiveTip: '단서를 모두 모으고 한 번에 맞히면 ★3 마스터 별을 받을 수 있어요!',
  },
];

export const BADGE_CATALOG: BadgeDef[] = [
  {
    id: 'first_clue',
    title: '첫 돋보기',
    subtitle: '단서 1개 이상 처음 채집하기',
    category: 'milestone',
    tone: 'butter',
  },
  {
    id: 'first_mission',
    title: '첫 사건 해결',
    subtitle: '첫 번째 독해 미션 완료하기',
    category: 'milestone',
    tone: 'grass',
  },
  {
    id: 'spring_explorer',
    title: '봄빛 초원 개척자',
    subtitle: '2025 탐험 섬 5문항 이상 완료',
    category: 'island',
    tone: 'mint',
  },
  {
    id: 'lake_explorer',
    title: '라벤더 호수 탐험가',
    subtitle: '2026 탐험 섬 5문항 이상 완료',
    category: 'island',
    tone: 'lavender',
  },
  {
    id: 'three_point_ace',
    title: '3점 고난도 에이스',
    subtitle: '3점 배점 미션 3문항 이상 해결',
    category: 'skill',
    tone: 'coral',
  },
  {
    id: 'chart_decoder',
    title: '도표 · 안내문 명탐정',
    subtitle: '도표·표 포함 미션 2문항 이상 해결',
    category: 'skill',
    tone: 'butter',
  },
  {
    id: 'vocab_collector_10',
    title: '어휘 수집가',
    subtitle: '단서·어휘 10개 이상 채집',
    category: 'collection',
    tone: 'mint',
  },
  {
    id: 'vocab_master_30',
    title: '단서 박물관장',
    subtitle: '단서·어휘 30개 이상 채집',
    category: 'collection',
    tone: 'lavender',
  },
  {
    id: 'streak_5',
    title: '연속 정답 콤보',
    subtitle: '연속 5문항 정답 달성',
    category: 'milestone',
    tone: 'coral',
  },
  {
    id: 'island_2025_master',
    title: '2025 섬 정복자',
    subtitle: '2025 탐험 섬 28문항 모두 완료',
    category: 'island',
    tone: 'grass',
  },
  {
    id: 'island_2026_master',
    title: '2026 섬 정복자',
    subtitle: '2026 탐험 섬 28문항 모두 완료',
    category: 'island',
    tone: 'lavender',
  },
  {
    id: 'grand_detective',
    title: '그랜드 마스터 탐정',
    subtitle: '전체 56개 독해 미션 모두 완료',
    category: 'milestone',
    tone: 'butter',
  },
];

export function getTotalClueCount(question: ExtractedQuestion): number {
  return (
    (question.footnotes?.length ?? 0) +
    (question.underlinedTargets?.length ?? 0) +
    1 // keyFocus card
  );
}

export function computeEarnedStars(
  question: ExtractedQuestion,
  discoveredCluesCount: number,
  cleanSolveThisTry: boolean,
  existingStars: StarRating = 0,
): StarRating {
  const totalClues = getTotalClueCount(question);
  const allClues = discoveredCluesCount >= totalClues;
  const halfClues = discoveredCluesCount >= Math.ceil(totalClues / 2);

  let calculated: StarRating = 1;
  if (allClues && cleanSolveThisTry) {
    calculated = 3;
  } else if (halfClues) {
    calculated = 2;
  }

  return Math.max(existingStars, calculated) as StarRating;
}

export function getComboBonusXp(streak: number): number {
  if (streak >= 5) return 15;
  if (streak >= 3) return 10;
  if (streak >= 2) return 5;
  return 0;
}

export function createInitialGameState(): QuestGameState {
  return {
    version: 3,
    profile: {
      nickname: '꼬마 탐정',
      onboarded: false,
      xp: 0,
      currentStreak: 0,
      streakCount: 0,
      freeExploreMode: true,
      reducedMotion: false,
      soundEnabled: true,
      lastActiveQuestionId: null,
    },
    progressById: {},
    history: [],
    dailyQuest: createEmptyDailyQuest(),
    clearedBossZones: {},
  };
}

function clampStage(val: unknown): LearningStage {
  const num = Number(val);
  if (num <= 0 || Number.isNaN(num)) return 0;
  if (num >= 3) return 3;
  return num as LearningStage;
}

export function loadGameState(): QuestGameState {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (!raw) return createInitialGameState();
    const parsed = JSON.parse(raw) as Partial<QuestGameState>;
    const base = createInitialGameState();
    const today = getTodayDateKey();

    const normalizedProgress: Record<string, MissionProgress> = {};
    if (parsed.progressById && typeof parsed.progressById === 'object') {
      for (const [k, v] of Object.entries(parsed.progressById)) {
        if (!v) continue;
        const legacyCompleted = Boolean(v.completed);
        const inferredStars: StarRating =
          typeof v.stars === 'number'
            ? (Math.min(3, Math.max(0, v.stars)) as StarRating)
            : legacyCompleted
              ? 1
              : 0;
        normalizedProgress[k] = {
          ...createEmptyProgress(k),
          ...v,
          stars: inferredStars,
          currentStage: legacyCompleted ? 3 : clampStage(v.currentStage),
        };
      }
    }

    const savedDaily = parsed.dailyQuest;
    const dailyQuest =
      savedDaily && savedDaily.dateKey === today
        ? {
            dateKey: today,
            solvedTodayIds: Array.isArray(savedDaily.solvedTodayIds)
              ? savedDaily.solvedTodayIds
              : [],
            cluesTodayCount: Number(savedDaily.cluesTodayCount) || 0,
            threePtSolvedTodayIds: Array.isArray(savedDaily.threePtSolvedTodayIds)
              ? savedDaily.threePtSolvedTodayIds
              : [],
            claimedRewardIds: Array.isArray(savedDaily.claimedRewardIds)
              ? savedDaily.claimedRewardIds
              : [],
          }
        : createEmptyDailyQuest(today);

    const hasPriorActivity =
      (Number(parsed.profile?.xp) || 0) > 0 ||
      Object.keys(normalizedProgress).length > 0 ||
      Boolean(
        parsed.profile?.nickname &&
          parsed.profile.nickname.trim() !== '' &&
          parsed.profile.nickname !== '꼬마 탐정',
      );

    return {
      version: 3,
      profile: {
        ...base.profile,
        ...(parsed.profile ?? {}),
        onboarded:
          parsed.profile?.onboarded !== undefined
            ? Boolean(parsed.profile.onboarded)
            : hasPriorActivity,
        currentStreak: Number(parsed.profile?.currentStreak) || 0,
        soundEnabled:
          parsed.profile?.soundEnabled !== undefined
            ? Boolean(parsed.profile.soundEnabled)
            : true,
        freeExploreMode:
          parsed.profile?.freeExploreMode !== undefined
            ? Boolean(parsed.profile.freeExploreMode)
            : true,
      },
      progressById: normalizedProgress,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      dailyQuest,
      clearedBossZones:
        parsed.clearedBossZones && typeof parsed.clearedBossZones === 'object'
          ? parsed.clearedBossZones
          : {},
    };
  } catch {
    return createInitialGameState();
  }
}

export function saveGameState(state: QuestGameState): void {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeLevelInfo(xp: number): {
  level: number;
  title: string;
  gearName: string;
  currentIntoLevel: number;
  xpPerLevel: number;
  progressPct: number;
} {
  const xpPerLevel = 150;
  const safeXp = Math.max(0, xp);
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentIntoLevel = safeXp % xpPerLevel;
  const progressPct = Math.round((currentIntoLevel / xpPerLevel) * 100);

  const ranks = [
    { title: '초보 수습 탐정', gearName: '나무 돋보기' },
    { title: '풀잎 단서 탐정', gearName: '황동 돋보기' },
    { title: '나침반 모험가', gearName: '탐정 회중시계' },
    { title: '이야기 추적자', gearName: '황금 나침반' },
    { title: '별빛 명탐정', gearName: '별빛 망원경' },
    { title: '황금 돋보기 마스터', gearName: '그랜드 트로피' },
  ];
  const rank = ranks[Math.min(level - 1, ranks.length - 1)];

  return {
    level,
    title: rank.title,
    gearName: rank.gearName,
    currentIntoLevel,
    xpPerLevel,
    progressPct,
  };
}

export function createEmptyProgress(questionId: string): MissionProgress {
  return {
    questionId,
    started: false,
    completed: false,
    stars: 0,
    currentStage: 0,
    guessChoiceIndex: null,
    discoveredClues: [],
    storyChecked: false,
    bossChoiceIndex: null,
    isCorrect: null,
    attempts: 0,
    earnedXp: 0,
    completedAt: null,
  };
}

export function computeNodeStatusMap(
  questions: ExtractedQuestion[],
  progressById: Record<string, MissionProgress>,
  freeExploreMode: boolean,
): Record<string, NodeStatus> {
  const map: Record<string, NodeStatus> = {};

  for (const year of ['2025', '2026'] as const) {
    const islandItems = questions.filter((q) => q.examYear === year);
    const seenSection = new Set<number>();
    let canOpenNext = true;

    islandItems.forEach((item, idx) => {
      const isSectionFirst = !seenSection.has(item.sectionNumber);
      seenSection.add(item.sectionNumber);

      const prog = progressById[item.id];
      if (prog?.completed) {
        map[item.id] = 'completed';
        canOpenNext = true;
      } else if (prog?.started) {
        map[item.id] = 'in_progress';
        canOpenNext = false;
      } else if (freeExploreMode || idx === 0 || isSectionFirst || canOpenNext) {
        map[item.id] = 'available';
        canOpenNext = false;
      } else {
        map[item.id] = 'locked';
      }
    });
  }

  return map;
}

export function evaluateEarnedBadges(
  state: QuestGameState,
  questions: ExtractedQuestion[],
): string[] {
  const earned = new Set<string>();
  const progresses = Object.values(state.progressById);
  const completedList = progresses.filter((p) => p.completed);
  const totalClues = progresses.reduce(
    (sum, p) => sum + (p.discoveredClues?.length ?? 0),
    0,
  );

  if (totalClues >= 1) earned.add('first_clue');
  if (totalClues >= 10) earned.add('vocab_collector_10');
  if (totalClues >= 30) earned.add('vocab_master_30');
  if (completedList.length >= 1) earned.add('first_mission');

  const questionById = new Map(questions.map((q) => [q.id, q]));

  let count2025 = 0;
  let count2026 = 0;
  let threePtCount = 0;
  let chartTableCount = 0;

  for (const p of completedList) {
    const q = questionById.get(p.questionId);
    if (!q) continue;
    if (q.examYear === '2025') count2025 += 1;
    if (q.examYear === '2026') count2026 += 1;
    if (q.points === 3) threePtCount += 1;
    if (q.chart || q.table) chartTableCount += 1;
  }

  if (count2025 >= 5) earned.add('spring_explorer');
  if (count2026 >= 5) earned.add('lake_explorer');
  if (threePtCount >= 3) earned.add('three_point_ace');
  if (chartTableCount >= 2) earned.add('chart_decoder');
  if (state.profile.streakCount >= 5) earned.add('streak_5');

  const total2025 = questions.filter((q) => q.examYear === '2025').length;
  const total2026 = questions.filter((q) => q.examYear === '2026').length;
  if (count2025 >= total2025 && total2025 > 0) earned.add('island_2025_master');
  if (count2026 >= total2026 && total2026 > 0) earned.add('island_2026_master');
  if (completedList.length >= questions.length && questions.length > 0) {
    earned.add('grand_detective');
  }

  return Array.from(earned);
}
