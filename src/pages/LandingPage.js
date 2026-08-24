import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, BarChart3, Share2, ShieldCheck, ArrowRight, Mail, MapPin, Phone, LineChart, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
        }
      });
    }, observerOptions);

    if (heroRef.current) observer.observe(heroRef.current);
    if (featuresRef.current) observer.observe(featuresRef.current);
    if (ctaRef.current) observer.observe(ctaRef.current);

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: FileText,
      title: 'Easy Form Builder',
      description: 'Create dynamic questionnaires with text, multiple choice, checkboxes, ratings, and more.',
      tint: 'from-cyan-400 to-blue-600',
      glow: 'shadow-cyan-500/30'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Get detailed insights with comprehensive charts and data visualization for every survey response.',
      tint: 'from-violet-500 to-purple-600',
      glow: 'shadow-violet-500/30'
    },
    {
      icon: Share2,
      title: 'Easy Sharing',
      description: 'Share your forms instantly with unique links, embed codes, and direct integration options.',
      tint: 'from-orange-400 to-amber-500',
      glow: 'shadow-orange-500/30'
    },
    {
      icon: ShieldCheck,
      title: 'Secure & Compliant',
      description: 'Government-grade security with data encryption, access controls, and data regulation compliance.',
      tint: 'from-emerald-400 to-teal-600',
      glow: 'shadow-emerald-500/30'
    }
  ];

  const highlights = [
    { icon: LineChart, title: 'Real-time Dashboards', description: 'Monitor response rates and trends the moment data comes in.' },
    { icon: Zap, title: 'Blazing Fast Workflows', description: 'Publish forms and share links in a single click.' },
    { icon: Lock, title: 'Bank-grade Security', description: 'Encrypted data, role-based access, and full audit trails.' },
  ];

  const stats = [
    { value: '100%', label: 'Secure Data Handling' },
    { value: '24/7', label: 'Reliable Uptime' },
    { value: 'Real-time', label: 'Analytics Insights' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900"
      >
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-10 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

        {/* Animated water waves */}
        <svg className="absolute bottom-0 left-0 h-96 w-full opacity-20" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z" fill="rgba(52,211,153,0.2)" className="animate-wave1" />
        </svg>
        <svg className="absolute bottom-0 left-0 h-80 w-full opacity-15" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,192 C300,250 600,140 900,192 C1100,230 1150,170 1200,192 L1200,320 L0,320 Z" fill="rgba(96,165,250,0.25)" className="animate-wave2" />
        </svg>

        {/* Rising bubbles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-0 w-2 h-2 bg-white/10 rounded-full animate-bubble"
            style={{
              left: `${5 + i * 8}%`,
              width: `${8 + (i % 3) * 4}px`,
              height: `${8 + (i % 3) * 4}px`,
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${8 + i * 0.5}s`
            }}
          />
        ))}

        {/* Header */}
        <nav className="relative z-10 w-full px-3 py-6 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                <FileText className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-white">General Assessment e-Forms</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                data-testid="nav-login-button"
                onClick={() => navigate('/login')}
                className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
              >
                Login
              </button>
              <button
                data-testid="nav-signup-button"
                onClick={() => navigate('/signup')}
                className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-400/30 transition hover:bg-cyan-300 hover:shadow-cyan-400/40"
              >
                Sign Up
              </button>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 w-full px-3 py-20 text-center sm:px-4 md:py-28">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-300">
            Digital Assessment Forms Platform
          </p>
          <h2 className="mx-auto mb-6 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Streamline General Assessment
            <br />
            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Processes with a Digital eForms Platform
            </span>
          </h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg text-slate-300 sm:text-xl">
            A centralized platform for creating forms, collecting responses, and generating real-time insights for faster and more accurate decision-making.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              data-testid="hero-get-started-button"
              onClick={() => navigate('/signup')}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/30 transition hover:bg-cyan-400 hover:shadow-cyan-400/40"
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              data-testid="hero-learn-more-button"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-8 py-4 text-lg font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
            >
              Learn More
            </button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" ref={featuresRef} className="bg-slate-50 py-20">
        <div className="w-full px-3 sm:px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">Features</p>
            <h3 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Powerful Features for Data Collection
            </h3>
            <p className="text-lg text-slate-500">
              Everything you need to create, distribute, and analyze assessment forms.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm transition hover:-translate-y-1.5 hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative mb-6">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.tint} text-white shadow-lg ${feature.glow} transition group-hover:scale-110 group-hover:rotate-3`}>
                    <feature.icon className="h-8 w-8" />
                  </div>
                </div>
                <h4 className="mb-3 text-xl font-semibold text-slate-900">{feature.title}</h4>
                <p className="text-base leading-relaxed text-slate-500">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Highlights */}
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {highlights.map((highlight, index) => (
              <div key={index} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
                  <highlight.icon className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-900">{highlight.title}</h5>
                  <p className="mt-1 text-sm text-slate-500">{highlight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call-to-Action Section */}
      <div ref={ctaRef} className="bg-slate-50 pb-20">
        <div className="w-full px-3 sm:px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-6 py-16 text-center shadow-2xl shadow-slate-900/20 sm:px-12 md:py-20">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative mx-auto max-w-2xl">
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to Transform Your Data Collection?
              </h2>
              <p className="mb-8 text-lg text-slate-300">
                Join assessment professionals using General Assessment e-Forms to streamline their data collection and analysis processes.
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="group inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/30 transition hover:bg-cyan-400 hover:shadow-cyan-400/40"
              >
                Start Creating Forms Today
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="w-full px-3 py-12 sm:px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Branding */}
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">General Assessment e-Forms</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                Empowering assessment professionals with modern, secure, and real-time data collection tools.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="mb-4 font-semibold text-slate-900">Quick Links</h4>
              <ul className="space-y-2.5">
                <li>
                  <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-500 transition hover:text-cyan-600">
                    Login
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/signup')} className="text-sm font-medium text-slate-500 transition hover:text-cyan-600">
                    Sign Up
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-medium text-slate-500 transition hover:text-cyan-600"
                  >
                    Features
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="mb-4 font-semibold text-slate-900">Contact</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <p className="text-sm text-slate-500">
                    General Assessment e-Forms Team
                    <br />
                    Quezon City, Philippines
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-cyan-600" />
                  <a href="mailto:support@gas.gov.ph" className="text-sm text-slate-500 transition hover:text-cyan-600">
                    support@gas.gov.ph
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-cyan-600" />
                  <a href="tel:+632-123-4567" className="text-sm text-slate-500 transition hover:text-cyan-600">
                    +63 2 123 4567
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-100 pt-8 text-center">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} General Assessment e-Forms. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom CSS for animations */}
      <style jsx>{`
        button:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 2px;
        }

        button:active {
          transform: scale(0.96);
        }

        @media (prefers-reduced-motion: reduce) {
          button {
            transition: none !important;
          }
          .group-hover\\:translate-x-1 {
            transform: none !important;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
