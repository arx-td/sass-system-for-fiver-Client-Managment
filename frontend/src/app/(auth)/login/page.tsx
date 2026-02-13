'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      console.log('Attempting login...');
      await login(formData);
      console.log('Login successful!');

      // Small delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get fresh user from store after login
      const state = useAuthStore.getState();
      const userRole = state.user?.role;
      console.log('User role from state:', userRole);

      // Redirect based on role
      const roleRoutes: Record<string, string> = {
        ADMIN: '/admin',
        MANAGER: '/manager',
        TEAM_LEAD: '/team-lead',
        DEVELOPER: '/developer',
        DESIGNER: '/designer',
      };

      const redirectPath = userRole ? roleRoutes[userRole] : '/';
      console.log('Redirecting to:', redirectPath);

      // Use replace to clear login from history
      window.location.replace(redirectPath);
    } catch (err) {
      // Error is handled by the store
      console.error('Login failed:', getErrorMessage(err));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <svg
              className="w-8 h-8 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">DEEPAXIS</h1>
          <p className="text-slate-400 mt-1">Management System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg border transition-colors',
                  'bg-white dark:bg-slate-900',
                  'border-slate-200 dark:border-slate-700',
                  'text-slate-900 dark:text-white',
                  'placeholder-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={cn(
                    'w-full px-4 py-2.5 pr-12 rounded-lg border transition-colors',
                    'bg-white dark:bg-slate-900',
                    'border-slate-200 dark:border-slate-700',
                    'text-slate-900 dark:text-white',
                    'placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-2.5 px-4 rounded-lg font-medium transition-all',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Internal system - Contact admin for access
          </p>

          {/* Download Desktop App */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <a
              href="https://github.com/arx-td/sass-system-for-fiver-Client-Managment/releases/latest/download/DEEPAXIS-Setup.exe"
              className={cn(
                'w-full py-2.5 px-4 rounded-lg font-medium transition-all',
                'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
                'hover:bg-slate-200 dark:hover:bg-slate-600',
                'flex items-center justify-center gap-2'
              )}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Desktop App
            </a>
          </div>
        </div>

        {/* Copyright */}
        <p className="mt-8 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} DEEPAXIS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
