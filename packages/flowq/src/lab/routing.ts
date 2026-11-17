/**
 * Order in which a patient with tests in several lines should visit them.
 * "Must go first" tests (for example fasting blood) lead; then the shortest expected wait; ties by line id.
 * Closed lines (wait Infinity) go last and are never dropped, so staff still see them.
 */
export function suggestRoute(pending: { lineId: string; mustFirst: boolean }[], waits: Record<string, number>): string[] {
  const lines = new Map<string, boolean>();
  for (const p of pending) lines.set(p.lineId, (lines.get(p.lineId) ?? false) || p.mustFirst);
  const wait = (id: string) => waits[id] ?? Infinity;
  return [...lines.entries()]
    .sort(([a, fa], [b, fb]) => {
      const ca = wait(a) === Infinity, cb = wait(b) === Infinity;
      if (ca !== cb) return ca ? 1 : -1;
      if (fa !== fb) return fa ? -1 : 1;
      return wait(a) - wait(b) || a.localeCompare(b);
    })
    .map(([id]) => id);
}
