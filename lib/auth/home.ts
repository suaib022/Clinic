/** Where each role lands after login. Lab staff use the existing 'technician' role and work under /lab. */
export function homeFor(role: string | null | undefined): string {
  if (!role) return '/';
  if (role === 'technician') return '/lab/dashboard';
  return `/${role}/dashboard`;
}
