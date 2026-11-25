export type ChunkRole = 'S' | 'V' | 'O' | 'C' | 'M' | 'CONJ';

export interface SentenceChunk {
  id: string;
  english: string;
  role: ChunkRole;
  roleLabelKo: string;
  meaningKo: string;
  howToRead: string;
  relationNote: string;
  thinkingQuestion: string;
  grammarTip?: string;
  koOrderIndex: number;
}

export interface QuestionSentenceAnalysis {
  questionId: string;
  sentence: string;
  chunks: SentenceChunk[];
  modelTranslationKo: string;
  literalFlowKo: string;
  coreMeaningKeywords: string[];
  stepHints: string[];
  grammarDeepDive: string;
}

export interface RoleStyleMeta {
  role: ChunkRole;
  shortTag: string;
  labelKo: string;
  badgeText: string;
  description: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  pillBg: string;
}

export const CHUNK_ROLE_META: Record<ChunkRole, RoleStyleMeta> = {
  S: {
    role: 'S',
    shortTag: 'S',
    labelKo: '주어 (S)',
    badgeText: 'S · 주어',
    description: '문장의 주인공 (~은/는/이/가)',
    activeBg: 'bg-[#E6F4FC]',
    activeBorder: 'border-[#3E85B3]',
    activeText: 'text-[#133A52]',
    pillBg: 'bg-[#CBE8F8]',
  },
  V: {
    role: 'V',
    shortTag: 'V',
    labelKo: '동사 (V)',
    badgeText: 'V · 동사',
    description: '주어가 하는 동작·상태 (~하다/~이다)',
    activeBg: 'bg-[#FDECE7]',
    activeBorder: 'border-[#C85B3F]',
    activeText: 'text-[#5E1F10]',
    pillBg: 'bg-[#FAD2C6]',
  },
  O: {
    role: 'O',
    shortTag: 'O',
    labelKo: '목적어 (O)',
    badgeText: 'O · 목적어',
    description: '동사의 대상 (~을/를, ~에게)',
    activeBg: 'bg-[#EAF5E4]',
    activeBorder: 'border-[#4E8336]',
    activeText: 'text-[#1A390D]',
    pillBg: 'bg-[#CFE8C3]',
  },
  C: {
    role: 'C',
    shortTag: 'C',
    labelKo: '보어 (C)',
    badgeText: 'C · 보어',
    description: '주어나 목적어의 상태·행동을 보충 설명',
    activeBg: 'bg-[#FFF6DA]',
    activeBorder: 'border-[#B68411]',
    activeText: 'text-[#4C3600]',
    pillBg: 'bg-[#FFE79E]',
  },
  M: {
    role: 'M',
    shortTag: 'M',
    labelKo: '수식어 (M)',
    badgeText: 'M · 수식어',
    description: '때·장소·이유·방법·꾸며주는 말',
    activeBg: 'bg-[#F1ECFA]',
    activeBorder: 'border-[#785EA8]',
    activeText: 'text-[#2F1F52]',
    pillBg: 'bg-[#DFD2F4]',
  },
  CONJ: {
    role: 'CONJ',
    shortTag: '연결',
    labelKo: '연결어',
    badgeText: '연결어',
    description: '앞뒤 문장 흐름을 이어주는 말',
    activeBg: 'bg-[#E5F6F0]',
    activeBorder: 'border-[#2E8568]',
    activeText: 'text-[#103B2C]',
    pillBg: 'bg-[#C2EBDD]',
  },
};
