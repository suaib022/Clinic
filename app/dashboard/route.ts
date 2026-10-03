import { requireRole } from '@/lib/auth/requireRole';

export async function GET() {
    // This will force redirect to the correct dashboard based on the user's role
    await requireRole(['__DUMMY_ROLE_TO_FORCE_REDIRECT__']);
}
