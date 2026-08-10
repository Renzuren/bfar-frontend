import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '../lib/apiMiddleware';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error('Invalid reset link');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await api.post(`/auth/reset_password`, {
        token,
        newPassword: password
      });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-slate-900">Invalid Reset Link</h2>
          <p className="mb-8 text-slate-500">This password reset link is invalid or expired.</p>
          <Button onClick={() => navigate('/forgot-password')} className="w-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700">
            Request New Link
          </Button>
        </div>
      </div>
    );
  }

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
            <p className="text-sm text-slate-500">Account security</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Set New Password</h2>
            <p className="text-sm text-slate-500">Enter your new password below.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-2"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
