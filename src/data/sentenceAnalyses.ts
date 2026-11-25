import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';
import { SENTENCE_ANALYSES_PART_1 } from './sentenceAnalysesPart1';
import { SENTENCE_ANALYSES_PART_2 } from './sentenceAnalysesPart2';

export const SENTENCE_ANALYSES: QuestionSentenceAnalysis[] = [
  ...SENTENCE_ANALYSES_PART_1,
  ...SENTENCE_ANALYSES_PART_2,
];

export const SENTENCE_ANALYSIS_BY_ID: Record<string, QuestionSentenceAnalysis> =
  Object.fromEntries(SENTENCE_ANALYSES.map((item) => [item.questionId, item]));
