import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
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
      await login(formData.email, formData.password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Aquatic Welcome */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-fadeInLeft" style={{background: 'linear-gradient(135deg, #0a2540 0%, #0d3a5f 50%, #1a5490 100%)'}}>
        {/* Decorative Blurs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-400/5 rounded-full blur-3xl"></div>

        {/* Animated Water Waves */}
        <svg className="absolute bottom-0 left-0 w-full h-96 opacity-20" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z" fill="rgba(52,211,153,0.2)" className="animate-wave1" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-80 opacity-15" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,192 C300,250 600,140 900,192 C1100,230 1150,170 1200,192 L1200,320 L0,320 Z" fill="rgba(96,165,250,0.25)" className="animate-wave2" />
        </svg>

        {/* Rising Bubbles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-0 w-2 h-2 bg-white/10 rounded-full animate-bubble"
            style={{
              left: `${10 + i * 11}%`,
              width: `${8 + (i % 3) * 4}px`,
              height: `${8 + (i % 3) * 4}px`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${8 + i * 0.5}s`
            }}
          ></div>
        ))}

        {/* Content Section */}
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 max-w-xl">
          {/* Icon Badge */}
          <div className="w-20 h-20 bg-cyan-400 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-400/30 mb-6 animate-scaleIn">
            <FileText className="w-10 h-10 text-[#0a2540]" />
          </div>

          {/* Main Heading */}
          <h2 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fadeInUp" style={{animationDelay: '0.4s'}}>
            Welcome Back 
          </h2>

          {/* Gradient Text */}
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight animate-fadeInUp bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent" style={{animationDelay: '0.4s'}}>
            GA e-Forms
          </h2>

          {/* Description */}
          <p className="text-xl text-white/80 leading-relaxed mb-10 animate-fadeInUp" style={{animationDelay: '0.6s'}}>
            Streamline your data collection and assessment processes with a comprehensive digital platform.
          </p>

          {/* Feature List */}
          <div className="space-y-4 animate-fadeInUp" style={{animationDelay: '0.8s'}}>
            {[
              "Secure data collection and management",
              "Real-time survey analytics",
              "Efficient tracking of assessment responses"
            ].map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-cyan-300 flex-shrink-0" />
                <span className="text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white relative">
        {/* Decorative Blurs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-50 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl"></div>

        {/* Form Container */}
        <div className="w-full max-w-md z-10 animate-fadeInUp">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-8 group transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>

          {/* Logo Section */}
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GA e-Forms</h1>
              <p className="text-sm text-gray-500">Digital Forms Platform</p>
            </div>
          </div>

          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Login to Your Account</h2>
            <p className="text-base text-gray-600">Enter your credentials to access your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            {/* Email Input */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-2 block">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 pr-14 py-3.5 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-cyan-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-cyan-500 bg-gray-100 border-gray-300 rounded focus:ring-cyan-400 focus:ring-2"
                />
                <span className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-cyan-500 hover:text-cyan-600 transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              data-testid="login-submit-button"
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          {/* Sign Up Section */}
          <div className="mt-8 text-center">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/signup" data-testid="login-signup-link" className="font-semibold text-cyan-500 hover:text-cyan-600 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
