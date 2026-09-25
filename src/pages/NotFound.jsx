import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';

/** Shown for any URL that matches no page (instead of a blank screen). */
const NotFound = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = user ? '/dashboard' : '/';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button onClick={() => navigate(home, { replace: true })}>
            {user ? 'Go to Dashboard' : 'Go to Home'}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
