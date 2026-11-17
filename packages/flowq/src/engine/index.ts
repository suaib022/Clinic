// Queue engine: pure functions for the Live Queue & Decision Support System (Part B rules).
export * from './types';
export { countedTime, compareLine, computeQueueOrder } from './order';
export { computeExpectedDurations, percentile, residualMin } from './durations';
export { durationOf, perVisitMin } from './visit';
export { learnRates } from './rates';
export { computeEstimates, statusLabel, confidence, reasonText, expectedArrivalsAheadMin, stillComesP, arrivesBeforeP } from './estimates';
export { computeSuggestions } from './suggestions';
export { activeMinutes, round5, MIN, normalQuantile, normalCdf } from './time';

import type { EngineInput, QueueResult, Suggestion } from './types';
import { computeEstimates } from './estimates';
import { computeSuggestions } from './suggestions';

/** One call for screens: estimates for everyone plus the compounder's suggestions. */
export function runEngine(input: EngineInput): { result: QueueResult; suggestions: Suggestion[] } {
  const result = computeEstimates(input);
  return { result, suggestions: computeSuggestions(input, result) };
}
