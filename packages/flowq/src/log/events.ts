/** Object types in the hospital event log (OCEL 2.0 object types). */
export type FlowObjectType = 'patient' | 'appointment' | 'doctor' | 'doctor_session' | 'lab_line' | 'lab_order' | 'lab_queue_item';

export type FlowActivity =
  | 'book' | 'check_in' | 'walk_in' | 'call' | 'consult_start' | 'consult_end' | 'skip' | 'rejoin' | 'no_show' | 'priority_set'
  | 'session_start' | 'session_pause' | 'session_resume' | 'session_end'
  | 'lab_order' | 'lab_queue' | 'lab_call' | 'sample_collected' | 'report_ready' | 'return_queue';

export interface FlowObjectRef { type: FlowObjectType; id: string; qualifier?: string }

/** One event, the same shape whether it came from the simulator or from the web app's database. */
export interface FlowEvent {
  id: string;
  activity: FlowActivity;
  /** Epoch ms (UTC). */
  time: number;
  objects: FlowObjectRef[];
  attrs: Record<string, string | number | boolean | null>;
}
