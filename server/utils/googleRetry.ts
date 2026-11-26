/**
 * Exponential Backoff & Rate-Limit Retry Helper for Google APIs (GSC, GA4, Google Ads)
 * Safely retries transient network errors and 429/5xx quota/rate-limit errors with jitter.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

function isRetryableGoogleError(err: any): boolean {
  if (!err) return false;

  const status = err.code || err.status || err.response?.status;
  const message = String(err.message || err.response?.data?.error?.message || '').toLowerCase();

  // Always retry 429 Too Many Requests and 5xx transient server errors
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return true;
  }

  // Retry 403 only when it's explicitly a rate limit / quota error (not permission denied)
  if (status === 403 && (
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('quota') ||
    message.includes('too many requests')
  )) {
    return true;
  }

  // Transient network errors
  if (
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('temporarily unavailable')
  ) {
    return true;
  }

  return false;
}

export async function withGoogleRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    label = 'Google API'
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const shouldRetry = attempt < maxRetries && isRetryableGoogleError(err);

      if (!shouldRetry) {
        throw err;
      }

      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 400);
      const waitMs = expDelay + jitter;

      console.warn(
        `[RETRY] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${err?.message || err}. Retrying in ${waitMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}
