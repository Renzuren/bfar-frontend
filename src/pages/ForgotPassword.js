import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, MailCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import AuthLayout from '../components/AuthLayout';

const ForgotPassword = () => {
  const navigate = useNavigate();
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
    <AuthLayout
      subtitle={{
        title: 'Reset your\npassword',
        description: "We'll send you a secure link to create a new password for your account.",
        features: [
          'Quick and secure recovery process',
          'Your account stays fully protected',
          'Get back to your work in minutes',
        ],
      }}
    >
      {submitted ? (
        <div className="space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <MailCheck className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Check your email</h2>
            <p className="mt-2 text-sm text-slate-500">
              We've sent a password reset link to{' '}
              <span className="font-medium text-slate-900">{email}</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Didn't see the email? Check your spam folder.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate(`/verify-reset-code?email=${encodeURIComponent(email)}`)}
              className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                Enter verification code
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
            <button
              type="button"
              onClick={handleTryAgain}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Try another email
            </button>
          </div>

          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Forgot password?</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </span>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
