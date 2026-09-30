// Minimum age to hold an account (founder decision 2026-09-30).
export const MIN_AGE = 13;

// Whole years between a YYYY-MM-DD birth date and today; null if unparseable.
export function computeAge(dob?: string | null): number | null {
  // Read the parts directly: new Date('YYYY-MM-DD') is UTC midnight, which is
  // still the previous day in timezones west of UTC (off by one on birthdays).
  const m = dob?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age--;
  return age;
}
