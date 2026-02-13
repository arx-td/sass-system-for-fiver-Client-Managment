'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Zap,
  Users,
  FolderKanban,
  Shield,
  BarChart3,
  Clock,
  CheckCircle2,
  Sparkles,
  Download
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero animations
      const heroTl = gsap.timeline();

      heroTl
        .from('.hero-badge', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: 'power3.out',
        })
        .from('.hero-title .word', {
          opacity: 0,
          y: 100,
          rotationX: -90,
          stagger: 0.1,
          duration: 0.8,
          ease: 'power4.out',
        }, '-=0.3')
        .from('.hero-subtitle', {
          opacity: 0,
          y: 30,
          duration: 0.6,
          ease: 'power3.out',
        }, '-=0.4')
        .from('.hero-buttons', {
          opacity: 0,
          y: 30,
          duration: 0.6,
          ease: 'power3.out',
        }, '-=0.3')
        .from('.hero-visual', {
          opacity: 0,
          scale: 0.8,
          duration: 1,
          ease: 'power3.out',
        }, '-=0.5');

      // Floating animation for hero visual
      gsap.to('.floating-card', {
        y: -20,
        duration: 2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.3,
      });

      // Glow pulse animation
      gsap.to('.glow-orb', {
        scale: 1.2,
        opacity: 0.6,
        duration: 2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Features section animations
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: featuresRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        y: 60,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
      });

      // Stats counter animation
      gsap.from('.stat-item', {
        scrollTrigger: {
          trigger: statsRef.current,
          start: 'top 80%',
        },
        opacity: 0,
        scale: 0.5,
        duration: 0.6,
        stagger: 0.1,
        ease: 'back.out(1.7)',
      });

      // CTA section
      gsap.from('.cta-content', {
        scrollTrigger: {
          trigger: ctaRef.current,
          start: 'top 80%',
        },
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power3.out',
      });

    });

    return () => ctx.revert();
  }, []);

  const features = [
    {
      icon: FolderKanban,
      title: 'Project Management',
      description: 'Organize and track all your Fiverr projects in one centralized dashboard.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Seamlessly assign tasks to developers, designers, and team leads.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Shield,
      title: 'Role-Based Access',
      description: 'Secure access control with 5 different user roles and permissions.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: Zap,
      title: 'Real-Time Updates',
      description: 'Instant notifications and live updates across all team members.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Track revenue, project progress, and team performance metrics.',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Clock,
      title: 'Deadline Tracking',
      description: 'Never miss a deadline with smart reminders and timeline views.',
      color: 'from-teal-500 to-cyan-500',
    },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime' },
    { value: '50+', label: 'Features' },
    { value: '24/7', label: 'Support' },
    { value: '5', label: 'User Roles' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="glow-orb absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="glow-orb absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 md:px-12 lg:px-24">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold">&lt;/&gt;</span>
          </div>
          <span className="text-xl font-bold">DEEPAXIS</span>
        </div>
        <Link
          href="/login"
          className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 hover:scale-105"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative z-10 px-6 pt-20 pb-32 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300">Streamline Your Agency Workflow</span>
              </div>

              <h1 className="hero-title text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="word inline-block">Manage</span>{' '}
                <span className="word inline-block">Projects</span>{' '}
                <span className="word inline-block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Effortlessly</span>
              </h1>

              <p className="hero-subtitle text-lg md:text-xl text-slate-400 max-w-lg">
                The complete management system built for agencies. Track projects, collaborate with your team, and deliver exceptional results.
              </p>

              <div className="hero-buttons flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all duration-300">
                  Watch Demo
                </button>
                <a
                  href="https://github.com/arx-td/sass-system-for-fiver-Client-Managment/releases/latest/download/DEEPAXIS-Setup.exe"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-400 transition-all duration-300 hover:scale-105"
                >
                  <Download className="w-5 h-5 group-hover:animate-bounce" />
                  Download App
                </a>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="hero-visual relative hidden lg:block">
              <div className="relative">
                {/* Main card */}
                <div className="floating-card relative z-20 bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Active Projects</h3>
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">12 Active</span>
                  </div>
                  <div className="space-y-4">
                    {['Website Redesign', 'Mobile App', 'E-commerce Store'].map((project, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-900/50">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${i === 0 ? 'from-blue-500 to-cyan-500' : i === 1 ? 'from-purple-500 to-pink-500' : 'from-orange-500 to-red-500'} flex items-center justify-center`}>
                          <FolderKanban className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{project}</p>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2">
                            <div className={`h-full rounded-full bg-gradient-to-r ${i === 0 ? 'from-blue-500 to-cyan-500 w-3/4' : i === 1 ? 'from-purple-500 to-pink-500 w-1/2' : 'from-orange-500 to-red-500 w-1/4'}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating notification card */}
                <div className="floating-card absolute -top-4 -right-4 z-30 bg-slate-800/90 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Task Completed</p>
                      <p className="text-xs text-slate-400">Just now</p>
                    </div>
                  </div>
                </div>

                {/* Floating stats card */}
                <div className="floating-card absolute -bottom-4 -left-4 z-30 bg-slate-800/90 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50 shadow-xl">
                  <p className="text-xs text-slate-400 mb-1">This Week</p>
                  <p className="text-2xl font-bold text-green-400">+24%</p>
                  <p className="text-xs text-slate-400">Productivity</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} className="relative z-10 py-16 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="stat-item text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-slate-400 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="relative z-10 py-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Succeed
              </span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to help agencies manage projects, collaborate with teams, and deliver outstanding results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="feature-card group p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="relative z-10 py-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto">
          <div className="cta-content relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
            <div className="relative z-10 p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Ready to Transform Your Workflow?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                Join teams who have already streamlined their project management with DEEPAXIS.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-all duration-300 hover:scale-105"
              >
                Start Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-sm font-bold">&lt;/&gt;</span>
            </div>
            <span className="font-semibold">DEEPAXIS</span>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} DEEPAXIS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
