import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DSS_TEST_ACCOUNTS, devLoginEnabled, type DssTestAccount } from '@/lib/dev/testAccounts';

/**
 * DEV ONLY quick login for the DSS test accounts: /api/dev/login-as?as=compA1
 * Disabled (404) unless DSS_DEV_SEED=1, DSS_TEST_PASSWORD is set and the request is to localhost.
 */
export async function GET(req: NextRequest) {
  if (!devLoginEnabled(req.headers.get('host'))) return new NextResponse('Not found', { status: 404 });
  const as = req.nextUrl.searchParams.get('as') as DssTestAccount | null;
  const acc = as && Object.hasOwn(DSS_TEST_ACCOUNTS, as) ? DSS_TEST_ACCOUNTS[as] : null;
  if (!acc) return NextResponse.json({ error: 'Unknown test account', accounts: Object.keys(DSS_TEST_ACCOUNTS) }, { status: 400 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: acc.email, password: process.env.DSS_TEST_PASSWORD! });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const next = req.nextUrl.searchParams.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : `/${acc.role}/dashboard`;
  return NextResponse.redirect(new URL(dest, req.url));
}
