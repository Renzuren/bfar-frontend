// src/lib/fetchRetry.js
// Wrapper around the Fetch API that retries transient network failures with a
// short backoff. HTTP error responses are returned as-is (they are not retried),
// and aborted requests (AbortError) are never retried because aborting usually
// signals a deliberate timeout.

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY = 500;
const DEFAULT_MAX_DELAY = 4000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt, baseDelay, maxDelay) => {
  const cap = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
  return Math.floor(cap / 2 + Math.random() * (cap / 2));
};

/**
 * Like fetch(), but retries on network-level failures (the browser throwing
 * "Failed to fetch" before any HTTP response is received). Returns the first
 * successful Response.
 *
 * @param {string|URL} input
 * @param {RequestInit} [init]
 * @param {object} [options]
 * @param {number}   [options.retries=2]    retries AFTER the first attempt
 * @param {number}   [options.baseDelay=500] backoff base in ms
 * @param {number}   [options.maxDelay=4000] backoff cap in ms
 * @param {(error: Error) => boolean} [options.shouldRetry] control which errors are retried
 */
export const fetchWithRetry = async (input, init = {}, options = {}) => {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelay = options.baseDelay ?? DEFAULT_BASE_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
  const shouldRetry = options.shouldRetry ?? ((error) => !error || error.name !== 'AbortError');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) throw error;
      await sleep(getRetryDelay(attempt + 1, baseDelay, maxDelay));
    }
  }
  throw lastError;
};