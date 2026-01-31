'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

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

interface MessageWithProject extends ChatMessage {
  projectName: string;
}

// Play notification sound
function playMessageSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pleasant notification tone
    oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.1); // G5

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('Could not play sound:', error);
  }
}

export function MessagesWidget() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [messages, setMessages] = useState<MessageWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Get dashboard route based on user role
  const getDashboardRoute = (role: string) => {
    switch (role) {
      case 'ADMIN': return '/admin';
      case 'MANAGER': return '/manager';
      case 'TEAM_LEAD': return '/team-lead';
      case 'DEVELOPER': return '/developer';
      case 'DESIGNER': return '/designer';
      default: return '/';
    }
  };

  // Navigate to project chat
  const handleMessageClick = (msg: MessageWithProject) => {
    if (!user) return;

    const baseRoute = getDashboardRoute(user.role);

    if (user.role === 'DEVELOPER') {
      // Developers go to task page
      router.push(`${baseRoute}/tasks`);
    } else {
      // Others go to project page
      router.push(`${baseRoute}/projects/${msg.projectId}`);
    }
  };

  // Fetch recent messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!token) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/recent', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setMessages(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [token]);

  // Connect to WebSocket for real-time messages
  useEffect(() => {
    if (!token || !user) return;

    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

    const socket = io(`${backendUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Messages Widget: Connected');
      socket.emit('join:user', { userId: user.id });
    });

    socket.on('chat:notification', (data: { message: ChatMessage; projectName: string }) => {
      const { message, projectName } = data;

      // Don't show if user sent the message
      if (message.senderId === user.id) return;

      // Check role visibility
      const visibleRoles = message.visibleToRoles || [];
      if (visibleRoles.length > 0 && !visibleRoles.includes(user.role)) return;

      // Play sound if enabled
      if (soundEnabled) {
        playMessageSound();
      }

      // Add to messages list
      const newMessage: MessageWithProject = {
        ...message,
        projectName,
      };

      setMessages((prev) => {
        // Remove if already exists
        const filtered = prev.filter((m) => m.id !== message.id);
        // Add to beginning
        return [newMessage, ...filtered].slice(0, 20); // Keep max 20
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user, soundEnabled]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800',
      MANAGER: 'bg-blue-100 text-blue-800',
      TEAM_LEAD: 'bg-indigo-100 text-indigo-800',
      DEVELOPER: 'bg-green-100 text-green-800',
      DESIGNER: 'bg-pink-100 text-pink-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="h-fit max-h-[500px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Messages
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {messages.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-h-[400px] overflow-y-auto scrollbar-modern">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No recent messages</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleMessageClick(msg)}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    msg.priority === 'HIGH' ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{msg.sender?.name}</span>
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(msg.sender?.role)}`}>
                        {msg.sender?.role?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {msg.projectName}
                    </span>
                    <ExternalLink className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {msg.priority === 'HIGH' && <span className="text-green-600">⚡ </span>}
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
