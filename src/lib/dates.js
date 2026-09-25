// Dates as the API returns them: Firestore timestamps serialize as
// { _seconds, _nanoseconds }; other fields are ISO strings or epoch millis.

/** Epoch milliseconds of `value`, or 0 when it is missing or not a date. */
export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'object' && !(value instanceof Date)) {
    const seconds = value._seconds ?? value.seconds;
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** "September 26, 2026" (month: 'long') or "Sep 26, 2026" (month: 'short'); 'N/A' when not a date. */
export const formatDate = (value, month = 'long') => {
  const time = toMillis(value);
  if (!time) return 'N/A';
  return new Date(time).toLocaleDateString([], { month, day: 'numeric', year: 'numeric' });
};

/** When the newest of `responses` was submitted (epoch millis), or 0 if none. */
export const latestResponseTime = (responses) =>
  (responses || []).reduce(
    (latest, response) => Math.max(latest, toMillis(response.submitted_at || response.created_at)),
    0
  );
