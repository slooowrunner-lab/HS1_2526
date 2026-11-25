import { ExtractedQuestion } from '../types/question';
import { QuestGameState } from '../types/game';

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildJsonExport(items: ExtractedQuestion[]): string {
  return JSON.stringify(
    {
      workbookTitle: '중학 영어 복습 독해편',
      totalPages: 18,
      totalItems: items.length,
      exportedAt: new Date().toISOString(),
      items,
    },
    null,
    2,
  );
}

export interface FullQuestBackupPayload {
  backupType: 'reading_quest_backup_v1';
  exportedAt: string;
  gameState: QuestGameState;
  transcripts: Record<string, string>;
}

export function buildQuestBackupJson(
  gameState: QuestGameState,
  transcripts: Record<string, string>,
): string {
  const payload: FullQuestBackupPayload = {
    backupType: 'reading_quest_backup_v1',
    exportedAt: new Date().toISOString(),
    gameState,
    transcripts,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseQuestBackupJson(
  rawText: string,
): { ok: true; data: FullQuestBackupPayload } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText) as Partial<FullQuestBackupPayload>;
    if (
      !parsed ||
      parsed.backupType !== 'reading_quest_backup_v1' ||
      !parsed.gameState ||
      typeof parsed.gameState !== 'object' ||
      !parsed.gameState.profile
    ) {
      return {
        ok: false,
        error: '올바른 READING QUEST 백업 JSON 형식이 아닙니다.',
      };
    }
    return {
      ok: true,
      data: {
        backupType: 'reading_quest_backup_v1',
        exportedAt: parsed.exportedAt ?? new Date().toISOString(),
        gameState: {
          version: 3,
          profile: {
            nickname:
              parsed.gameState.profile.nickname &&
              parsed.gameState.profile.nickname !== '꼬마 탐정'
                ? String(parsed.gameState.profile.nickname)
                : '영어 탐험가',
            onboarded: true,
            xp: Number(parsed.gameState.profile.xp) || 0,
            currentStreak: Number(parsed.gameState.profile.currentStreak) || 0,
            streakCount: Number(parsed.gameState.profile.streakCount) || 0,
            freeExploreMode:
              parsed.gameState.profile.freeExploreMode !== undefined
                ? Boolean(parsed.gameState.profile.freeExploreMode)
                : true,
            reducedMotion: Boolean(parsed.gameState.profile.reducedMotion),
            soundEnabled:
              parsed.gameState.profile.soundEnabled !== undefined
                ? Boolean(parsed.gameState.profile.soundEnabled)
                : true,
            fontScale:
              parsed.gameState.profile.fontScale === 'lg' ||
              parsed.gameState.profile.fontScale === 'xl'
                ? parsed.gameState.profile.fontScale
                : 'md',
            lastActiveQuestionId: parsed.gameState.profile.lastActiveQuestionId ?? null,
            dailyGoalTarget:
              typeof parsed.gameState.profile.dailyGoalTarget === 'number'
                ? parsed.gameState.profile.dailyGoalTarget
                : 3,
            attendanceDates: Array.isArray(parsed.gameState.profile.attendanceDates)
              ? parsed.gameState.profile.attendanceDates
              : [],
            bookmarkedIds: Array.isArray(parsed.gameState.profile.bookmarkedIds)
              ? parsed.gameState.profile.bookmarkedIds
              : [],
            equippedGearId:
              typeof parsed.gameState.profile.equippedGearId === 'string' &&
              parsed.gameState.profile.equippedGearId
                ? parsed.gameState.profile.equippedGearId
                : 'gear_1',
          },
          progressById: parsed.gameState.progressById ?? {},
          history: Array.isArray(parsed.gameState.history)
            ? parsed.gameState.history
            : [],
          dailyQuest: parsed.gameState.dailyQuest ?? {
            dateKey: new Date().toISOString().slice(0, 10),
            solvedTodayIds: [],
            cluesTodayCount: 0,
            threePtSolvedTodayIds: [],
            claimedRewardIds: [],
          },
          clearedBossZones:
            parsed.gameState.clearedBossZones &&
            typeof parsed.gameState.clearedBossZones === 'object'
              ? parsed.gameState.clearedBossZones
              : {},
        },
        transcripts:
          parsed.transcripts && typeof parsed.transcripts === 'object'
            ? parsed.transcripts
            : {},
      },
    };
  } catch {
    return {
      ok: false,
      error: 'JSON 문법을 해석할 수 없습니다. 파일 내용을 확인해 주세요.',
    };
  }
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvExport(items: ExtractedQuestion[]): string {
  const headers = [
    'id',
    'globalIndex',
    'sectionNumber',
    'sectionTitle',
    'questionNumber',
    'sourceExam',
    'examYear',
    'originalItemNumber',
    'pages',
    'points',
    'format',
    'setRangeLabel',
    'prompt',
    'topicSummary',
    'structureOutline',
    'keyFocus',
    'underlinedTargets',
    'footnotes',
    'choices',
    'answerIndex',
    'answerNote',
    'customTranscript',
  ];

  const rows = items.map((item) => [
    item.id,
    item.globalIndex,
    item.sectionNumber,
    item.sectionTitle,
    item.questionNumber,
    item.sourceExam,
    item.examYear,
    item.originalItemNumber,
    item.pages.map((p) => `${p}p`).join(', '),
    item.points,
    item.format,
    item.setRangeLabel ?? '',
    item.prompt,
    item.topicSummary,
    item.structureOutline.join(' / '),
    item.keyFocus,
    (item.underlinedTargets ?? []).join(' | '),
    (item.footnotes ?? []).map((f) => `${f.term}: ${f.meaning}`).join(' | '),
    item.choices.map((c, idx) => `${idx + 1}. ${c}`).join(' | '),
    item.answerIndex,
    item.answerNote,
    item.customTranscript ?? '',
  ]);

  const csvBody = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');

  return `\uFEFF${csvBody}`;
}

