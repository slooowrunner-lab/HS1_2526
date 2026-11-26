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

export interface QuestionRect {
  /** Left offset ratio (0..1) relative to page image width */
  x: number;
  /** Top offset ratio (0..1) relative to page image height */
  y: number;
  /** Width ratio (0..1) relative to page image width */
  w: number;
  /** Height ratio (0..1) relative to page image height */
  h: number;
}

export interface QuestionCoordinate extends QuestionRect {
  /** Page number (1..18) in the workbook PNGs */
  page: number;
  /** Optional sub-region (in 0..1 page coordinates) highlighting the specific question inside a shared-passage set */
  focus?: QuestionRect;
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
  /** Primary page bounding box [x, y, w, h] in 0..1 normalized coordinates */
  bbox: [number, number, number, number];
  /** Exact per-page normalized coordinates for exam-sheet overlay and scroll anchoring */
  coordinates: QuestionCoordinate[];
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
