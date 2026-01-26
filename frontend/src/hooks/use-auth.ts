'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { UserRole } from '@/types';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    logout,
    fetchUser,
    initialize,
    clearError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    logout,
    fetchUser,
    initialize,
    clearError,
  };
}

export function useRequireAuth(allowedRoles?: UserRole[]) {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      // Redirect to role-specific dashboard if not allowed
      const roleRoutes: Record<string, string> = {
        ADMIN: '/admin',
        MANAGER: '/manager',
        TEAM_LEAD: '/team-lead',
        DEVELOPER: '/developer',
        DESIGNER: '/designer',
      };
      router.push(roleRoutes[user.role] || '/dashboard');
    }
  }, [isAuthenticated, isInitialized, user, allowedRoles, router]);

  return {
    user,
    isAuthenticated,
    isInitialized,
    isAllowed: !allowedRoles || (user && allowedRoles.includes(user.role)),
  };
}

export function useRedirectIfAuthenticated(redirectTo = '/dashboard') {
  const router = useRouter();
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isInitialized, router, redirectTo]);

  return { isInitialized, isAuthenticated };
}
