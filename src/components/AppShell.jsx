import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function PageHeader({ icon: Icon, iconColor = 'from-cyan-400 to-blue-600', title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconColor} text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, trend, trendLabel, color = 'blue', className = '' }) {
  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', accent: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', accent: 'bg-amber-500' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', accent: 'bg-violet-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', accent: 'bg-rose-500' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', accent: 'bg-cyan-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', accent: 'bg-indigo-500' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${c.accent}`} />
      <div className="pl-4">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}>
            <Icon className={`h-5 w-5 ${c.text}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${
              trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-500' : 'text-slate-400'
            }`}>
              {trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : trend < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {trendLabel && <p className="mt-0.5 text-xs text-slate-400">{trendLabel}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSection({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      {(title || subtitle) && (
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
