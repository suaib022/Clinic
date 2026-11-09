// Pure data types for the queue engine. No Supabase, no Next: everything is plain data in, plain data out.
// All instants are epoch milliseconds (UTC). Durations are minutes.

export type VisitType = 'new' | 'follow_up';
export type ApptStatus =
  | 'hold' | 'scheduled' | 'checked_in' | 'in_consultation' | 'prescription_pending' | 'completed' | 'cancelled' | 'no_show';
export type SessionState = 'not_started' | 'active' | 'paused' | 'ended';
export type PriorityLevel = 0 | 1 | 2; // normal, priority, emergency

export interface DssSettings {
  onTimeBandMin: number;
  lateBandMin: number;
  graceMin: number;
  noShowMin: number;
  doctorLateAlertMin: number;
  nearTurnCount: number;
  undoWindowSec: number;
  minDurationSamples: number;
  defaultSlotMin: number;
  durationClampMin: number;
  durationClampMax: number;
}

/** B1 defaults (same values as the dss_settings table defaults). */
export const DEFAULT_SETTINGS: DssSettings = {
  onTimeBandMin: 5,
  lateBandMin: 15,
  graceMin: 10,
  noShowMin: 30,
  doctorLateAlertMin: 20,
  nearTurnCount: 3,
  undoWindowSec: 120,
  minDurationSamples: 10,
  defaultSlotMin: 10,
  durationClampMin: 3,
  durationClampMax: 60,
};

export interface QueueAppointment {
  id: string;
  serialNo: number;
  status: ApptStatus;
  bookedAt: number;
  slotMinutes?: number | null;
  checkedInAt?: number | null;
  calledAt?: number | null;
  consultStartedAt?: number | null;
  consultEndedAt?: number | null;
  priorityLevel: PriorityLevel;
  visitType: VisitType;
  visitSource: 'online' | 'walk_in';
  skippedAt?: number | null;
  rejoinedAt?: number | null;
  /** Staff-only fields; absent for patient views. */
  patientName?: string | null;
  patientUhid?: string | null;
  patientMobile?: string | null;
}

export interface Pause {
  pausedAt: number;
  resumedAt?: number | null;
  reason?: string | null;
}

export interface SessionInfo {
  state: SessionState;
  scheduledStartAt?: number | null;
  scheduledEndAt?: number | null;
  startedAt?: number | null;
  endedAt?: number | null;
  pauses: Pause[];
}

export interface DurationStats {
  typical: number;
  short: number;
  long: number;
  source: 'history' | 'department' | 'slot';
  samples: number;
}
export type Durations = Record<VisitType, DurationStats>;

export interface EngineInput {
  now: number;
  settings: DssSettings;
  session: SessionInfo;
  appointments: QueueAppointment[];
  /** Past finished-visit durations (minutes), most recent first. */
  history: Record<VisitType, number[]>;
  /** Department average consult minutes, if the doctor's department has a benchmark. */
  departmentAvgMin?: number | null;
  /** The doctor's real slot length; settings.defaultSlotMin is the fallback. */
  slotMinutes?: number | null;
  /** First estimate recorded after check-in, per appointment (for "wait grew a lot"). */
  checkinEtaAt?: Record<string, number | null | undefined>;
  lastBroadcast?: { at: number; minutes: number } | null;
  dismissed?: string[];
}

export type Stage = 'not_arrived' | 'waiting' | 'skipped' | 'in_room' | 'done' | 'no_show' | 'cancelled';
export type StatusLabel = 'early' | 'on_time' | 'running_late' | 'delayed' | 'not_arrived';
export type Confidence = 'high' | 'medium' | 'low';
export type Flag =
  | 'doctor_not_started' | 'doctor_paused' | 'session_ended' | 'doctor_late_start'
  | 'visits_longer' | 'not_arrived_ahead_may_come' | 'consult_overrun' | 'emergency_ahead';

export interface PatientEstimate {
  appointmentId: string;
  serialNo: number;
  stage: Stage;
  /** 1-based place in the waiting line (waiting only). */
  position: number | null;
  patientsAhead: number | null;
  expectedStartAt: number | null;
  lowAt: number | null;
  highAt: number | null;
  /** Wait range from now, rounded to 5 minutes. */
  waitMinLow: number | null;
  waitMinHigh: number | null;
  confidence: Confidence | null;
  label: StatusLabel | null;
  /** expected (or actual) start minus booked time, minutes. */
  deltaMin: number | null;
  flags: Flag[];
  reason: string;
}

export interface NowServing {
  appointmentId: string;
  serialNo: number;
  startedAt: number;
  elapsedMin: number;
  expectedMin: number;
  overrun: boolean;
}

export interface DaySummary {
  seen: number;
  inRoom: number;
  waiting: number;
  notArrived: number;
  noShows: number;
  avgVisitMin: number | null;
  delayMin: number;
}

export interface QueueResult {
  now: number;
  session: { state: SessionState; lateStartMin: number; pausedSinceAt: number | null; pauseReason: string | null };
  durations: Durations;
  nowServing: NowServing | null;
  doctorFreeInMin: number;
  /** Waiting line in call order (appointment ids). */
  line: string[];
  estimates: Record<string, PatientEstimate>;
  summary: DaySummary;
}

export type SuggestionType =
  | 'call_next' | 'skip' | 'no_show' | 'notify_delay' | 'accept_walk_in' | 'check_on' | 'long_pause' | 'resolve_remaining';
export type ActionKind =
  | 'call_next' | 'skip' | 'no_show' | 'broadcast_delay' | 'open_walk_in' | 'acknowledge' | 'resume' | 'resolve_remaining';

export interface Suggestion {
  id: string;
  key: string;
  type: SuggestionType;
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  action: { kind: ActionKind; label: string; appointmentId?: string; minutes?: number; expectedCurrent?: string | null };
}
