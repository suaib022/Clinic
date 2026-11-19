import type { DssSettings, PriorityLevel, SessionInfo } from '../engine/types';

/** One sample-collection line (blood, urine, X-ray, ...) with one counter. */
export interface LabLine {
  id: string;
  name: string;
  /** Typical minutes per patient when there is no history yet. */
  typicalMin: number;
}

export type LabItemStatus = 'queued' | 'called' | 'collected' | 'skipped' | 'cancelled';

/** One patient waiting in one lab line (all their tests for that line together). */
export interface LabItem {
  id: string;
  lineId: string;
  patientId: string;
  queuedAt: number;
  status: LabItemStatus;
  calledAt?: number | null;
  collectedAt?: number | null;
  priorityLevel: PriorityLevel;
}

export interface LineInput {
  now: number;
  settings: DssSettings;
  /** The counter's session: open, paused or closed for the day. */
  session: SessionInfo;
  line: LabLine;
  items: LabItem[];
  /** Past collection times in minutes, most recent first. */
  history: number[];
}
