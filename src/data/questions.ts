import { QUESTIONS_PART_1 } from './questionsPart1';
import { QUESTIONS_PART_2 } from './questionsPart2';
import { ExtractedQuestion } from '../types/question';

export const EXTRACTED_QUESTIONS: ExtractedQuestion[] = [
  ...QUESTIONS_PART_1,
  ...QUESTIONS_PART_2,
];
