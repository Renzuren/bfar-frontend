// src/lib/apiMiddleware.js
// API middleware for preprocessing requests and responses.
// Also provides automatic retry / timeout handling so transient network
// failures ("Failed to fetch", timeouts, 5xx blips) are recovered without
// the user having to refresh the page.
import axios from 'axios';
import { preprocessFormData, preprocessFormAnswers, sanitizeHtml } from './preprocessing';
import { getAuthItem, clearAuthStorage } from './authStorage';
import { resolveServiceUrl } from './apiBase';

// ============================================================
// Reliability settings
// ============================================================
const DEFAULT_TIMEOUT = 30000; // ms per individual attempt
const DEFAULT_RETRIES = 3; // automatic retries AFTER the first attempt
const RETRY_BASE_DELAY = 500; // ms before the first retry
const RETRY_MAX_DELAY = 4000; // backoff cap

const isTimeoutError = (error) =>
  error?.code === 'ECONNABORTED' ||
  error?.__bfarTimedOut === true ||
  String(error?.message || '').toLowerCase().includes('timed out') ||
  String(error?.message || '').toLowerCase().includes('timeout of');

const isIdempotent = (config) =>
  ['get', 'head', 'options', 'put', 'delete', 'patch'].includes(
    String(config?.method || 'get').toLowerCase()
  );

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status < 600);

const getRetryDelay = (attempt, baseDelay, maxDelay) => {
  const cap = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
  return Math.floor(cap / 2 + Math.random() * (cap / 2));
};

/**
 * Decide whether a failed request should be retried.
 * - No HTTP response = the request never reached the server (the browser's
 *   "Failed to fetch" / "Network Error"). Safe to retry for any method.
 * - Client-side timeouts are retried only for idempotent methods, because the
 *   server may have already received the request.
 * - HTTP 429 / 5xx are retried only for idempotent methods to avoid duplicating
 *   side effects.
 * - 4xx errors are never retried.
 */
const shouldRetry = (error, config) => {
  if (!error || !config) return false;
  if (config.__bfarNoRetry === true) return false;

  if (!error.response) {
    if (isTimeoutError(error)) return isIdempotent(config);
    return true;
  }
  if (isRetryableStatus(error.response.status)) return isIdempotent(config);
  return false;
};

/**
 * Enhanced axios instance with preprocessing middleware
 */
