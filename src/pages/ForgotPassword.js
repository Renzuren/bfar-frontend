import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mail, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/forgot_password', { email });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSubmitted(true);
      toast.success('Password reset link sent to your email');
    } catch (error) {
      const data = error.response?.data;
      const message = typeof data === 'string' ? data : data?.error || data?.message || data?.detail;
      toast.error(message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">General Assessment e-Forms</p>
              <h1 className="text-lg font-bold text-slate-900">Password recovery</h1>
            </div>
          </div>
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Login
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10 sm:px-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-blue-100/50 blur-3xl" />

          {submitted ? (
            <div className="relative space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                <MailCheck className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Check Your Email</h2>
                <p className="mt-2 text-sm text-slate-500">
                  We've sent a password reset link to{' '}
                  <span className="font-semibold text-slate-900">{email}</span>
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  If you don't see the email, check your spam folder or try again.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <Link to="/login" className="block w-full">
                  <Button className="h-12 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400">
                    Back to Login
                  </Button>
                </Link>
                <Button
                  type="button"
                  onClick={handleTryAgain}
                  variant="outline"
                  className="h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Try Another Email
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                  <Mail className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</Label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border-slate-200 bg-slate-50 pl-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Remember your password?{' '}
                <Link to="/login" className="font-semibold text-cyan-600 transition hover:text-cyan-500">
                  Login here
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
