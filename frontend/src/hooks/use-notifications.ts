'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationSettings {
  soundEnabled: boolean;
  soundUrl: string;
  soundVolume: number;
  browserNotificationsEnabled: boolean;
}

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

// Default settings if fetch fails
const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  soundUrl: '', // Empty = use built-in Web Audio chime
  soundVolume: 0.5,
  browserNotificationsEnabled: true,
};

// Global settings cache (shared across all hook instances)
let cachedSettings: NotificationSettings | null = null;
let settingsFetchPromise: Promise<NotificationSettings> | null = null;

// Fetch notification settings from API
async function fetchNotificationSettings(token: string): Promise<NotificationSettings> {
  // Return cached settings if available
  if (cachedSettings) {
    return cachedSettings;
  }

  // If already fetching, wait for that promise
  if (settingsFetchPromise) {
    return settingsFetchPromise;
  }

  settingsFetchPromise = (async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/notifications/public`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        cachedSettings = {
          soundEnabled: data.soundEnabled ?? defaultSettings.soundEnabled,
          soundUrl: data.soundUrl ?? defaultSettings.soundUrl,
          soundVolume: data.soundVolume ?? defaultSettings.soundVolume,
          browserNotificationsEnabled: data.browserNotificationsEnabled ?? defaultSettings.browserNotificationsEnabled,
        };
        return cachedSettings;
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
    }
    return defaultSettings;
  })();

  const result = await settingsFetchPromise;
  settingsFetchPromise = null;
  return result;
}

// Audio context singleton for better performance
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  } catch (error) {
    console.log('Web Audio API not supported:', error);
    return null;
  }
}

// Play a pleasant two-tone chime using Web Audio API
function playChimeSound(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Create two oscillators for a pleasant two-tone chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // First tone: E5 (659.25 Hz)
    osc1.frequency.setValueAtTime(659.25, now);
    osc1.type = 'sine';

    // Second tone: A5 (880 Hz) - starts slightly later
    osc2.frequency.setValueAtTime(880, now + 0.08);
    osc2.type = 'sine';

    // Volume envelope - start at volume, fade out smoothly
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.4);

    osc1.start(now);
    osc1.stop(now + 0.15);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  } catch (error) {
    console.log('Could not play chime sound:', error);
  }
}

// Check if a sound URL is valid and playable
async function canPlaySoundUrl(url: string): Promise<boolean> {
  if (!url || url === '/sounds/notification.mp3') {
    // Skip the default path since we know it doesn't exist
    return false;
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Play notification sound
async function playNotificationSound(settings: NotificationSettings) {
  if (!settings.soundEnabled) {
    return;
  }

  const volume = settings.soundVolume ?? 0.5;

  // If custom sound URL is provided and valid, try to play it
  if (settings.soundUrl && settings.soundUrl !== '/sounds/notification.mp3') {
    try {
      const audio = new Audio(settings.soundUrl);
      audio.volume = volume;

      await audio.play();
      return; // Success, exit
    } catch (error) {
      console.log('Custom sound failed, using built-in chime');
    }
  }

  // Use built-in Web Audio chime (always works, no file needed)
  playChimeSound(volume);
}

// Show browser notification
function showBrowserNotification(notification: Notification, settings: NotificationSettings) {
  if (!settings.browserNotificationsEnabled) {
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
    });
  }
}

// Request notification permission
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function useNotifications(): UseNotificationsResult {
  const { token } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const settingsRef = useRef<NotificationSettings>(defaultSettings);
  const isFirstLoad = useRef(true);

  // Keep ref in sync with state
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.data) {
        setNotifications(data.data);
        setUnreadCount(data.meta?.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, [token]);

  // Fetch notification settings
  useEffect(() => {
    if (!token) return;

    fetchNotificationSettings(token).then((fetchedSettings) => {
      setSettings(fetchedSettings);
    });
  }, [token]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    // Use correct backend URL (port 4000)
    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    console.log('Connecting to socket:', backendUrl);

    const newSocket = io(`${backendUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to notifications socket');
    });

    newSocket.on('notification:new', (notification: Notification) => {
      console.log('New notification received:', notification);
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Play sound and show browser notification using admin settings (from ref to avoid reconnection)
      playNotificationSound(settingsRef.current).catch(() => {
        // Silently handle any errors
      });
      showBrowserNotification(notification, settingsRef.current);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from notifications socket:', reason);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]); // Only reconnect when token changes, not settings

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    if (!token) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
