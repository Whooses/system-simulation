export function calculateRetryDelay(attempt: number, baseDelay: number, multiplier: number, jitter: boolean): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  if (jitter) {
    return delay * (0.5 + Math.random());
  }
  return delay;
}
