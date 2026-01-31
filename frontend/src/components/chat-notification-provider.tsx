'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname } from 'next/navigation';

interface ChatMessage {
  id: string;
  message: string;
  projectId: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    role: string;
  };
  visibleToRoles?: string[];
  priority?: string;
  createdAt: string;
}

// Play notification sound for chat messages
function playChatSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pleasant chat notification tone
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  } catch (error) {
    console.log('Could not play chat sound:', error);
  }
}

export function ChatNotificationProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!token || !user) return;

    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

    const socket = io(`${backendUrl}/chat`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
    });

    socket.on('connect', () => {
      console.log('Chat notifications: Connected');
      // Join user's personal room for receiving notifications
      socket.emit('join:user', { userId: user.id });
    });

    socket.on('chat:notification', (data: { message: ChatMessage; projectName: string }) => {
      const { message, projectName } = data;

      // Don't show notification if user sent the message
      if (message.senderId === user.id) return;

      // Check if user is currently viewing this project's chat
      const isViewingProject = pathname.includes(`/projects/${message.projectId}`);
      if (isViewingProject && pathname.includes('chat')) return;

      // Check if user's role can see this message
      const visibleRoles = message.visibleToRoles || [];
      if (visibleRoles.length > 0 && !visibleRoles.includes(user.role)) return;

      // Play sound
      playChatSound();

      // Show toast notification
      const senderName = message.sender?.name || 'Someone';
      const senderRole = message.sender?.role?.replace('_', ' ') || '';
      const truncatedMessage = message.message.length > 50
        ? message.message.substring(0, 50) + '...'
        : message.message;

      const isHighPriority = message.priority === 'HIGH';

      toast(
        <div className="flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-2">
            {isHighPriority && <span className="text-green-500">⚡</span>}
            New Message from {senderName}
          </div>
          <div className="text-xs text-gray-500">
            {senderRole} • {projectName}
          </div>
          <div className="text-sm mt-1">{truncatedMessage}</div>
        </div>,
        {
          duration: 6000,
          position: 'top-right',
          style: {
            background: isHighPriority ? '#dcfce7' : '#ffffff',
            borderLeft: isHighPriority ? '4px solid #22c55e' : '4px solid #3b82f6',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        }
      );

      // Also show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`New Message from ${senderName}`, {
          body: `${projectName}: ${truncatedMessage}`,
          icon: '/favicon.ico',
          tag: `chat-${message.id}`,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Chat notifications: Disconnected -', reason);
    });

    socketRef.current = socket;

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user, pathname]);

  return <>{children}</>;
}
