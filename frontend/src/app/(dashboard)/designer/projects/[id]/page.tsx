'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Loader2,
  Upload,
  Paperclip,
  X,
  File,
  Download,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Project {
  id: string;
  internalName: string;
  projectType: string;
  status: string;
  teamLead?: {
    id: string;
    name: string;
    avatar?: string;
  };
  tasks?: Array<{
    assignedTo?: {
      id: string;
      name: string;
      avatar?: string;
    };
  }>;
}

interface ReferenceAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface Asset {
  id: string;
  name: string;
  assetType: string;
  description: string | null;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  referenceAttachments?: ReferenceAttachment[];
  requestedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface MentionData {
  id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  visibleToRoles?: string[];
  attachments?: Array<{
    url: string;
    fileName: string;
    mimeType?: string;
    size?: number;
  }>;
  mentions?: MentionData[];
  createdAt: string;
}

interface UploadedFile {
  url: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export default function DesignerProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Team Chat state
  const [teamChatMessage, setTeamChatMessage] = useState('');
  const [sendingTeamChatMessage, setSendingTeamChatMessage] = useState(false);
  const [teamChatAttachments, setTeamChatAttachments] = useState<UploadedFile[]>([]);
  const [uploadingTeamChatFile, setUploadingTeamChatFile] = useState(false);

  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentions, setSelectedMentions] = useState<MentionData[]>([]);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');

