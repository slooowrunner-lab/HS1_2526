// EnvironmentStateController: Computes progressive map zone states, fog-of-war, and path illumination
// strictly derived from real mission progress.

import { ExtractedQuestion, ExamYear } from '../types/question';
import { MissionProgress } from '../types/game';

export type ZoneFogState = 'foggy' | 'clearing' | 'open' | 'mastered';

export interface ZoneEnvironmentInfo {
  zoneKey: string;
  sectionNumber: number;
  completedCount: number;
  totalCount: number;
  starsEarned: number;
  maxStars: number;
  fogState: ZoneFogState;
  isFogCleared: boolean;
  unlockRequirementLabel: string;
}

export function computeZoneEnvironmentMap(
  questions: ExtractedQuestion[],
  progressById: Record<string, MissionProgress>,
  examYear: ExamYear,
  freeExploreMode: boolean,
): Record<number, ZoneEnvironmentInfo> {
  const islandItems = questions.filter((q) => q.examYear === examYear);
  const bySection = new Map<number, ExtractedQuestion[]>();
  for (const q of islandItems) {
    const list = bySection.get(q.sectionNumber) ?? [];
    list.push(q);
    bySection.set(q.sectionNumber, list);
  }

  const sectionNums = Array.from(bySection.keys()).sort((a, b) => a - b);
  const result: Record<number, ZoneEnvironmentInfo> = {};

  let previousSectionCleared = true;

  for (let i = 0; i < sectionNums.length; i += 1) {
    const secNum = sectionNums[i];
    const items = bySection.get(secNum) ?? [];
    const completedCount = items.filter(
      (q) => progressById[q.id]?.completed,
    ).length;
    const startedCount = items.filter((q) => progressById[q.id]?.started).length;
    const starsEarned = items.reduce(
      (acc, q) => acc + (progressById[q.id]?.stars ?? 0),
      0,
    );
    const maxStars = items.length * 3;
    const allCompleted = items.length > 0 && completedCount === items.length;

    // A zone's fog clears when:
    // - It's the first zone (index 0), OR
    // - Previous zone has at least 1 completed mission, OR
    // - Student already started/completed a mission in this zone, OR
    // - Free explore mode is active AND (previous zone has progress or student toggled free explore)
    const isCleared =
      i === 0 ||
      previousSectionCleared ||
      completedCount > 0 ||
      startedCount > 0 ||
      freeExploreMode;

    let fogState: ZoneFogState = 'foggy';
    if (allCompleted) {
      fogState = 'mastered';
    } else if (isCleared && completedCount > 0) {
      fogState = 'open';
    } else if (isCleared) {
      fogState = 'clearing';
    }

    const prevSec = i > 0 ? sectionNums[i - 1] : null;
    result[secNum] = {
      zoneKey: `${examYear}-${secNum}`,
      sectionNumber: secNum,
      completedCount,
      totalCount: items.length,
      starsEarned,
      maxStars,
      fogState,
      isFogCleared: isCleared,
      unlockRequirementLabel:
        prevSec !== null
          ? `${String(prevSec).padStart(2, '0')}번 구역에서 1문제 이상 풀면 안개가 완전히 걷혀요`
          : '첫 번째 탐험 구역',
    };

    previousSectionCleared = completedCount >= 1;
  }

  return result;
}
