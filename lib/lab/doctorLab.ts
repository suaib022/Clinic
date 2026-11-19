// What the doctor's queue screen shows about lab work for today's visits. Pure, unit-tested.
import { adviseReturn, type ReturnAdvice, type SessionInfo } from '@/packages/flowq/src';

export interface RawDoctorLabVisit {
  appointment_id: string; serial_no: number; status: string; patient_name: string | null; patient_uhid: string | null;
  tests: { order_id: string; name: string; line_id: string; status: string; turnaround_min: number; collected_at: string | null; report_ready_at: string | null }[] | null;
  review_appointment_id: string | null;
}

export interface DoctorLabVisit {
  appointmentId: string;
  serialNo: number;
  patientName: string | null;
  patientUhid: string | null;
  tests: { orderId: string; name: string; status: string }[];
  /** Orders not yet sent to the lab: the compounder chooses "Lab now" or "Later". */
  undecidedOrderIds: string[];
  showLabChoice: boolean;
  /** Some report is ready and the patient is not back in line yet: offer a same-day review or a later booking. */
  showReviewOffer: boolean;
  advice: ReturnAdvice | null;
  reviewAppointmentId: string | null;
}

export const labLaterKey = (appointmentId: string) => `lab_later:${appointmentId}`;
export const reviewLaterKey = (appointmentId: string) => `review_later:${appointmentId}`;

/**
 * @param reviewWaitMin  engine estimate of the wait for a report review joining the doctor's line now
 * @param travelBufferMin minutes for the patient to walk back from the lab
 */
export function doctorLabView(raw: RawDoctorLabVisit[], ctx: { now: number; session: SessionInfo | null; reviewWaitMin: number; dismissed: string[]; travelBufferMin?: number }): DoctorLabVisit[] {
  return raw.map((v) => {
    const tests = (v.tests ?? []).map((t) => ({ orderId: t.order_id, name: t.name, status: t.status }));
    const undecided = (v.tests ?? []).filter((t) => t.status === 'ordered').map((t) => t.order_id);
    const anyReady = (v.tests ?? []).some((t) => t.status === 'report_ready');
    // The visit must be over (patient out of the room) before the lab choice is offered.
    const visitOver = v.status !== 'in_consultation';
    const showLabChoice = visitOver && undecided.length > 0 && !ctx.dismissed.includes(labLaterKey(v.appointment_id));
    const showReviewOffer = anyReady && !v.review_appointment_id && !ctx.dismissed.includes(reviewLaterKey(v.appointment_id));
    return {
      appointmentId: v.appointment_id, serialNo: v.serial_no, patientName: v.patient_name, patientUhid: v.patient_uhid, tests,
      undecidedOrderIds: undecided, showLabChoice, showReviewOffer,
      advice: showReviewOffer ? adviseReturn({ reportReadyAt: ctx.now, doctorSession: ctx.session, queueWaitMin: ctx.reviewWaitMin, travelBufferMin: ctx.travelBufferMin ?? 10 }) : null,
      reviewAppointmentId: v.review_appointment_id,
    };
  });
}
