export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a free-form (non-template) message is allowed to this conversation now. */
export function isWithinSessionWindow(lastInboundAt: Date | null, now: number = Date.now()): boolean {
  if (!lastInboundAt) return false;
  return now - lastInboundAt.getTime() < SESSION_WINDOW_MS;
}
