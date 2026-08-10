import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '../lib/apiMiddleware';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl sm:p-10">
        {status === 'verifying' && (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Verifying your account...</h2>
            <p className="text-slate-500">Please wait while we verify your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Success!</h2>
            <p className="mb-8 text-slate-500">{message}</p>
            <Button onClick={() => navigate('/login')} className="w-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700">
              Go to Login
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-lg shadow-rose-500/30">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Verification Failed</h2>
            <p className="mb-8 text-slate-500">{message}</p>
            <Button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white hover:bg-slate-800">
              Back to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyAccount;
