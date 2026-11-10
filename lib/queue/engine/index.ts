// Queue engine: pure functions for the Live Queue & Decision Support System (Part B rules).
export * from './types';
export { countedTime, compareLine, computeQueueOrder } from './order';
export { computeExpectedDurations, percentile } from './durations';
export { computeEstimates, statusLabel, confidence, reasonText } from './estimates';
export { computeSuggestions } from './suggestions';
export { activeMinutes, round5, MIN } from './time';

import type { EngineInput, QueueResult, Suggestion } from './types';
import { computeEstimates } from './estimates';
import { computeSuggestions } from './suggestions';

/** One call for screens: estimates for everyone plus the compounder's suggestions. */
export function runEngine(input: EngineInput): { result: QueueResult; suggestions: Suggestion[] } {
  const result = computeEstimates(input);
  return { result, suggestions: computeSuggestions(input, result) };
}
