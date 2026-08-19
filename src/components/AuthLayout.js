import React from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ children, subtitle }) => {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative z-10 max-w-lg px-8">
          <Link to="/" className="mb-8 flex items-center gap-3 transition opacity-80 hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <FileText className="h-6 w-6 text-cyan-300" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">General Assessment</span>
          </Link>

          <h2 className="mb-4 text-4xl font-bold leading-tight text-white">
            {subtitle?.title || 'Welcome to General Assessment'}
          </h2>
          <p className="mb-10 text-base text-slate-300/90">
            {subtitle?.description || 'Your modern assessment platform.'}
          </p>

          <div className="space-y-4">
            {(subtitle?.features || []).map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <span className="text-xs font-bold text-cyan-300">{i + 1}</span>
                </div>
                <span className="text-sm text-white/80">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <svg className="absolute bottom-0 left-0 h-32 w-full opacity-10" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,224 C360,180 720,280 1200,224 L1200,320 L0,320 Z" fill="rgba(34,211,238,0.4)" />
        </svg>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center p-6 sm:p-10 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Link to="/" className="flex items-center gap-3 transition opacity-80 hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">General Assessment</span>
            </Link>
          </div>

          {children}

          <Link to="/" className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400 transition hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
