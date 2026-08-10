import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, BarChart3, Share2, Shield, ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    // Simple scroll-triggered animations
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
      description: 'Create dynamic questionnaires with multiple question types including text, multiple choice, checkboxes, and more.',
      gradient: 'from-blue-500 to-cyan-500',
      glowColor: 'cyan-400'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Get detailed insights with comprehensive analytics, charts, and data visualization for your survey responses.',
      gradient: 'from-purple-500 to-pink-500',
      glowColor: 'purple-400'
    },
    {
      icon: Share2,
      title: 'Easy Sharing',
      description: 'Share your forms instantly with unique links, embed codes, and direct integration options.',
      gradient: 'from-orange-500 to-red-500',
      glowColor: 'orange-400'
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'Government-grade security with data encryption, access controls, and compliance with Philippine data regulations.',
      gradient: 'from-green-500 to-emerald-500',
      glowColor: 'green-400'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div
        className="relative min-h-screen bg-gradient-to-br from-[#0a2540] via-[#0d3a5f] to-[#1a5490] overflow-hidden"
        ref={heroRef}
      >
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>

        {/* Animated Water Waves */}
        <svg className="absolute bottom-0 left-0 w-full h-96 opacity-20" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,160 C240,200 480,120 720,160 C960,200 1080,120 1200,160 L1200,320 L0,320 Z" fill="rgba(52,211,153,0.2)" className="animate-wave1" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-80 opacity-15" viewBox="0 0 1200 320" preserveAspectRatio="none">
          <path d="M0,192 C300,250 600,140 900,192 C1100,230 1150,170 1200,192 L1200,320 L0,320 Z" fill="rgba(96,165,250,0.25)" className="animate-wave2" />
        </svg>

        {/* Rising Bubbles */}
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
          ></div>
        ))}

        {/* Header */}
        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-cyan-400 rounded-lg flex items-center justify-center shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">General Assessment e-Forms</h1>
            </div>
            <div className="flex space-x-4">
              <button
                data-testid="nav-login-button"
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-white/90 hover:text-white transition-colors duration-200 font-medium rounded-lg"
              >
                Login
              </button>
              <button
                data-testid="nav-signup-button"
                onClick={() => navigate('/signup')}
                className="px-6 py-2 bg-cyan-400 text-[#0a2540] rounded-lg font-semibold text-base hover:bg-cyan-300 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-cyan-400/20"
              >
                Sign Up
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
              Streamline General Assessment
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Processes with a Digital eForms Platform
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto leading-relaxed">
              A centralized platform for creating forms, collecting responses, and generating real-time insights for faster and more accurate decision-making.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                data-testid="hero-get-started-button"
                onClick={() => navigate('/signup')}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-cyan-400 text-[#0a2540] rounded-xl text-lg font-semibold hover:bg-cyan-300 hover:scale-105 transition-all duration-300 shadow-xl shadow-cyan-400/20 hover:shadow-2xl hover:shadow-cyan-400/30"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <button
                data-testid="hero-learn-more-button"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl text-lg font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20 hover:border-white/30"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div
        id="features"
        className="py-20 bg-gradient-to-b from-gray-50 to-white"
        ref={featuresRef}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
              Powerful Features for Data Collection
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Everything you need to create, distribute, and analyze surveys for fisheries and aquatic resources management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-2xl p-8 transition-all duration-300 hover:-translate-y-2 hover:scale-105"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-3 group-hover:scale-110`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300`}></div>
                </div>

                <h4 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-800 transition-colors duration-200">
                  {feature.title}
                </h4>
                <p className="text-base text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-200">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call-to-Action Section */}
      <div
        className="py-20 md:py-32 bg-gradient-to-br from-[#0a2540] via-[#0d3a5f] to-[#1a5490] relative overflow-hidden"
        ref={ctaRef}
      >
        {/* Decorative Element */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[600px] bg-cyan-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Data Collection?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join thousands of assessment professionals using GA e-Forms to streamline their data collection and analysis processes.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-cyan-400 text-[#0a2540] rounded-xl text-lg font-semibold hover:bg-cyan-300 hover:scale-105 transition-all duration-300 shadow-xl shadow-cyan-400/20 hover:shadow-2xl hover:shadow-cyan-400/30"
          >
            Start Creating Forms Today
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0a2540] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Branding */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-cyan-400 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">General Assessment e-Forms</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Official digital forms platform of the Bureau of Fisheries and Aquatic Resources.
                Empowering fisheries professionals with modern data collection tools.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white/90 font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-medium"
                  >
                    Login
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/signup')}
                    className="px-4 py-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-medium"
                  >
                    Sign Up
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-4 py-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-medium"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <a
                    href="#"
                    className="px-4 py-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-medium inline-block"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white/90 font-semibold mb-4">Contact</h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/70">
                    Bureau of Fisheries and Aquatic Resources<br />
                    Quezon City, Philippines
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <a
                    href="mailto:support@gas.gov.ph"
                    className="text-sm text-white/70 hover:text-cyan-400 transition-colors duration-200"
                  >
                    support@gas.gov.ph
                  </a>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <a
                    href="tel:+632-123-4567"
                    className="text-sm text-white/70 hover:text-cyan-400 transition-colors duration-200"
                  >
                    +63 2 123 4567
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-white/10 mt-8 pt-8 text-center">
            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} Bureau of Fisheries and Aquatic Resources. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom CSS for animations and button design tokens */}
      <style jsx>{`
        /* Button Design Tokens */
        :root {
          --button-primary-bg: #34d399;
          --button-primary-hover: #6ee7b7;
          --button-primary-text: #0a2540;
          --button-secondary-bg: rgba(255, 255, 255, 0.1);
          --button-secondary-hover: rgba(255, 255, 255, 0.2);
          --button-secondary-text: #ffffff;
          --button-padding-sm: 0.5rem 1.5rem;
          --button-padding-lg: 1rem 2rem;
          --button-radius-sm: 0.75rem;
          --button-radius-lg: 1rem;
          --button-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Focus states for accessibility */
        button:focus-visible {
          outline: 2px solid #34d399;
          outline-offset: 2px;
        }

        /* Button hover and active states */
        button:active {
          transform: scale(0.95);
        }

        /* Performance optimizations for buttons */
        button {
          transform: translateZ(0);
          will-change: transform;
        }

        /* Reduced motion preferences */
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
