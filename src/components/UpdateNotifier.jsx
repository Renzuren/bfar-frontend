// src/components/UpdateNotifier.jsx
// A tab left open (common on phones) keeps running the JavaScript it loaded,
// so fixes deployed since then never reach it. This checks now and then
// whether index.html points at a newer bundle and, if so, offers a reload.
// It never reloads on its own, so nothing typed into a form is lost.

import { useEffect } from 'react';
import { toast } from 'sonner';

const CHECK_INTERVAL = 5 * 60 * 1000;
const BUNDLE_PATTERN = /\/static\/js\/main\.[a-z0-9]+\.js/;

const loadedBundle = () => {
  const script = [...document.scripts].find((s) => BUNDLE_PATTERN.test(s.src));
  const match = script && script.src.match(BUNDLE_PATTERN);
  return match ? match[0] : null;
};

export default function UpdateNotifier() {
  useEffect(() => {
    const current = loadedBundle();
    // Development server: no hashed bundle to compare.
    if (!current) return undefined;
    let notified = false;

    const check = async () => {
      if (notified || document.visibilityState !== 'visible') return;
      try {
        const html = await (await fetch(`/index.html?check=${Date.now()}`, { cache: 'no-store' })).text();
        const latest = (html.match(BUNDLE_PATTERN) || [])[0];
        if (!latest || latest === current) return;
        notified = true;
        toast('May bagong update ang app', {
          id: 'app-update',
          description: 'I-reload para makuha ang pinakabagong bersyon.',
          duration: Infinity,
          action: { label: 'Reload', onClick: () => window.location.reload() },
        });
      } catch (_) {
        // Offline or the request failed; try again on the next check.
      }
    };

    const timer = setInterval(check, CHECK_INTERVAL);
    document.addEventListener('visibilitychange', check);
    check();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return null;
}
