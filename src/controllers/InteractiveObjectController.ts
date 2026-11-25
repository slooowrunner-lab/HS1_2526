// InteractiveObjectController: Manages clickable world objects (treasure chests, glowing flowers, signposts)
// tied to real mission progress, with idempotent one-time LocalStorage persistence.

import { ExamYear, ExtractedQuestion } from '../types/question';
import { MissionProgress } from '../types/game';

export type InteractiveObjectKind = 'chest' | 'flower' | 'signpost' | 'compass';

export interface MapInteractiveObject {
  id: string;
  examYear: ExamYear;
  sectionNumber: number;
  kind: InteractiveObjectKind;
  title: string;
  description: string;
  xpReward: number;
  unlocked: boolean;
  collected: boolean;
  unlockHint: string;
}

const OBJECTS_STORAGE_KEY = 'reading_quest_objects_v1';

export function loadCollectedObjects(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OBJECTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCollectedObjects(collected: Record<string, string>): void {
  try {
    localStorage.setItem(OBJECTS_STORAGE_KEY, JSON.stringify(collected));
  } catch {
    // Ignore storage errors
  }
}

export function buildZoneInteractiveObjects(
  examYear: ExamYear,
  sectionNumber: number,
  zoneQuestions: ExtractedQuestion[],
  progressById: Record<string, MissionProgress>,
  collectedMap: Record<string, string>,
): MapInteractiveObject[] {
  const completedCount = zoneQuestions.filter(
    (q) => progressById[q.id]?.completed,
  ).length;
  const cluesCount = zoneQuestions.reduce(
    (sum, q) => sum + (progressById[q.id]?.discoveredClues?.length ?? 0),
    0,
  );
  const zoneDone =
    zoneQuestions.length > 0 && completedCount === zoneQuestions.length;

  const objects: MapInteractiveObject[] = [];

  // 1. Explorer Signpost / Clue Flower (unlocks after collecting at least 1 clue in this zone)
  const flowerId = `obj-flower-${examYear}-${sectionNumber}`;
  objects.push({
    id: flowerId,
    examYear,
    sectionNumber,
    kind: sectionNumber % 2 === 1 ? 'flower' : 'signpost',
    title: sectionNumber % 2 === 1 ? '반짝이는 단서 꽃' : '탐험가 이정표',
    description:
      cluesCount >= 1
        ? '이 구역에서 단서를 찾아 꽃봉오리가 피었어요! 눌러서 보너스 XP를 받으세요.'
        : '이 구역 문제에서 단서를 1개 이상 확인하면 피어납니다.',
    xpReward: 10,
    unlocked: cluesCount >= 1,
    collected: Boolean(collectedMap[flowerId]),
    unlockHint: '이 구역 단서 카드 1개 이상 열기',
  });

  // 2. Zone Treasure Chest (unlocks after completing at least 1 mission in this zone, or full clear for bonus)
  const chestId = `obj-chest-${examYear}-${sectionNumber}`;
  const chestKind: InteractiveObjectKind = zoneDone ? 'compass' : 'chest';
  objects.push({
    id: chestId,
    examYear,
    sectionNumber,
    kind: chestKind,
    title: zoneDone ? '황금 탐험 나침반' : '탐험 보물 상자',
    description:
      completedCount >= 1
        ? '구역 미션을 해결해 숨겨진 보물 상자가 열렸어요!'
        : '이 구역 문제를 1개 이상 풀면 보물 상자를 열 수 있어요.',
    xpReward: zoneDone ? 20 : 15,
    unlocked: completedCount >= 1,
    collected: Boolean(collectedMap[chestId]),
    unlockHint: '이 구역 문제 1개 이상 정답 맞히기',
  });

  return objects;
}
