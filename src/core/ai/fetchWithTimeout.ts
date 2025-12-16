/**
 * Utility to wrap fetch with a configurable timeout using AbortController.
 * If timeoutMs is not provided, behaves like normal fetch (no timeout).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if an error is an AbortError (timeout).
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
