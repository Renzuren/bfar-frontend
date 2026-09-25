import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Centered spinner for a page or panel that is still loading.
 * `fullScreen` fills the viewport (route-level loads); otherwise it fills
 * the content area it is placed in.
 */
const PageLoader = ({ label, fullScreen = false }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${
      fullScreen ? 'min-h-screen bg-slate-50/80' : 'min-h-[40vh] py-16'
    }`}
  >
    <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
    {label ? <p className="text-sm">{label}</p> : <span className="sr-only">Loading</span>}
  </div>
);

export default PageLoader;
