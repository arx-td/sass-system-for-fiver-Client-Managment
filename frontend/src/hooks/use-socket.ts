'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

type EventHandler = (data: any) => void;

interface UseSocketOptions {
  namespace?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { namespace = '', autoConnect = true } = options;
  const { token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (!token || !autoConnect) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(`${backendUrl}${namespace}`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log(`Socket connected to ${namespace || '/'}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected from ${namespace || '/'}:`, reason);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, namespace, autoConnect]);

  // Subscribe to events
  const on = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }

    return () => {
      handlersRef.current.get(event)?.delete(handler);
      socketRef.current?.off(event, handler);
    };
  }, []);

  // Emit events
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Join a room (e.g., project room)
  const joinRoom = useCallback((room: string) => {
    emit('subscribe', { projectId: room });
  }, [emit]);

  // Leave a room
  const leaveRoom = useCallback((room: string) => {
    emit('unsubscribe', { projectId: room });
  }, [emit]);

  return {
    socket: socketRef.current,
    on,
    emit,
    joinRoom,
    leaveRoom,
    isConnected: socketRef.current?.connected || false,
  };
}

// Hook specifically for project-level real-time updates
export function useProjectSocket(projectId: string | null) {
  const { on, emit, joinRoom, leaveRoom, isConnected } = useSocket({
    namespace: '/notifications',
  });

  useEffect(() => {
    if (projectId && isConnected) {
      joinRoom(projectId);
      return () => leaveRoom(projectId);
    }
  }, [projectId, isConnected, joinRoom, leaveRoom]);

  return { on, emit, isConnected };
}
