/**
 * Calculate the delay before the next retry using exponential backoff.
 *
 * @param attempt - Zero-based retry attempt number
 * @param baseDelay - Initial delay in milliseconds
 * @param multiplier - Exponential backoff multiplier (e.g., 2 for doubling)
 * @param jitter - If true, randomizes delay between 50%–150% of the computed value
 *                 to prevent thundering-herd retries
 */
export function calculateRetryDelay(attempt: number, baseDelay: number, multiplier: number, jitter: boolean): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  if (jitter) {
    return delay * (0.5 + Math.random());
  }
  return delay;
}
