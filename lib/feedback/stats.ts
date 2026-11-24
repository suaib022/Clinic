import { CATEGORIES, type Category } from './rules';

export interface RatedRow {
  ratingA: number;
  ratingB: number;
  categories: readonly string[];
}

export interface Summary {
  count: number;
  avgA: number | null;
  avgB: number | null;
  categoryCounts: Record<Category, number>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Averages and category counts for a list of feedback rows. Pure. */
export function summarize(rows: readonly RatedRow[]): Summary {
  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  if (!rows.length) return { count: 0, avgA: null, avgB: null, categoryCounts };

  let sumA = 0;
  let sumB = 0;
  for (const r of rows) {
    sumA += r.ratingA;
    sumB += r.ratingB;
    for (const c of new Set(r.categories)) {
      if (c in categoryCounts) categoryCounts[c as Category] += 1;
    }
  }
  return {
    count: rows.length,
    avgA: round1(sumA / rows.length),
    avgB: round1(sumB / rows.length),
    categoryCounts,
  };
}

/** Homepage label, e.g. "4.3 (12 reviews)". Null means hide the block. */
export function formatRating(avg: number | null, count: number): string | null {
  if (!count || avg == null) return null;
  return `${avg.toFixed(1)} (${count} review${count === 1 ? '' : 's'})`;
}
