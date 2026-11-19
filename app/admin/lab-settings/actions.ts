'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';

const code = z.string().regex(/^[a-z0-9_]{2,40}$/, 'Code: 2-40 lowercase letters, digits or _');
const LineInput = z.object({ id: z.string().uuid().optional(), code, name: z.string().trim().min(2).max(60), typical_min: z.number().positive().max(120), active: z.boolean() });
const TestInput = z.object({
  id: z.string().uuid().optional(), code, name: z.string().trim().min(2).max(80), line_id: z.string().uuid(),
  must_first: z.boolean(), turnaround_min: z.number().int().min(0).max(10080), active: z.boolean(),
});

async function adminDb() {
  await requireRole(['admin']); // the database also refuses non-admin writes (RLS)
  return createClient();
}
const done = (error: { message: string } | null) => {
  revalidatePath('/admin/lab-settings');
  return error ? { ok: false, message: error.message.includes('duplicate') ? 'That code is already used.' : 'Could not save.' } : { ok: true, message: 'Saved.' };
};

export async function saveLabLine(input: z.infer<typeof LineInput>) {
  const p = LineInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid input.' };
  const db = await adminDb();
  const { id, ...row } = p.data;
  const { error } = id ? await db.from('lab_lines').update(row).eq('id', id) : await db.from('lab_lines').insert(row);
  return done(error);
}

export async function saveLabTest(input: z.infer<typeof TestInput>) {
  const p = TestInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid input.' };
  const db = await adminDb();
  const { id, ...row } = p.data;
  const { error } = id ? await db.from('lab_test_types').update(row).eq('id', id) : await db.from('lab_test_types').insert(row);
  return done(error);
}
