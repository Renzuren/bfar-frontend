import React from 'react';

// Tailwind only ships classes it can see written out, so each accent is a
// complete set of literal class names.
const ACCENTS = {
  blue: { hover: 'hover:border-blue-200', icon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' },
  cyan: { hover: 'hover:border-cyan-200', icon: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100' },
  emerald: { hover: 'hover:border-emerald-200', icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' },
  violet: { hover: 'hover:border-violet-200', icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100' },
  amber: { hover: 'hover:border-amber-200', icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' },
  sky: { hover: 'hover:border-sky-200', icon: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100' },
};

/** A large icon + title + description button used in "Quick Actions" grids. */
const QuickAction = ({ icon: Icon, title, description, accent = 'blue', onClick, disabled = false }) => {
  const colors = ACCENTS[accent] || ACCENTS.blue;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${colors.hover}`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${colors.icon}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-left">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </button>
  );
};

export default QuickAction;
