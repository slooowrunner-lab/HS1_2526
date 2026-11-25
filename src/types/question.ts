export type ExamYear = '2026' | '2025';

export type QuestionFormat =
  | 'multiple-choice'
  | 'in-passage-choice'
  | 'chart-analysis'
  | 'notice-table'
  | 'sentence-insertion'
  | 'paragraph-ordering'
  | 'summary-completion'
  | 'long-passage-set';

export interface ChartDatum {
  label: string;
  value: number;
  unit?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface FootnoteItem {
  term: string;
  meaning: string;
}

export interface ExtractedQuestion {
  id: string;
  globalIndex: number;
  sectionNumber: number;
  sectionTitle: string;
  questionNumber: number;
  sourceExam: string;
  examYear: ExamYear;
  originalItemNumber: string;
  pages: number[];
  points: 2 | 3;
  format: QuestionFormat;
  setRangeLabel?: string;
  prompt: string;
  topicSummary: string;
  structureOutline: string[];
  keyFocus: string;
  underlinedTargets?: string[];
  chart?: {
    title: string;
    subtitle?: string;
    data: ChartDatum[];
  };
  table?: TableData;
  footnotes?: FootnoteItem[];
  choices: string[];
  answerIndex: number;
  answerNote: string;
  customTranscript?: string;
}

export interface PageAsset {
  page: number;
  url: string;
  filename: string;
  sections: string[];
}

export interface SectionMeta {
  number: number;
  title: string;
  pages: string;
  count: number;
  description: string;
}
