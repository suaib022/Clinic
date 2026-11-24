import { NextResponse, type NextRequest } from 'next/server';
import { getApiUser } from '@/lib/queue/server';
import { checkRange } from '@/lib/flowlab/dateRange';
import { loadFlowEvents } from '@/lib/flowlab/logSource';
import { toOcelJson, toXes } from '@/packages/flowq/src';

/** Admin-only download of the queue event log: /api/admin/flow-log?format=ocel|xes&from=yyyy-mm-dd&to=yyyy-mm-dd. Read-only. */
export async function GET(req: NextRequest) {
  const u = await getApiUser();
  if (!u) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  if (u.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const format = q.get('format');
  if (format !== 'ocel' && format !== 'xes') return NextResponse.json({ error: 'format must be ocel or xes' }, { status: 400 });
  const from = q.get('from') ?? undefined, to = q.get('to') ?? undefined;
  const bad = checkRange(from, to);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  try {
    const { events } = await loadFlowEvents(u.supabase, from!, to!);
    const name = `queue-${from}_${to}`;
    const body = format === 'ocel' ? JSON.stringify(toOcelJson(events), null, 1) : toXes(events);
    return new NextResponse(body, { headers: {
      'content-type': format === 'ocel' ? 'application/json; charset=utf-8' : 'application/xml; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.${format === 'ocel' ? 'ocel.json' : 'xes'}"`,
      'cache-control': 'no-store',
    } });
  } catch {
    return NextResponse.json({ error: 'Could not read the queue log.' }, { status: 500 });
  }
}
