// Server clock offset. The server rejects X-Timestamp values more than
// request_timestamp_tolerance_seconds away from its own clock, and user
// machines are often off, so every request uses the corrected clock.

let offsetMs = 0;

// The HTTP Date header has one-second resolution; ignore changes smaller than
// this so the offset does not jitter on every response.
const MIN_ADJUSTMENT_MS = 2000;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function serverTimestampSeconds(): string {
  return Math.floor(serverNow() / 1000).toString();
}

export function setServerTime(serverTimeMs: number, localTimeMs = Date.now(), force = false): void {
  if (!Number.isFinite(serverTimeMs)) return;
  const next = serverTimeMs - localTimeMs;
  if (force || Math.abs(next - offsetMs) >= MIN_ADJUSTMENT_MS) offsetMs = next;
}

/** Updates the offset from a response Date header. Returns true when a Date header was usable. */
export function updateClockFromResponse(response: Response, force = false): boolean {
  const date = response.headers.get('date');
  if (!date) return false;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return false;
  // Date is truncated to the second; +500ms is the expected midpoint.
  setServerTime(parsed + 500, Date.now(), force);
  return true;
}

export function resetClockForTests(): void {
  offsetMs = 0;
}