export function buildMarkdownExport(items: ExtractedQuestion[]): string {
  const lines: string[] = [
    '# 중학 영어 복습 독해편 — 문항 데이터 추출 요약',
    '',
    `- 총 문항 수: ${items.length}문항`,
    `- 원본 범위: 1p – 18p`,
    '',
  ];

  let currentSection = -1;
  for (const item of items) {
    if (item.sectionNumber !== currentSection) {
      currentSection = item.sectionNumber;
      lines.push(`## ${item.sectionNumber}. ${item.sectionTitle}`);
      lines.push('');
    }
    lines.push(
      `### [${item.sourceExam}] ${item.prompt} (${item.pages.map((p) => `${p}p`).join('–')}, ${item.points}점)`,
    );
    if (item.setRangeLabel) {
      lines.push(`> ${item.setRangeLabel}`);
    }
    lines.push(`- **주제 요약**: ${item.topicSummary}`);
    lines.push(`- **전개 구조**: ${item.structureOutline.join(' → ')}`);
    lines.push(`- **출제 포인트**: ${item.keyFocus}`);
    if (item.underlinedTargets?.length) {
      lines.push(`- **밑줄 대상**: ${item.underlinedTargets.join(', ')}`);
    }
    if (item.footnotes?.length) {
      lines.push(
        `- **각주 어휘**: ${item.footnotes.map((f) => `${f.term}(${f.meaning})`).join(', ')}`,
      );
    }
    lines.push('- **선택지**:');
    item.choices.forEach((choice, i) => {
      lines.push(`  ${i + 1}. ${choice}`);
    });
    lines.push(`- **정답**: ${item.answerIndex}번 — ${item.answerNote}`);
    if (item.customTranscript) {
      lines.push(`- **사용자 메모/전사**: ${item.customTranscript}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
