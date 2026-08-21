import { describe, it, expect } from 'vitest';
import { formatJamDate, formatJamTime } from './formatJamTime';

// 7:30 PM on Sept 2 in Los Angeles is already Sept 3 in UTC, which is the date
// a share preview showed while it formatted in the server's own timezone.
const EVENING_PT = '2026-09-03T02:30:00+00:00';

describe('formatJamDate', () => {
  it('uses the jam timezone rather than the server timezone', () => {
    expect(formatJamDate(EVENING_PT, 'America/Los_Angeles')).toBe('September 2, 2026');
    expect(formatJamDate(EVENING_PT, 'UTC')).toBe('September 3, 2026');
  });

  it('returns null without a start time', () => {
    expect(formatJamDate(null, 'America/Los_Angeles')).toBeNull();
    expect(formatJamDate(undefined, 'America/Los_Angeles')).toBeNull();
  });
});

describe('formatJamTime', () => {
  it('uses the jam timezone rather than the server timezone', () => {
    expect(formatJamTime(EVENING_PT, 'America/Los_Angeles')).toBe('Wednesday, September 2 at 7:30 PM');
    expect(formatJamTime(EVENING_PT, 'UTC')).toBe('Thursday, September 3 at 2:30 AM');
  });
});
