import { ChunkRole } from '../types/sentenceAnalysis';

export const SENTENCE_LAB_STORAGE_KEY = 'reading_quest_sentence_lab_v1';

export interface QuestionLabDraft {
  // Stage 1: 글 흐름 보기 (순서 배열 & 핵심 요지 선택)
  flowOrderDraft: number[];
  flowOrderChecked: boolean;
  flowGuessDraft: number | null;
  flowGuessChecked: boolean;

  // Stage 1: 초보자 맞춤형 의미 단위 해석
  selectedChunkId: string | null;
  // chunkId -> matched chunkId's Korean meaning (we store chunkId -> matchedMeaningChunkId)
  matchedMeanings: Record<string, string>;
  // chunkId -> student's selected role
  roleSelections: Record<string, ChunkRole>;
  // Ordered list of chunkIds representing Korean translation order
  koAssemblyOrder: string[];
  // Student's optional free-text Korean translation
  koSummaryDraft: string;
  // Self-check / model translation reveal flags
  koAssemblyChecked: boolean;
  revealedModelAnswer: boolean;
  structureOverlayVisible: boolean;
  hintLevel: number;
  // Completion & idempotent XP claim
  sentenceCompleted: boolean;
  sentenceXpClaimed: boolean;
}

export function createEmptyQuestionLabDraft(): QuestionLabDraft {
  return {
    flowOrderDraft: [],
    flowOrderChecked: false,
    flowGuessDraft: null,
    flowGuessChecked: false,
    selectedChunkId: null,
    matchedMeanings: {},
    roleSelections: {},
    koAssemblyOrder: [],
    koSummaryDraft: '',
    koAssemblyChecked: false,
    revealedModelAnswer: false,
    structureOverlayVisible: false,
    hintLevel: 0,
    sentenceCompleted: false,
    sentenceXpClaimed: false,
  };
}

export type SentenceLabStore = Record<string, QuestionLabDraft>;

export function loadSentenceLabStore(): SentenceLabStore {
  try {
    const raw = localStorage.getItem(SENTENCE_LAB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SentenceLabStore;
  } catch {
    return {};
  }
}

export function saveSentenceLabStore(store: SentenceLabStore): void {
  try {
    localStorage.setItem(SENTENCE_LAB_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export function getQuestionLabDraft(
  store: SentenceLabStore,
  questionId: string,
): QuestionLabDraft {
  const existing = store[questionId];
  if (!existing) return createEmptyQuestionLabDraft();
  return {
    ...createEmptyQuestionLabDraft(),
    ...existing,
    flowOrderDraft: Array.isArray(existing.flowOrderDraft)
      ? existing.flowOrderDraft
      : [],
    matchedMeanings:
      existing.matchedMeanings && typeof existing.matchedMeanings === 'object'
        ? existing.matchedMeanings
        : {},
    roleSelections:
      existing.roleSelections && typeof existing.roleSelections === 'object'
        ? existing.roleSelections
        : {},
    koAssemblyOrder: Array.isArray(existing.koAssemblyOrder)
      ? existing.koAssemblyOrder
      : [],
  };
}
