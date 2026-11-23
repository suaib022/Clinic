import { describe, it, expect } from 'vitest';
import { addDays, checkRange, MAX_RANGE_DAYS } from '@/lib/flowlab/dateRange';

describe('date range', () => {
  it('accepts a valid range, including a single day', () => {
    expect(checkRange('2026-11-01', '2026-11-30')).toBeNull();
    expect(checkRange('2026-11-10', '2026-11-10')).toBeNull();
  });
  it('rejects missing, malformed, impossible and reversed dates', () => {
    expect(checkRange(undefined, '2026-11-30')).not.toBeNull();
    expect(checkRange('2026-11-01', '30-11-2026')).not.toBeNull();
    expect(checkRange('2026-02-30', '2026-03-01')).toBe('Not a real date.');
    expect(checkRange('2026-11-30', '2026-11-01')).not.toBeNull();
  });
  it('limits the range length', () => {
    expect(checkRange('2026-01-01', addDays('2026-01-01', MAX_RANGE_DAYS - 1))).toBeNull();
    expect(checkRange('2026-01-01', addDays('2026-01-01', MAX_RANGE_DAYS))).not.toBeNull();
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
