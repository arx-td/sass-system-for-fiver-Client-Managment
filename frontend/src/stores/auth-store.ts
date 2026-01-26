import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginFormData, LoginResponse } from '@/types';
import { apiPost, apiGet, getErrorMessage } from '@/lib/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  token: string | null; // Alias for accessToken
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  login: (data: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      token: null, // Alias for accessToken (kept in sync)
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      login: async (data: LoginFormData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiPost<LoginResponse>('/auth/login', data);

          // Store token in localStorage for API interceptor
          localStorage.setItem('access_token', response.accessToken);
          // Also set cookie for middleware
          document.cookie = `access_token=${response.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}`;

          set({
            user: response.user,
            accessToken: response.accessToken,
            token: response.accessToken,
            isAuthenticated: true,
            isInitialized: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        try {
          // Call logout endpoint (optional, JWT is stateless)
          await apiPost('/auth/logout', {});
        } catch {
          // Ignore errors on logout
        } finally {
          localStorage.removeItem('access_token');
          // Clear cookie
          document.cookie = 'access_token=; path=/; max-age=0';
          set({
            user: null,
            accessToken: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      fetchUser: async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const user = await apiGet<User>('/auth/me');
          set({
            user,
            isAuthenticated: true,
            accessToken: token,
            token: token,
          });
        } catch {
          // Token is invalid or expired
          localStorage.removeItem('access_token');
          document.cookie = 'access_token=; path=/; max-age=0';
          set({
            user: null,
            accessToken: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      initialize: async () => {
        if (get().isInitialized) return;

        const token = localStorage.getItem('access_token');
        if (token) {
          try {
            const user = await apiGet<User>('/auth/me');
            set({
              user,
              isAuthenticated: true,
              accessToken: token,
              token: token,
              isInitialized: true,
            });
          } catch {
            localStorage.removeItem('access_token');
            document.cookie = 'access_token=; path=/; max-age=0';
            set({
              user: null,
              accessToken: null,
              token: null,
              isAuthenticated: false,
              isInitialized: true,
            });
          }
        } else {
          set({ isInitialized: true });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isInitialized: state.isInitialized,
      }),
    }
  )
);
