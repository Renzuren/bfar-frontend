// src/lib/apiBase.js
// Resolves service base URLs at runtime. When the app is opened from another
// device on the network (e.g. http://192.168.1.10:5173) the default
// localhost endpoints are rewritten to the page's own host so the frontend
// always talks to the backend on the machine that serves it. This keeps the
// same profile/response records visible and consistent across all devices.
export const resolveServiceUrl = (envUrl, fallback) => {
  const url = envUrl || fallback;
  if (typeof window === 'undefined') return url;
  const pageHost = window.location.hostname;
  const isLocal = !pageHost || pageHost === 'localhost' || pageHost === '127.0.0.1';
  if (isLocal) return url;
  if (!/(localhost|127\.0\.0\.1)/.test(url)) return url;
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?/, `$1${pageHost}$3`);
};