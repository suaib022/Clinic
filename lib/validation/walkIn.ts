import { z } from 'zod';

export const patientLookupSchema = z.object({
  query: z.string().min(10).max(15).regex(/^(\+880|0)1[3-9]\d{8}$|^[A-Z0-9-]{6,15}$/, 'Must be a valid UHID or Bangladeshi mobile number'),
});

export const walkInSchema = z.object({
  patient_id: z.string().uuid(),
  visit_type: z.enum(['new', 'follow_up']),
  is_priority: z.boolean().default(false),
  priority_reason: z.string().optional(),
  idempotency_key: z.string()
});
