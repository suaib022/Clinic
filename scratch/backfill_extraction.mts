// Queues prescriptions/test reports uploaded before extraction existed, then processes the queue.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/backfill_extraction.mts
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processQueue } from '@/lib/extraction/processRecord';

const { data: queued, error } = await db.from('medical_records')
    .update({ extraction_status: 'pending' })
    .eq('extraction_status', 'none')
    .in('record_type', ['prescription', 'test_report'])
    .select('id');
if (error) throw error;
console.log('queued', queued.length);

for (;;) {
    const batch = await processQueue(5);
    if (!batch.length) break;
    for (const r of batch) console.log(r.recordId, r.status, r.error ?? '');
}