  // File input refs
  const teamChatFileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [uploadData, setUploadData] = useState({
    fileUrl: '',
    fileName: '',
    fileSize: 0,
  });
  const [submittingAsset, setSubmittingAsset] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const chatSocketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Connect to chat WebSocket
  useEffect(() => {
    if (!token || !projectId) return;

    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(`${backendUrl}/chat`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
    });

    socket.on('connect', () => {
      console.log('Designer: Connected to chat socket');
      socket.emit('join:project', { projectId });
    });

    socket.on('chat:message', (message: ChatMessage) => {
      console.log('Designer: Received chat message:', message);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    });

    socket.on('chat:message:updated', (updatedMessage: ChatMessage) => {
      console.log('Designer: Message updated:', updatedMessage);
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    });

    socket.on('chat:message:deleted', (data: { messageId: string }) => {
      console.log('Designer: Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Designer: Disconnected from chat socket:', reason);
    });

    chatSocketRef.current = socket;

    return () => {
      socket.emit('leave:project', { projectId });
      socket.disconnect();
      chatSocketRef.current = null;
    };
  }, [token, projectId, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchData();
  }, [projectId, token]);

  const fetchData = async () => {
    if (!token) return;

    try {
      setLoading(true);

      // Fetch project details
      const projectRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!projectRes.ok) {
        router.push('/designer');
        return;
      }

      const projectData = await projectRes.json();
      setProject(projectData);

      // Fetch assets for this project
      const assetsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(assetsData.data || []);
      }

      // Fetch chat messages
      try {
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch chat:', err);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
      router.push('/designer');
    } finally {
      setLoading(false);
    }
  };

  // Get team members for @mention (Team Lead and Developers)
  const getTeamMembersForMention = useCallback((): MentionData[] => {
    if (!project) return [];

    const members: MentionData[] = [];

    if (project.teamLead) {
      members.push({
        id: project.teamLead.id,
        name: project.teamLead.name,
        role: 'TEAM_LEAD',
      });
    }

    // Get unique developers from tasks
    if (project.tasks) {
      project.tasks.forEach((task) => {
        if (task.assignedTo && !members.some((m) => m.id === task.assignedTo?.id)) {
          members.push({
            id: task.assignedTo.id,
            name: task.assignedTo.name,
            role: 'DEVELOPER',
          });
        }
      });
    }

    return members;
  }, [project]);

  // Filter mention suggestions based on query
  const getMentionSuggestions = useCallback(() => {
    const members = getTeamMembersForMention();
    if (!mentionQuery) return members;
    return members.filter((m) =>
      m.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [getTeamMembersForMention, mentionQuery]);

  // Handle mention input change
  const handleTeamChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setTeamChatMessage(value);

    // Check for @ symbol
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setShowMentionDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        return;
      }
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Handle mention selection
  const handleMentionSelect = (member: MentionData) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = teamChatMessage.slice(0, mentionStartIndex);
    const afterMention = teamChatMessage.slice(mentionStartIndex + mentionQuery.length + 1);
    const newMessage = `${beforeMention}@${member.name} ${afterMention}`;

    setTeamChatMessage(newMessage);
    setSelectedMentions((prev) => {
      if (prev.some((m) => m.id === member.id)) return prev;
      return [...prev, member];
    });
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);

    chatInputRef.current?.focus();
  };

  // File upload handler for Team Chat
  const handleTeamChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingTeamChatFile(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/single`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const uploadedFile = await response.json();
        setTeamChatAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('File(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingTeamChatFile(false);
      if (teamChatFileInputRef.current) {
        teamChatFileInputRef.current.value = '';
      }
    }
  };

  // Paste handler for Team Chat
  const handleTeamChatPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingTeamChatFile(true);
        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/single`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) throw new Error('Upload failed');

          const uploadedFile = await response.json();
          setTeamChatAttachments((prev) => [...prev, uploadedFile]);
          toast.success('Image pasted');
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          toast.error('Failed to upload pasted image');
        } finally {
          setUploadingTeamChatFile(false);
        }
        break;
      }
    }
  };

  // Edit message handler
  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newText }),
      });

      if (response.ok) {
        const updatedMessage = await response.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m))
        );
        setEditingMessageId(null);
        setEditMessageText('');
        toast.success('Message updated');
      } else {
        toast.error('Failed to update message');
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast.error('Failed to update message');
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        toast.success('Message deleted');
      } else {
        toast.error('Failed to delete message');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  // Copy message handler
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard');
  };

  // Extract mentions from message text
  const extractMentionsFromText = (text: string): MentionData[] => {
    const members = getTeamMembersForMention();
    const mentions: MentionData[] = [];

    members.forEach((member) => {
      const mentionPattern = new RegExp(`@${member.name}\\b`, 'gi');
      if (mentionPattern.test(text)) {
        if (!mentions.some((m) => m.id === member.id)) {
          mentions.push(member);
        }
      }
    });

    return mentions;
  };

  // Send message to Team Chat
  const handleSendTeamChatMessage = async () => {
    if ((!teamChatMessage.trim() && teamChatAttachments.length === 0) || !project) return;

    setSendingTeamChatMessage(true);
    try {
      const messageMentions = extractMentionsFromText(teamChatMessage);

      // Visible to Team Lead, Developer, and Designer
      const visibleToRoles = ['TEAM_LEAD', 'DEVELOPER', 'DESIGNER'];

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: teamChatMessage || (teamChatAttachments.length > 0 ? 'Shared files' : ''),
          attachments: teamChatAttachments.map((f) => ({
            url: f.url,
            fileName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          })),
          visibleToRoles,
          mentions: messageMentions,
        }),
      });

      if (res.ok) {
        setTeamChatMessage('');
        setTeamChatAttachments([]);
        setSelectedMentions([]);
        // Refresh messages
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingTeamChatMessage(false);
    }
  };

  // Filter messages for Team Chat (Team Lead + Developer + Designer, exclude Manager)
  const teamChatMessages = messages.filter((msg) => {
    const roles = msg.visibleToRoles || [];
    const isFromManager = msg.sender?.role === 'MANAGER';
    return roles.includes('DESIGNER') && !isFromManager && !roles.includes('MANAGER');
  });

  // Get role label for display
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'TEAM_LEAD':
        return 'Team Lead';
      case 'DESIGNER':
        return 'Designer';
      case 'DEVELOPER':
        return 'Developer';
      default:
        return role;
    }
  };

  // Get role color for badge
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'TEAM_LEAD':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
      case 'DESIGNER':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300';
      case 'DEVELOPER':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  // Render message with @mentions highlighted
  const renderMessageWithMentions = (text: string, mentions?: MentionData[]) => {
    if (!mentions || mentions.length === 0) {
      return <span>{text}</span>;
    }

    const mentionNames = mentions.map((m) => m.name).join('|');
    const mentionPattern = new RegExp(`(@(?:${mentionNames}))\\b`, 'gi');
    const parts = text.split(mentionPattern);

    return (
      <>
        {parts.map((part, index) => {
          const mentionMatch = mentions.find(
            (m) => part.toLowerCase() === `@${m.name.toLowerCase()}`
          );

          if (mentionMatch) {
            return (
              <span
                key={index}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(
                  mentionMatch.role
                )}`}
              >
                {part}
              </span>
            );
          }

          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const handleStartWork = async (asset: Asset) => {
    setActionLoading(asset.id);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets/${asset.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAssets(assets.map((a) => (a.id === asset.id ? { ...a, status: 'IN_PROGRESS' } : a)));
      }
    } catch (error) {
      console.error('Failed to start work:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const openUploadDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setUploadData({ fileUrl: '', fileName: '', fileSize: 0 });
    setUploadDialogOpen(true);
  };

  const handleSubmitAsset = async () => {
    if (!selectedAsset || !uploadData.fileUrl || !uploadData.fileName) return;

    setSubmittingAsset(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets/${selectedAsset.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(uploadData),
      });

      if (res.ok) {
        setAssets(
          assets.map((a) =>
            a.id === selectedAsset.id
              ? { ...a, status: 'SUBMITTED', fileUrl: uploadData.fileUrl, fileName: uploadData.fileName }
              : a
          )
        );
        setUploadDialogOpen(false);
        setSelectedAsset(null);
      }
    } catch (error) {
      console.error('Failed to submit asset:', error);
    } finally {
      setSubmittingAsset(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isImageFile = (mimeType?: string) => mimeType?.startsWith('image/');

  const statusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return 'secondary';
      case 'IN_PROGRESS':
        return 'default';
      case 'SUBMITTED':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Get unique developers from project tasks
  const getDevelopers = () => {
    if (!project?.tasks) return [];
    const devMap = new Map<string, { id: string; name: string; avatar?: string }>();
    project.tasks.forEach((task) => {
      if (task.assignedTo && !devMap.has(task.assignedTo.id)) {
        devMap.set(task.assignedTo.id, task.assignedTo);
      }
    });
    return Array.from(devMap.values());
  };

  const developers = getDevelopers();

  const pendingAssets = assets.filter((a) => ['REQUESTED', 'IN_PROGRESS', 'REJECTED'].includes(a.status));
  const submittedAssets = assets.filter((a) => a.status === 'SUBMITTED');
  const approvedAssets = assets.filter((a) => a.status === 'APPROVED');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/designer" className="hover:underline">
            Dashboard
          </Link>
          <span>/</span>
          <span>{project.internalName}</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.internalName}</h1>
            <p className="text-muted-foreground">{project.projectType}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets" className="space-y-4 w-full overflow-hidden">
        <div className="tabs-scroll-container">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="assets" className="text-xs sm:text-sm">
              <ImageIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Assets ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm">
              <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Team Chat ({teamChatMessages.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          {/* Pending Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Assets ({pendingAssets.length})</CardTitle>
              <CardDescription>Assets that need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAssets.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No pending assets for this project</p>
              ) : (
                <div className="space-y-3">
                  {pendingAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`p-4 border rounded-lg ${asset.status === 'REJECTED' ? 'border-red-200 dark:border-red-800' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{asset.name}</h4>
                            <Badge variant="outline">{asset.assetType}</Badge>
                            <Badge variant={statusColor(asset.status)}>{asset.status.replace('_', ' ')}</Badge>
                          </div>
                          {asset.description && <p className="text-sm text-muted-foreground">{asset.description}</p>}
                          <p className="text-xs text-muted-foreground">Requested by: {asset.requestedBy.name}</p>
                          {asset.status === 'REJECTED' && (
                            <p className="text-xs text-red-600">This asset was rejected. Please review and resubmit.</p>
                          )}
                          {/* Reference Attachments */}
                          {asset.referenceAttachments && asset.referenceAttachments.length > 0 && (
                            <div className="mt-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Reference Files:</p>
                              <div className="flex flex-wrap gap-2">
                                {asset.referenceAttachments.map((att, idx) => (
                                  <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    {att.mimeType?.startsWith('image/') ? (
                                      <ImageIcon className="w-3 h-3 text-blue-500" />
                                    ) : att.mimeType === 'application/pdf' ? (
                                      <FileText className="w-3 h-3 text-red-500" />
                                    ) : (
                                      <FileText className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    <span className="truncate max-w-[100px]">{att.fileName}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {asset.status === 'REQUESTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartWork(asset)}
                              disabled={actionLoading === asset.id}
                            >
                              {actionLoading === asset.id ? 'Starting...' : 'Start Work'}
                            </Button>
                          )}
                          {(asset.status === 'IN_PROGRESS' || asset.status === 'REJECTED') && (
                            <Button size="sm" onClick={() => openUploadDialog(asset)}>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload & Submit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submitted Assets */}
          {submittedAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Submitted Assets ({submittedAssets.length})</CardTitle>
                <CardDescription>Waiting for Team Lead review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {submittedAssets.map((asset) => (
                    <div key={asset.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{asset.name}</h4>
                            <Badge variant="outline">{asset.assetType}</Badge>
                            <Badge variant="warning">Awaiting Review</Badge>
                          </div>
                          {asset.fileUrl && (
                            <a
                              href={asset.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              View: {asset.fileName}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved Assets */}
          {approvedAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approved Assets ({approvedAssets.length})</CardTitle>
                <CardDescription>Completed and approved by Team Lead</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvedAssets.map((asset) => (
                    <div key={asset.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{asset.name}</h4>
                            <Badge variant="outline">{asset.assetType}</Badge>
                            <Badge variant="success">Approved</Badge>
                          </div>
                          {asset.fileUrl && (
                            <a
                              href={asset.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              View: {asset.fileName}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team Chat Tab */}
        <TabsContent value="chat">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="flex flex-col max-h-[70vh] sm:max-h-[600px] overflow-hidden">
                <CardHeader className="flex-shrink-0 px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Team Chat</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Chat with Team Lead and Developers. Use @name to mention someone.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 sm:px-6">
                  {/* Messages area */}
                  <div className="flex-1 overflow-y-auto scrollbar-modern space-y-4 mb-4 p-3 sm:p-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-lg min-h-[250px] sm:min-h-[300px] max-h-[350px] sm:max-h-[400px]">
                    {teamChatMessages.length === 0 ? (
                      <p className="text-center text-slate-600 dark:text-slate-400 py-8 text-sm font-medium">
                        No messages yet. Start a conversation with your team!
                      </p>
                    ) : (
                      teamChatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 sm:gap-3 ${
                            msg.senderId === user?.id ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                            <AvatarImage src={msg.sender?.avatar} />
                            <AvatarFallback>
                              {msg.sender ? getInitials(msg.sender.name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="relative group">
                            <div
                              className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${
                                msg.senderId === user?.id ? 'text-right' : ''
                              }`}
                            >
                              {/* Sender info with role badge */}
                              <div className={`flex items-center gap-2 mb-1 ${msg.senderId === user?.id ? 'justify-end' : ''}`}>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                  {msg.sender?.name}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRoleBadgeColor(msg.sender?.role || '')}`}>
                                  {getRoleLabel(msg.sender?.role || '')}
                                </span>
                              </div>
                              <div
                                className={`inline-block p-2 sm:p-3 rounded-lg ${
                                  msg.senderId === user?.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600'
                                }`}
                              >
                                {editingMessageId === msg.id ? (
                                  <div className="flex gap-2 items-center">
                                    <Input
                                      value={editMessageText}
                                      onChange={(e) => setEditMessageText(e.target.value)}
                                      className="text-xs h-7"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleEditMessage(msg.id, editMessageText);
                                        } else if (e.key === 'Escape') {
                                          setEditingMessageId(null);
                                        }
                                      }}
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleEditMessage(msg.id, editMessageText)}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                  </div>
                                ) : (
                                  <p className="text-sm sm:text-base break-words">
                                    {renderMessageWithMentions(msg.message, msg.mentions)}
                                  </p>
                                )}
                                {/* Display attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.attachments.map((att, idx) => (
                                      <a
                                        key={idx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-1.5 rounded bg-background/50 hover:bg-background/80 transition-colors"
                                      >
                                        {att.mimeType?.startsWith('image/') ? (
                                          <img src={att.url} alt={att.fileName} className="w-16 h-16 object-cover rounded" />
                                        ) : (
                                          <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <span className="text-[10px] truncate max-w-[100px]">{att.fileName}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {formatDateTime(msg.createdAt)}
                              </p>
                            </div>
                            {/* Edit/Delete dropdown for own messages */}
                            {msg.senderId === user?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingMessageId(msg.id);
                                    setEditMessageText(msg.message);
                                  }}>
                                    <Pencil className="h-3 w-3 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCopyMessage(msg.message)}>
                                    <Copy className="h-3 w-3 mr-2" />
                                    Copy
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Attachment preview */}
                  {teamChatAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-lg bg-muted/30">
                      {teamChatAttachments.map((file, idx) => (
                        <div key={idx} className="relative group">
                          {file.mimeType.startsWith('image/') ? (
                            <img src={file.url} alt={file.originalName} className="w-16 h-16 object-cover rounded" />
                          ) : (
                            <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <button
                            onClick={() => setTeamChatAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className="text-[10px] truncate w-16 text-center mt-1">{file.originalName}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input area with mention dropdown */}
                  <div className="flex gap-2 flex-shrink-0 pt-2 relative">
                    <input
                      type="file"
                      ref={teamChatFileInputRef}
                      onChange={handleTeamChatFileUpload}
                      multiple
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => teamChatFileInputRef.current?.click()}
                      disabled={uploadingTeamChatFile}
                    >
                      {uploadingTeamChatFile ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="relative flex-1">
                      <Input
                        ref={chatInputRef}
                        placeholder="Type @ to mention someone..."
                        value={teamChatMessage}
                        onChange={handleTeamChatInputChange}
                        onPaste={handleTeamChatPaste}
                        onKeyDown={(e) => {
                          if (showMentionDropdown) {
                            const suggestions = getMentionSuggestions();
                            if (e.key === 'Escape') {
                              setShowMentionDropdown(false);
                            } else if (e.key === 'Enter' && suggestions.length > 0) {
                              e.preventDefault();
                              handleMentionSelect(suggestions[0]);
                            }
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendTeamChatMessage();
                          }
                        }}
                      />
                      {/* Mention dropdown */}
                      {showMentionDropdown && getMentionSuggestions().length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 overflow-hidden">
                          <div className="p-2 text-xs font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                            Mention someone
                          </div>
                          {getMentionSuggestions().map((member) => (
                            <button
                              key={member.id}
                              onClick={() => handleMentionSelect(member)}
                              className="w-full flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{member.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{getRoleLabel(member.role)}</p>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRoleBadgeColor(member.role)}`}>
                                {getRoleLabel(member.role)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button onClick={handleSendTeamChatMessage} disabled={sendingTeamChatMessage || (!teamChatMessage.trim() && teamChatAttachments.length === 0)}>
                      {sendingTeamChatMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Members Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-slate-100">Team Members</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">People in this chat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Team Lead */}
                  {project.teamLead ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-700">
                      <Avatar>
                        <AvatarImage src={project.teamLead.avatar} />
                        <AvatarFallback className="bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100">
                          {getInitials(project.teamLead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-indigo-900 dark:text-indigo-50">{project.teamLead.name}</p>
                        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Team Lead</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      No Team Lead assigned
                    </p>
                  )}

                  {/* Developers */}
                  {developers.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Developers</p>
                      {developers.map((dev) => (
                        <div key={dev.id} className="flex items-center gap-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-300 dark:border-green-700">
                          <Avatar>
                            <AvatarImage src={dev.avatar} />
                            <AvatarFallback className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100">
                              {getInitials(dev.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-green-900 dark:text-green-50">{dev.name}</p>
                            <p className="text-xs font-medium text-green-700 dark:text-green-300">Developer</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Current User (Designer) */}
                  {user && (
                    <>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">You</p>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-100 dark:bg-pink-900/40 border-2 border-pink-300 dark:border-pink-700">
                        <Avatar>
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback className="bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-100">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-pink-900 dark:text-pink-50">{user.name} (You)</p>
                          <p className="text-xs font-medium text-pink-700 dark:text-pink-300">Designer</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Mention Tip */}
              <div className="rounded-lg border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-500 p-4">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-50">
                  <strong className="text-blue-900 dark:text-white">Tip:</strong> Type @ followed by a name to mention someone. They will see a highlighted tag in the message.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>Upload the design asset for &quot;{selectedAsset?.name}&quot;</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fileUrl">File URL</Label>
              <Input
                id="fileUrl"
                value={uploadData.fileUrl}
                onChange={(e) => setUploadData({ ...uploadData, fileUrl: e.target.value })}
                placeholder="https://example.com/asset.png"
              />
              <p className="text-xs text-muted-foreground">Upload your file to a cloud storage and paste the URL here</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={uploadData.fileName}
                onChange={(e) => setUploadData({ ...uploadData, fileName: e.target.value })}
                placeholder="logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileSize">File Size (bytes)</Label>
              <Input
                id="fileSize"
                type="number"
                value={uploadData.fileSize}
                onChange={(e) => setUploadData({ ...uploadData, fileSize: parseInt(e.target.value) || 0 })}
                placeholder="1024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAsset} disabled={submittingAsset || !uploadData.fileUrl || !uploadData.fileName}>
              {submittingAsset ? 'Submitting...' : 'Submit Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