class ApiClient {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      timeout: DEFAULT_TIMEOUT,
    });

    // Request interceptor for preprocessing + per-request retry tuning
    this.client.interceptors.request.use(
      (config) => this.preprocessRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor for postprocessing + auto-retry
    this.client.interceptors.response.use(
      (response) => this.postprocessResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * Preprocess outgoing requests
   */
  preprocessRequest(config) {
    // Add authorization header if token exists
    const token = getAuthItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tune retry behavior once per logical request (kept across auto-retries).
    if (!config.__bfarRetryReady) {
      config.__bfarRetryReady = true;
      config.__bfarMaxRetries =
        typeof config.retry === 'number' && config.retry >= 0
          ? config.retry
          : (config.__bfarMaxRetries ?? DEFAULT_RETRIES);
      config.__bfarBaseDelay =
        typeof config.retryDelay === 'number' && config.retryDelay >= 0
          ? config.retryDelay
          : RETRY_BASE_DELAY;
      config.__bfarMaxDelay = RETRY_MAX_DELAY;
    }

    // Skip preprocessing for FormData (multipart uploads)
    // Use duck-typing check in addition to instanceof (bundled envs can break instanceof)
    if (config.data instanceof FormData || (config.data && typeof config.data.append === 'function' && typeof config.data.get === 'function')) {
      // Ensure Content-Type is NOT manually set — browser must generate the boundary
      if (config.headers && config.headers['Content-Type'] && config.headers['Content-Type'].includes('multipart/form-data')) {
        delete config.headers['Content-Type'];
      }
      return config;
    }

    // Preprocess request data based on endpoint
    if (config.data) {
      config.data = this.preprocessRequestData(config.url, config.data);
    }

    return config;
  }

  /**
   * Preprocess request data based on endpoint
   */
  preprocessRequestData(url, data) {
    // Form responses - pass through as-is (data built by the component)
    if (url.includes('/responses')) {
      return data;
    }

    // Form creation/update
    if (url.includes('/forms') && (url.includes('/forms/') || !url.includes('/responses'))) {
      return preprocessFormData(data);
    }

    // Auth requests - basic sanitization
    if (url.includes('/auth/')) {
      if (data.email) {
        data.email = data.email.toLowerCase().trim();
      }
      if (data.first_name) {
        data.first_name = sanitizeHtml(data.first_name);
      }
      if (data.last_name) {
        data.last_name = sanitizeHtml(data.last_name);
      }
    }

    return data;
  }

  /**
   * Postprocess incoming responses
   */
  postprocessResponse(response) {
    // Add any response postprocessing here
    // For now, just return the response as-is
    return response;
  }

  /**
   * Attach a human-readable message to an error so UI surfaces never have to
   * show the raw browser "Failed to fetch" string.
   */
  attachFriendlyError(error) {
    if (!error || error.friendlyMessage) return;
    if (error.response) {
      error.friendlyMessage =
        error.response.data?.error ||
        error.response.data?.message ||
        `The server responded with an error (${error.response.status}). Please try again.`;
    } else if (isTimeoutError(error)) {
      error.friendlyMessage = 'The server took too long to respond. Please try again.';
    } else if (error.request) {
      error.friendlyMessage = 'Unable to reach the server. Check your internet connection and try again.';
    } else {
      error.friendlyMessage = error.message || 'Something went wrong. Please try again.';
    }
  }

  /**
   * Handle API errors with preprocessing and automatic retry
   */
  handleError(error) {
    const config = error?.config || {};

    // Preprocess error messages
    if (error.response?.data?.error) {
      error.response.data.error = sanitizeHtml(error.response.data.error);
    }

    if (error.response?.data?.message) {
      error.response.data.message = sanitizeHtml(error.response.data.message);
    }

    // Handle authentication errors. Only treat a 401 as session expiry when the
    // failing request actually carried a token (otherwise a failed login attempt
    // would silently log out an existing session). 401s are never auto-retried.
    if (error.response?.status === 401 && config.headers?.Authorization) {
      clearAuthStorage();
      // Notify AuthContext so the live UI session is cleared too
      window.dispatchEvent(new Event('bfar:unauthorized'));
    }

    config.__bfarRetriesUsed = config.__bfarRetriesUsed || 0;

    const canRetry =
      shouldRetry(error, config) && config.__bfarRetriesUsed < (config.__bfarMaxRetries ?? DEFAULT_RETRIES);

    if (canRetry) {
      config.__bfarRetriesUsed += 1;
      const delay = getRetryDelay(config.__bfarRetriesUsed, config.__bfarBaseDelay ?? RETRY_BASE_DELAY, config.__bfarMaxDelay ?? RETRY_MAX_DELAY);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.client.request(config).then(resolve, reject);
        }, delay);
      });
    }

    this.attachFriendlyError(error);

    if (error.config?.__bfarRetriesUsed) {
      try {
        // eslint-disable-next-line no-console
        console.error(`[api] ${config.method?.toUpperCase()} ${config.url} failed after ${config.__bfarRetriesUsed} retries:`, error.message || error);
      } catch (_) { /* logging must never break the error path */ }
    }

    return Promise.reject(error);
  }

  /**
   * HTTP methods with preprocessing
   */
  get(url, config = {}) {
    return this.client.get(url, config);
  }

  post(url, data, config = {}) {
    return this.client.post(url, data, config);
  }

  put(url, data, config = {}) {
    return this.client.put(url, data, config);
  }

  delete(url, config = {}) {
    return this.client.delete(url, config);
  }
}

// Create and export the API client instance
const BACKEND_URL = resolveServiceUrl(process.env.REACT_APP_BACKEND_URL, 'http://localhost:5000');
const API_BASE = `${BACKEND_URL}/api`;

export const apiClient = new ApiClient(API_BASE);

// Export individual methods for convenience
export const api = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
};

/**
 * Best-effort error message for UI/toast surfaces. Prefers the server-provided
 * message, falls back to an automatically attached friendly message, then to the
 * caller's own fallback text.
 */
export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.friendlyMessage ||
  fallback;