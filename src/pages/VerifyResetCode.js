import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Key, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import AuthLayout from '../components/AuthLayout';

const VerifyResetCode = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !code) {
      toast.error('Please enter your email and verification code');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/verify_reset_code', {
        code: code.trim(),
        email: email.trim(),
      });

      toast.success('Code verified successfully! Set your new password now.');
      navigate(`/reset-password?token=${encodeURIComponent(code.trim())}`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Verification failed. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle={{
        title: 'Verify your\nidentity',
        description: 'Enter the verification code sent to your email to continue resetting your password.',
        features: [
          'Check your email inbox',
          'Enter the 6-digit code',
          'Create your new password',
        ],
      }}
    >
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-blue-50 p-3.5">
        <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
        <p className="text-sm text-slate-600">
          Enter the code we sent to your email to continue.
        </p>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify reset code</h2>
      <p className="mt-1.5 text-sm text-slate-500">Enter the code from your email</p>

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

        <div>
          <Label htmlFor="code" className="text-sm font-medium text-slate-700">Verification code</Label>
          <div className="relative mt-1.5">
            <Key className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="code"
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm tracking-widest text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Verifying...
            </span>
          ) : (
            'Verify code'
          )}
        </Button>
      </form>

      <div className="mt-8 space-y-3 text-center text-sm text-slate-500">
        <p>
          Didn't receive a code?{' '}
          <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-700">
            Request again
          </Link>
        </p>
        <p>
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyResetCode;
