import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  LogOut,
  Gauge,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ title = 'Admin', subtitle = 'System Administration', children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : (user?.email || 'A')[0].toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FDFF]">
      <div className="flex min-h-screen flex-col">
        {/* ===== Persistent Navbar ===== */}
        <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/20">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</p>
                <h1 className="text-lg font-bold text-slate-900">{title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-sm sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-xs font-bold text-white shadow-md">{initials}</div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">{user?.full_name || 'Admin'}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">
                <Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* ===== Page content ===== */}
        <main className="flex-1 w-full px-3 py-5 sm:px-5">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
