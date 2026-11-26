import { EXTRACTED_QUESTIONS } from './questions';
import { QuestionCoordinate } from '../types/question';

export type QuestionPageRect = QuestionCoordinate;

/**
 * Lookup map of per-(questionId, page) normalized bounding boxes derived directly
 * from EXTRACTED_QUESTIONS coordinates so there is a single source of truth.
 */
export const EXAM_QUESTION_POSITIONS: Record<
  string,
  Record<number, QuestionCoordinate>
> = Object.fromEntries(
  EXTRACTED_QUESTIONS.map((q) => [
    q.id,
    Object.fromEntries(q.coordinates.map((coord) => [coord.page, coord])),
  ]),
);
