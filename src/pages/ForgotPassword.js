import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mail, ArrowLeft } from 'lucide-react';
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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center overflow-hidden p-6 bg-gradient-to-br from-gray-50 via-cyan-50/30 to-blue-50/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-teal-100/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
        <svg className="absolute bottom-0 left-0 w-full h-64 opacity-10" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path
            d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z"
            fill="rgba(52,211,153,0.3)"
            className="animate-wave1"
          />
        </svg>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-0 rounded-full bg-white/20 animate-bubble"
            style={{
              left: `${15 + i * 15}%`,
              width: `${8 + (i % 3) * 4}px`,
              height: `${8 + (i % 3) * 4}px`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${8 + i * 0.5}s`
            }}
          />
        ))}

        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-900/10 border border-slate-100 p-8 md:p-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-slate-900">General Assessment e-Forms</h1>
              <p className="text-sm text-slate-500">Password recovery</p>
            </div>
          </div>

          <div className="space-y-6 text-center">
            <div>
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30 flex items-center justify-center animate-scaleIn mb-6">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
              <p className="text-base text-slate-600 mb-4">
                We've sent a password reset link to <span className="font-semibold text-slate-900">{email}</span>
              </p>
              <p className="text-sm text-slate-500 mb-8">
                If you don't see the email, check your spam folder or try again.
              </p>
            </div>

            <div className="space-y-3">
              <Link to="/login" className="block w-full">
                <button className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 transition-all">
                  Back to Login
                </button>
              </Link>
              <button
                type="button"
                onClick={handleTryAgain}
                className="w-full py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                Try Another Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden p-6 bg-gradient-to-br from-gray-50 via-cyan-50/30 to-blue-50/20">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-100/40 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-teal-100/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
      <svg className="absolute bottom-0 left-0 w-full h-64 opacity-10" viewBox="0 0 1200 320" preserveAspectRatio="none">
        <path
          d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z"
          fill="rgba(52,211,153,0.3)"
          className="animate-wave1"
        />
      </svg>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute bottom-0 rounded-full bg-white/20 animate-bubble"
          style={{
            left: `${15 + i * 15}%`,
            width: `${8 + (i % 3) * 4}px`,
            height: `${8 + (i % 3) * 4}px`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${8 + i * 0.5}s`
          }}
        />
      ))}

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-gray-900/10 p-8 md:p-10 animate-fadeInUp">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-gray-900">GA e-Forms</h1>
            <p className="text-sm text-gray-500">Password recovery</p>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-[#0a2540] to-[#1a5490] text-white font-semibold rounded-lg shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </div>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-600 font-medium text-sm transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Login
          </Link>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">Remember your password? </span>
          <Link to="/login" className="text-cyan-500 hover:text-cyan-600 font-semibold transition-colors">
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;