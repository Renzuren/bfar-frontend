import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FileText, Mail, Key, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';

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
      const response = await api.post('/auth/verify_reset_code', {
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">General Assessment e-Forms</h1>
            <p className="text-sm text-slate-500">Enter the code from your email</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
          <p className="text-sm text-slate-600">
            Enter the code we sent to your email to continue resetting your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-12"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="code">Verification Code</Label>
            <div className="relative mt-2">
              <Key className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="pl-12"
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            Didn&apos;t receive a code?{' '}
            <Link to="/forgot-password" className="font-semibold text-cyan-600 hover:text-cyan-700">
              Request again
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 font-medium text-cyan-600 hover:text-cyan-700">
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyResetCode;
