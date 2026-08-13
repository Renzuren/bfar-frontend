import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, ArrowLeft, Mail, Lock, Eye, EyeOff, Zap, BarChart3, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password, rememberMe);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const perks = [
    { icon: Zap, text: 'Real-time survey analytics & insights' },
    { icon: BarChart3, text: 'Beautiful charts and data visualization' },
    { icon: ShieldCheck, text: 'Secure, role-based access control' },
  ];

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
              <h1 className="text-lg font-bold text-slate-900">Sign in</h1>
            </div>
          </div>
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex w-full justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 lg:grid-cols-2">
          {/* Left panel - Aquatic welcome */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-10 lg:flex lg:flex-col lg:justify-center">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

            <svg className="absolute bottom-0 left-0 h-40 w-full opacity-15" viewBox="0 0 1200 320" preserveAspectRatio="none">
              <path d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z" fill="rgba(52,211,153,0.2)" className="animate-wave1" />
            </svg>

            <div className="relative">
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Welcome back</p>
              <h2 className="mb-4 text-4xl font-bold leading-tight text-white">
                Sign in to your
                <br />
                assessment hub
              </h2>
              <p className="mb-10 max-w-md text-base text-slate-300">
                Access your forms, dashboards, and analytics all from one secure workspace.
              </p>
              <div className="space-y-4">
                {perks.map((perk, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/20">
                      <perk.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-white/90">{perk.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - form */}
          <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">General Assessment e-Forms</p>
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Login to Your Account</h2>
              <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to access your dashboard</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" data-testid="login-form">
                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</Label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      data-testid="login-email-input"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                    <Link to="/forgot-password" className="text-sm font-medium text-cyan-600 transition hover:text-cyan-500">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      data-testid="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-500"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                  />
                  <span className="text-sm text-slate-600">Remember me for 30 days</span>
                </label>

                <Button
                  type="submit"
                  data-testid="login-submit-button"
                  className="h-12 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Logging in...
                    </span>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-slate-500">
                Don't have an account?{' '}
                <Link to="/signup" data-testid="login-signup-link" className="font-semibold text-cyan-600 transition hover:text-cyan-500">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
