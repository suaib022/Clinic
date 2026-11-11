'use server';

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processRecord } from './processRecord';

/**
 * Start extraction for freshly uploaded records without blocking the caller.
 * processRecord() ignores records that are not queued, so passing any id is harmless.
 */
export async function startExtraction(recordIds: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    after(async () => {
        for (const id of recordIds.slice(0, 20)) await processRecord(id);
    });
}
