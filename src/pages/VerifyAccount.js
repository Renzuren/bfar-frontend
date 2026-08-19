import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import AuthLayout from '@/components/AuthLayout';

const VerifyAccount = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const response = await api.get(`/auth/verify_account`, {
          params: { token }
        });
        setStatus('success');
        setMessage(response.data.message || 'Account verified successfully!');
        toast.success('Email verified! You can now login.');
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Verification failed');
        toast.error(error.response?.data?.error || 'Verification failed');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <AuthLayout
      subtitle={{
        title: 'Email Verification',
        description: 'We are verifying your account. This will only take a moment.',
      }}
    >
      <div className="flex flex-col items-center text-center">
        {status === 'verifying' && (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Verifying your account...</h2>
            <p className="text-sm text-slate-500">Please wait while we confirm your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Account Verified</h2>
            <p className="mb-8 text-sm text-slate-500">{message}</p>
            <Button
              onClick={() => navigate('/login')}
              className="h-12 w-full rounded-xl bg-cyan-600 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700"
            >
              Go to Login
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-lg shadow-rose-500/30">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Verification Failed</h2>
            <p className="mb-8 text-sm text-slate-500">{message}</p>
            <Button
              onClick={() => navigate('/')}
              className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to Home
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyAccount;
