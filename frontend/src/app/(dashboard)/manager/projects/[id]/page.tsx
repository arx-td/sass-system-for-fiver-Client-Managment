'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Users,
  FileText,
  MessageSquare,
  RefreshCcw,
  Video,
  Calendar,
  Building2,
  Clock,
  CheckCircle,
  Loader2,
  Plus,
  Send,
  Save,
  Check,
  Paperclip,
  X,
  Download,
  Image as ImageIcon,
  File,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Lock,
  ListTodo,
  User as UserIcon,
  CheckCircle2,
  SendHorizonal,
  RotateCcw,
  Globe,
  ExternalLink,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiGet, apiPost, apiPatch, apiDelete, getErrorMessage } from '@/lib/api';
import { Project, User, Requirement, Revision, ChatMessage, PaginatedResponse } from '@/types';
import { formatDate, formatDateTime, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REQUIREMENTS_PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  REVIEW: 'bg-orange-100 text-orange-800',
  CLIENT_REVIEW: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function ManagerProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamLeads, setTeamLeads] = useState<User[]>([]);

  // Form states
  const [assignTeamLeadOpen, setAssignTeamLeadOpen] = useState(false);
  const [selectedTeamLead, setSelectedTeamLead] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Requirements form
  const [requirementContent, setRequirementContent] = useState({
    overview: '',
    pages: '',
    functional: '',
    designNotes: '',
    plugins: '',
    outOfScope: '',
  });
  const [savingRequirement, setSavingRequirement] = useState(false);

  // Edit Requirement
  const [editRequirementOpen, setEditRequirementOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [editRequirementContent, setEditRequirementContent] = useState({
    overview: '',
    pages: '',
    functional: '',
    designNotes: '',
    plugins: '',
    outOfScope: '',
  });
  const [updatingRequirement, setUpdatingRequirement] = useState(false);
  const [editRequirementAttachments, setEditRequirementAttachments] = useState<UploadedFile[]>([]);

  // Revision form
  const [createRevisionOpen, setCreateRevisionOpen] = useState(false);
  const [revisionDescription, setRevisionDescription] = useState('');
  const [revisionIsPaid, setRevisionIsPaid] = useState(false);
  const [creatingRevision, setCreatingRevision] = useState(false);
  const [revisionAttachments, setRevisionAttachments] = useState<UploadedFile[]>([]);

  // Admin Chat (private with Admin)
  const [adminChatMessage, setAdminChatMessage] = useState('');
  const [sendingAdminMessage, setSendingAdminMessage] = useState(false);

  // Team Lead Chat (private with Team Lead only)
  const [teamLeadChatMessage, setTeamLeadChatMessage] = useState('');
  const [sendingTeamLeadMessage, setSendingTeamLeadMessage] = useState(false);

  // Team Chat (with Team Lead, Developers, Designer)
  const [teamChatMessage, setTeamChatMessage] = useState('');
  const [sendingTeamMessage, setSendingTeamMessage] = useState(false);

  // Legacy state for compatibility
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // File uploads
  interface UploadedFile {
    url: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
  }
  const [requirementAttachments, setRequirementAttachments] = useState<UploadedFile[]>([]);
  const [chatAttachments, setChatAttachments] = useState<UploadedFile[]>([]);
  const [adminChatAttachments, setAdminChatAttachments] = useState<UploadedFile[]>([]);
  const [teamLeadChatAttachments, setTeamLeadChatAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [markingClientChanges, setMarkingClientChanges] = useState(false);
  const { token } = useAuthStore();
  const chatSocketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

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
      console.log('Manager: Connected to chat socket');
      // Join project room
      socket.emit('join:project', { projectId });
    });

    socket.on('chat:message', (message: ChatMessage) => {
      console.log('Manager: Received chat message:', message);
      // Add message to state if not already present (avoid duplicates)
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    });

    socket.on('chat:message:updated', (updatedMessage: ChatMessage) => {
      console.log('Manager: Message updated:', updatedMessage);
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    });

    socket.on('chat:message:deleted', ({ messageId }: { messageId: string }) => {
      console.log('Manager: Message deleted:', messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Manager: Disconnected from chat socket:', reason);
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
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, teamLeadsData] = await Promise.all([
        apiGet<Project>(`/projects/${projectId}`),
        apiGet<PaginatedResponse<User>>('/users?role=TEAM_LEAD&status=ACTIVE&limit=100'),
      ]);

      setProject(projectData);
      setTeamLeads(teamLeadsData.data || []);

      // Fetch related data
      try {
        const [reqData, revData, msgData] = await Promise.all([
          apiGet<Requirement[]>(`/projects/${projectId}/requirements`).catch(() => []),
          apiGet<Revision[]>(`/projects/${projectId}/revisions`).catch(() => []),
          apiGet<PaginatedResponse<ChatMessage>>(`/projects/${projectId}/chat`).catch(() => ({ data: [] })),
        ]);
        setRequirements(reqData || []);
        setRevisions(revData || []);
        setMessages((msgData as PaginatedResponse<ChatMessage>).data || []);
      } catch (err) {
        console.error('Error fetching related data:', err);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      router.push('/manager');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeamLead = async () => {
    if (!selectedTeamLead) {
      toast.error('Please select a Team Lead');
      return;
    }

    try {
      setAssigning(true);
      await apiPost(`/projects/${projectId}/assign-team-lead`, {
        teamLeadId: selectedTeamLead,
      });
      toast.success('Team Lead assigned successfully');
      setAssignTeamLeadOpen(false);
      fetchProjectData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAssigning(false);
    }
  };

  const handleFileUpload = async (
    files: FileList | null,
    setAttachments: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/multiple`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const uploadedFiles: UploadedFile[] = await response.json();
      setAttachments((prev) => [...prev, ...uploadedFiles]);
      toast.success(`${uploadedFiles.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (
    index: number,
    setAttachments: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (mimeType: string) => mimeType?.startsWith('image/');

  // Task helper functions
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'SUBMITTED': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const calculateTaskProgress = () => {
    if (!project || !project.tasks || project.tasks.length === 0) return 0;
    const completedTasks = project.tasks.filter((t: any) => t.status === 'APPROVED').length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  };

  const getTaskStats = () => {
    if (!project || !project.tasks) return { total: 0, completed: 0, inProgress: 0, pending: 0, submitted: 0, rejected: 0 };
    const tasks = project.tasks;
    return {
      total: tasks.length,
      completed: tasks.filter((t: any) => t.status === 'APPROVED').length,
      inProgress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
      pending: tasks.filter((t: any) => t.status === 'ASSIGNED').length,
      submitted: tasks.filter((t: any) => t.status === 'SUBMITTED').length,
      rejected: tasks.filter((t: any) => t.status === 'REJECTED').length,
    };
  };

  const taskProgress = calculateTaskProgress();
  const taskStats = getTaskStats();

  // Paste handler for images
  const handlePaste = async (
    e: React.ClipboardEvent,
    setAttachments: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileList = new DataTransfer();
          fileList.items.add(file);
          await handleFileUpload(fileList.files, setAttachments);
        }
        break;
      }
    }
  };

  // Edit message
  const handleEditMessage = async (messageId: string) => {
    if (!editingText.trim()) return;

    try {
      await apiPatch(`/projects/${projectId}/chat/${messageId}`, {
        message: editingText,
      });
      setEditingMessageId(null);
      setEditingText('');
      toast.success('Message updated');
    } catch (error) {
      toast.error('Failed to update message');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await apiDelete(`/projects/${projectId}/chat/${messageId}`);
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  // Copy message
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied');
  };

  const handleCreateRequirement = async () => {
    if (!requirementContent.overview.trim()) {
      toast.error('Overview is required');
      return;
    }

    try {
      setSavingRequirement(true);
      await apiPost(`/projects/${projectId}/requirements`, {
        content: {
          overview: requirementContent.overview,
          pages: requirementContent.pages.split('\n').filter(Boolean),
          functional: requirementContent.functional.split('\n').filter(Boolean),
          designNotes: requirementContent.designNotes,
          plugins: requirementContent.plugins.split('\n').filter(Boolean),
          outOfScope: requirementContent.outOfScope.split('\n').filter(Boolean),
        },
        attachments: requirementAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
      });
      toast.success('Requirement created successfully');
      setRequirementAttachments([]);
      fetchProjectData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingRequirement(false);
    }
  };

  const handleApproveRequirement = async (version: number) => {
    try {
      await apiPost(`/projects/${projectId}/requirements/${version}/approve`);
      toast.success('Requirement approved');
      fetchProjectData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openEditRequirement = (req: Requirement) => {
    const content = req.content as any;
    setEditingRequirement(req);
    setEditRequirementContent({
      overview: content?.overview || '',
      pages: Array.isArray(content?.pages) ? content.pages.join('\n') : '',
      functional: Array.isArray(content?.functional) ? content.functional.join('\n') : '',
      designNotes: content?.designNotes || '',
      plugins: Array.isArray(content?.plugins) ? content.plugins.join('\n') : '',
      outOfScope: Array.isArray(content?.outOfScope) ? content.outOfScope.join('\n') : '',
    });
    // Load existing attachments
    const existingAttachments = Array.isArray(req.attachments)
      ? (req.attachments as any[]).map((att: any) => ({
          url: att.url,
          fileName: att.fileName || att.originalName || 'File',
          originalName: att.fileName || att.originalName || 'File',
          mimeType: att.mimeType || 'application/octet-stream',
          size: att.size || 0,
        }))
      : [];
    setEditRequirementAttachments(existingAttachments);
    setEditRequirementOpen(true);
  };

  const handleUpdateRequirement = async () => {
    if (!editingRequirement) return;

    if (!editRequirementContent.overview.trim()) {
      toast.error('Overview is required');
      return;
    }

    try {
      setUpdatingRequirement(true);
      await apiPatch(`/projects/${projectId}/requirements/${editingRequirement.version}`, {
        content: {
          overview: editRequirementContent.overview.trim(),
          pages: editRequirementContent.pages
            .split('\n')
            .map((p) => p.trim())
            .filter(Boolean),
          functional: editRequirementContent.functional
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean),
          designNotes: editRequirementContent.designNotes.trim(),
          plugins: editRequirementContent.plugins
            .split('\n')
            .map((p) => p.trim())
            .filter(Boolean),
          outOfScope: editRequirementContent.outOfScope
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean),
        },
        attachments: editRequirementAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
      });
      toast.success('Requirement updated successfully');
      setEditRequirementOpen(false);
      setEditingRequirement(null);
      setEditRequirementAttachments([]);
      fetchProjectData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatingRequirement(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!revisionDescription.trim()) {
      toast.error('Description is required');
      return;
    }

    try {
      setCreatingRevision(true);
      await apiPost(`/projects/${projectId}/revisions`, {
        description: revisionDescription,
        isPaid: revisionIsPaid,
        attachments: revisionAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
      });
      toast.success('Revision created successfully');
      setCreateRevisionOpen(false);
      setRevisionDescription('');
      setRevisionIsPaid(false);
      setRevisionAttachments([]);
      fetchProjectData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreatingRevision(false);
    }
  };

  // Send message to Admin only (private chat)
  const handleSendAdminMessage = async () => {
    if (!adminChatMessage.trim() && adminChatAttachments.length === 0) return;

    try {
      setSendingAdminMessage(true);
      await apiPost(`/projects/${projectId}/chat`, {
        message: adminChatMessage || (adminChatAttachments.length > 0 ? 'Shared files' : ''),
        attachments: adminChatAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
        visibleToRoles: ['ADMIN', 'MANAGER'],
      });
      setAdminChatMessage('');
      setAdminChatAttachments([]);
      // Refresh messages
      const msgData = await apiGet<PaginatedResponse<ChatMessage>>(
        `/projects/${projectId}/chat`
      );
      setMessages(msgData.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSendingAdminMessage(false);
    }
  };

  // Send message to Team Lead only (private chat)
  const handleSendTeamLeadMessage = async () => {
    if (!teamLeadChatMessage.trim() && teamLeadChatAttachments.length === 0) return;

    try {
      setSendingTeamLeadMessage(true);
      await apiPost(`/projects/${projectId}/chat`, {
        message: teamLeadChatMessage || (teamLeadChatAttachments.length > 0 ? 'Shared files' : ''),
        attachments: teamLeadChatAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
        visibleToRoles: ['MANAGER', 'TEAM_LEAD'],
      });
      setTeamLeadChatMessage('');
      setTeamLeadChatAttachments([]);
      // Refresh messages
      const msgData = await apiGet<PaginatedResponse<ChatMessage>>(
        `/projects/${projectId}/chat`
      );
      setMessages(msgData.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSendingTeamLeadMessage(false);
    }
  };

  // Send message to Team Lead and team (everyone)
  const handleSendTeamMessage = async () => {
    if (!teamChatMessage.trim() && chatAttachments.length === 0) return;

    try {
      setSendingTeamMessage(true);
      await apiPost(`/projects/${projectId}/chat`, {
        message: teamChatMessage || (chatAttachments.length > 0 ? 'Shared files' : ''),
        attachments: chatAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
        visibleToRoles: ['MANAGER', 'TEAM_LEAD', 'DEVELOPER', 'DESIGNER'],
      });
      setTeamChatMessage('');
      setChatAttachments([]);
      // Refresh messages
      const msgData = await apiGet<PaginatedResponse<ChatMessage>>(
        `/projects/${projectId}/chat`
      );
      setMessages(msgData.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSendingTeamMessage(false);
    }
  };

  // Filter messages for Admin chat (only ADMIN, MANAGER visibility)
  const adminChatMessages = messages.filter((msg: any) => {
    const roles = msg.visibleToRoles || [];
    return roles.length === 2 &&
           roles.includes('ADMIN') &&
           roles.includes('MANAGER') &&
           !roles.includes('TEAM_LEAD');
  });

  // Filter messages for Team Lead chat (private: only MANAGER, TEAM_LEAD)
  const teamLeadChatMessages = messages.filter((msg: any) => {
    const roles = msg.visibleToRoles || [];
    return roles.length === 2 &&
           roles.includes('MANAGER') &&
           roles.includes('TEAM_LEAD') &&
           !roles.includes('DEVELOPER') &&
           !roles.includes('DESIGNER');
  });

  // Filter messages for Team chat (includes DEVELOPER or DESIGNER - public team chat)
  const teamChatMessages = messages.filter((msg: any) => {
    const roles = msg.visibleToRoles || [];
    return roles.includes('DEVELOPER') || roles.includes('DESIGNER');
  });

  // Legacy function for compatibility
  const handleSendMessage = async () => {
    if (!chatMessage.trim() && chatAttachments.length === 0) return;

    try {
      setSendingMessage(true);
      await apiPost(`/projects/${projectId}/chat`, {
        message: chatMessage || (chatAttachments.length > 0 ? 'Shared files' : ''),
        attachments: chatAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
        visibleToRoles: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'DEVELOPER', 'DESIGNER'],
      });
      setChatMessage('');
      setChatAttachments([]);
      // Refresh messages
      const msgData = await apiGet<PaginatedResponse<ChatMessage>>(
        `/projects/${projectId}/chat`
      );
      setMessages(msgData.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const canMarkCompleted = project.status === 'REVIEW';

  const handleMarkAsCompleted = async () => {
    if (!canMarkCompleted) return;

    setMarkingCompleted(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/mark-completed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        toast.success('Project marked as completed!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to mark as completed');
      }
    } catch (error) {
      console.error('Failed to mark as completed:', error);
      toast.error('Failed to mark as completed');
    } finally {
      setMarkingCompleted(false);
    }
  };

  const canSendToClient = project.status === 'REVIEW';
  const canMarkClientChanges = project.status === 'CLIENT_REVIEW';

  const handleSendToClient = async () => {
    if (!canSendToClient) return;

    setSendingToClient(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/send-to-client`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        toast.success('Project sent to client for review!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to send to client');
      }
    } catch (error) {
      console.error('Failed to send to client:', error);
      toast.error('Failed to send to client');
    } finally {
      setSendingToClient(false);
    }
  };

  const handleClientRequestsChanges = async () => {
    if (!canMarkClientChanges) return;

    setMarkingClientChanges(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/client-requests-changes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        toast.success('Project marked for revision - Create a revision for Team Lead');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setMarkingClientChanges(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.internalName}</h1>
            <Badge className={statusColors[project.status]}>
              {project.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-muted-foreground">{project.projectType}</p>
        </div>
        {project.meetingLink && (
          <Button asChild variant="outline">
            <a href={project.meetingLink} target="_blank" rel="noopener noreferrer">
              <Video className="mr-2 h-4 w-4" />
              Meeting
            </a>
          </Button>
        )}
        {/* Send to Client - when in REVIEW */}
        {canSendToClient && (
          <Button
            onClick={handleSendToClient}
            disabled={sendingToClient}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sendingToClient ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendHorizonal className="h-4 w-4 mr-2" />
                Send to Client
              </>
            )}
          </Button>
        )}
        {/* Client Requests Changes - when in CLIENT_REVIEW */}
        {canMarkClientChanges && (
          <>
            <Button
              onClick={handleClientRequestsChanges}
              disabled={markingClientChanges}
              variant="outline"
              className="border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              {markingClientChanges ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Client Wants Changes
                </>
              )}
            </Button>
            <Button
              onClick={handleMarkAsCompleted}
              disabled={markingCompleted}
              className="bg-green-600 hover:bg-green-700"
            >
              {markingCompleted ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Client Approved
                </>
              )}
            </Button>
          </>
        )}
        {/* Status badges */}
        {project.status === 'CLIENT_REVIEW' && (
          <Badge className="bg-purple-100 text-purple-800 text-sm py-2 px-4">
            Awaiting Client Feedback
          </Badge>
        )}
        {project.status === 'COMPLETED' && (
          <Badge className="bg-green-100 text-green-800 text-sm py-2 px-4">
            Project Completed
          </Badge>
        )}
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Fiverr Account</p>
                <p className="font-medium">
                  {project.fiverrAccount?.accountName || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Team Lead</p>
                <p className="font-medium">
                  {project.teamLead?.name || 'Not Assigned'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Internal Deadline</p>
                <p className="font-medium">
                  {project.internalDeadline
                    ? formatDate(project.internalDeadline)
                    : 'Not Set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Fiverr Deadline</p>
                <p className="font-medium">
                  {project.fiverrDeadline
                    ? formatDate(project.fiverrDeadline)
                    : 'Not Set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staging/Development Info */}
      {(project.stagingLink || project.stagingPassword || project.clientEmail || project.clientUsername) && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="py-4 space-y-3">
            {/* Staging Link Row */}
            {(project.stagingLink || project.stagingPassword) && (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Staging Site:</span>
                </div>
                {project.stagingLink ? (
                  <a
                    href={project.stagingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {project.stagingLink}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
                {project.stagingPassword && (
                  <div className="flex items-center gap-2 ml-4">
                    <Key className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Password:</span>
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                      {project.stagingPassword}
                    </code>
                  </div>
                )}
              </div>
            )}
            {/* Client Info Row */}
            {(project.clientEmail || project.clientUsername) && (
              <div className="flex items-center gap-4 flex-wrap">
                {project.clientEmail && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Client Email:</span>
                    <a href={`mailto:${project.clientEmail}`} className="text-blue-600 hover:underline">
                      {project.clientEmail}
                    </a>
                  </div>
                )}
                {project.clientUsername && (
                  <div className="flex items-center gap-2 ml-4">
                    <UserIcon className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Client Username:</span>
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                      {project.clientUsername}
                    </code>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Returned with Changes - Shows when project is COMPLETED */}
      {project.status === 'COMPLETED' && (
        <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                    Project Completed Successfully! 🎉
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    If the client returns with additional changes or new requirements, you can easily reopen this project by creating a new revision.
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <RefreshCcw className="h-3 w-3" />
                    Creating a revision will automatically change status to &quot;Client Review&quot;
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setCreateRevisionOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Client Returned? Add Revision
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="requirements" className="space-y-4 w-full overflow-hidden">
        <div className="tabs-scroll-container">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="requirements" className="text-xs sm:text-sm">
              <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Requirements</span>
              <span className="sm:hidden">Reqs</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs sm:text-sm">
              <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">
              <ListTodo className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Tasks</span>
              <span className="sm:hidden">Tasks</span>
              <span className="ml-1">({taskStats.total})</span>
            </TabsTrigger>
            <TabsTrigger value="revisions" className="text-xs sm:text-sm">
              <RefreshCcw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Revisions</span>
              <span className="sm:hidden">Rev</span>
            </TabsTrigger>
            <TabsTrigger value="admin-chat" className="text-xs sm:text-sm">
              <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Admin ({adminChatMessages.length})
            </TabsTrigger>
            <TabsTrigger value="teamlead-chat" className="text-xs sm:text-sm">
              <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Team Lead</span>
              <span className="sm:hidden">TL</span>
              <span className="ml-1">({teamLeadChatMessages.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Requirements Tab */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Requirements</CardTitle>
                  <CardDescription>
                    Create and manage requirements for the project
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {requirements.length > 0 ? (
                <div className="space-y-4">
                  {requirements.map((req) => (
                    <Card key={req.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Version {req.version}
                            </CardTitle>
                            <CardDescription>
                              Created by {req.createdBy?.name} on{' '}
                              {formatDateTime(req.createdAt)}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                req.status === 'APPROVED' ? 'default' : 'secondary'
                              }
                            >
                              {req.status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditRequirement(req)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            {req.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                onClick={() => handleApproveRequirement(req.version)}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Overview</h4>
                            <p className="text-muted-foreground">
                              {(req.content as any)?.overview || 'N/A'}
                            </p>
                          </div>
                          {(req.content as any)?.pages?.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Pages/Sections</h4>
                              <ul className="list-disc list-inside text-muted-foreground">
                                {(req.content as any).pages.map(
                                  (page: string, i: number) => (
                                    <li key={i}>{page}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    No requirements created yet. Create a new requirement below.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label>Overview *</Label>
                      <Textarea
                        placeholder="Project overview and goals..."
                        value={requirementContent.overview}
                        onChange={(e) =>
                          setRequirementContent({
                            ...requirementContent,
                            overview: e.target.value,
                          })
                        }
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Pages/Sections (one per line)</Label>
                      <Textarea
                        placeholder="Home&#10;About&#10;Services&#10;Contact"
                        value={requirementContent.pages}
                        onChange={(e) =>
                          setRequirementContent({
                            ...requirementContent,
                            pages: e.target.value,
                          })
                        }
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Functional Requirements (one per line)</Label>
                      <Textarea
                        placeholder="Contact form&#10;Newsletter signup&#10;Blog with comments"
                        value={requirementContent.functional}
                        onChange={(e) =>
                          setRequirementContent({
                            ...requirementContent,
                            functional: e.target.value,
                          })
                        }
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Design Notes</Label>
                      <Textarea
                        placeholder="Color scheme, typography, style references..."
                        value={requirementContent.designNotes}
                        onChange={(e) =>
                          setRequirementContent({
                            ...requirementContent,
                            designNotes: e.target.value,
                          })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Plugins/Integrations (one per line)</Label>
                        <Textarea
                          placeholder="WooCommerce&#10;Yoast SEO&#10;Contact Form 7"
                          value={requirementContent.plugins}
                          onChange={(e) =>
                            setRequirementContent({
                              ...requirementContent,
                              plugins: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Out of Scope (one per line)</Label>
                        <Textarea
                          placeholder="Content creation&#10;Logo design&#10;Hosting setup"
                          value={requirementContent.outOfScope}
                          onChange={(e) =>
                            setRequirementContent({
                              ...requirementContent,
                              outOfScope: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* File Attachments */}
                    <div className="space-y-3">
                      <Label>Attachments (Images, PDFs, Documents)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                          onChange={(e) => handleFileUpload(e.target.files, setRequirementAttachments)}
                          className="hidden"
                          id="requirement-files"
                          disabled={uploading}
                        />
                        <label
                          htmlFor="requirement-files"
                          className="inline-flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Paperclip className="mr-2 h-4 w-4" />
                          )}
                          {uploading ? 'Uploading...' : 'Add Files'}
                        </label>
                        <span className="text-sm text-muted-foreground">
                          Max 50MB per file
                        </span>
                      </div>

                      {/* Uploaded Files Preview */}
                      {requirementAttachments.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {requirementAttachments.map((file, index) => (
                            <div
                              key={index}
                              className="relative p-3 border rounded-lg bg-muted/30"
                            >
                              <button
                                type="button"
                                onClick={() => removeAttachment(index, setRequirementAttachments)}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div className="flex items-center gap-2">
                                {isImageFile(file.mimeType) ? (
                                  <img
                                    src={file.url}
                                    alt={file.originalName}
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                ) : (
                                  <File className="h-10 w-10 text-muted-foreground" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {file.originalName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleCreateRequirement}
                      disabled={savingRequirement}
                    >
                      {savingRequirement && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Save className="mr-2 h-4 w-4" />
                      Save Requirement
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Assignment</CardTitle>
              <CardDescription>
                Assign a Team Lead to manage this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={project.teamLead?.avatar} />
                      <AvatarFallback>
                        {project.teamLead
                          ? getInitials(project.teamLead.name)
                          : 'TL'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Team Lead</p>
                      <p className="text-sm text-muted-foreground">
                        {project.teamLead?.name || 'Not Assigned'}
                      </p>
                    </div>
                  </div>
                  <Dialog
                    open={assignTeamLeadOpen}
                    onOpenChange={setAssignTeamLeadOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        {project.teamLead ? 'Change' : 'Assign'} Team Lead
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Team Lead</DialogTitle>
                        <DialogDescription>
                          Select a Team Lead to manage this project
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Select
                          value={selectedTeamLead}
                          onValueChange={setSelectedTeamLead}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Team Lead" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamLeads.map((tl) => (
                              <SelectItem key={tl.id} value={tl.id}>
                                {tl.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setAssignTeamLeadOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAssignTeamLead}
                          disabled={assigning}
                        >
                          {assigning && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Assign
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {project.designer && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={project.designer.avatar} />
                        <AvatarFallback>
                          {getInitials(project.designer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Designer</p>
                        <p className="text-sm text-muted-foreground">
                          {project.designer.name}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Attached by Admin</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <div className="space-y-6">
            {/* Task Progress Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Task Progress</h3>
                    <p className="text-sm text-muted-foreground">
                      {taskStats.completed} of {taskStats.total} tasks completed
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary">{taskProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{taskStats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{taskStats.submitted}</p>
                    <p className="text-xs text-muted-foreground">Under Review</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{taskStats.rejected}</p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tasks List */}
            <Card>
              <CardHeader>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>
                  Tasks assigned by the Team Lead to developers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!project?.tasks || project.tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No tasks have been created yet</p>
                    <p className="text-sm mt-1">The Team Lead will create tasks after requirements are approved</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.tasks.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${
                            task.status === 'APPROVED' ? 'bg-green-500' :
                            task.status === 'SUBMITTED' ? 'bg-amber-500' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                            task.status === 'REJECTED' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`} />
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {task.assignedTo && (
                                <span className="flex items-center gap-1">
                                  <UserIcon className="h-3 w-3" />
                                  {task.assignedTo.name}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                              {task.priority > 7 && (
                                <Badge variant="destructive" className="text-xs">High Priority</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant={getTaskStatusColor(task.status) as any}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Developers Summary */}
            {project?.tasks && project.tasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Developer Progress</CardTitle>
                  <CardDescription>
                    Task completion by developer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from(new Set((project.tasks || []).filter((t: any) => t.assignedTo).map((t: any) => JSON.stringify(t.assignedTo)))).map((devStr: any, idx: number) => {
                      const dev = JSON.parse(devStr);
                      const devTasks = (project.tasks || []).filter((t: any) => t.assignedTo?.id === dev.id);
                      const completedTasks = devTasks.filter((t: any) => t.status === 'APPROVED').length;
                      const devProgress = devTasks.length > 0 ? Math.round((completedTasks / devTasks.length) * 100) : 0;
                      return (
                        <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                          <Avatar>
                            <AvatarFallback>{getInitials(dev.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{dev.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {completedTasks} of {devTasks.length} tasks completed
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{devProgress}%</p>
                            <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${devProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Revisions Tab */}
        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revisions</CardTitle>
                  <CardDescription>
                    Create and track revision requests
                  </CardDescription>
                </div>
                <Dialog
                  open={createRevisionOpen}
                  onOpenChange={setCreateRevisionOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Revision
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Revision Request</DialogTitle>
                      <DialogDescription>
                        Describe the changes needed and attach reference files for the team
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Description *</Label>
                        <Textarea
                          placeholder="Describe the changes needed..."
                          value={revisionDescription}
                          onChange={(e) => setRevisionDescription(e.target.value)}
                          rows={4}
                        />
                      </div>

                      {/* File Attachments */}
                      <div className="space-y-3">
                        <Label>Attachments (Images, PDFs, Screenshots)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                            onChange={(e) => handleFileUpload(e.target.files, setRevisionAttachments)}
                            className="hidden"
                            id="revision-files"
                            disabled={uploading}
                          />
                          <label
                            htmlFor="revision-files"
                            className="inline-flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            {uploading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Paperclip className="mr-2 h-4 w-4" />
                            )}
                            {uploading ? 'Uploading...' : 'Add Files'}
                          </label>
                          <span className="text-sm text-muted-foreground">
                            Screenshots, PDFs, reference images
                          </span>
                        </div>

                        {/* Uploaded Files Preview */}
                        {revisionAttachments.length > 0 && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            {revisionAttachments.map((file, index) => (
                              <div
                                key={index}
                                className="relative p-3 border rounded-lg bg-muted/30 group"
                              >
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(index, setRevisionAttachments)}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                <div className="flex items-center gap-3">
                                  {isImageFile(file.mimeType) ? (
                                    <img
                                      src={file.url}
                                      alt={file.originalName}
                                      className="w-14 h-14 object-cover rounded cursor-pointer hover:opacity-80"
                                      onClick={() => window.open(file.url, '_blank')}
                                    />
                                  ) : (
                                    <div className="w-14 h-14 flex items-center justify-center bg-muted rounded">
                                      <File className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {file.originalName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isPaid"
                          checked={revisionIsPaid}
                          onChange={(e) => setRevisionIsPaid(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="isPaid">This is a paid revision</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateRevisionOpen(false);
                          setRevisionAttachments([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateRevision}
                        disabled={creatingRevision || uploading}
                      >
                        {creatingRevision && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Create Revision
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No revisions yet. Create one when changes are needed.
                </p>
              ) : (
                <div className="space-y-4">
                  {revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              revision.status === 'COMPLETED'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {revision.status}
                          </Badge>
                          {revision.isPaid && (
                            <Badge variant="outline">Paid</Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(revision.createdAt)}
                        </span>
                      </div>
                      <p>{revision.description}</p>

                      {/* Display Attachments */}
                      {revision.attachments && Array.isArray(revision.attachments) && (revision.attachments as any[]).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Attachments:</p>
                          <div className="flex flex-wrap gap-2">
                            {(revision.attachments as any[]).map((att: any, idx: number) => (
                              <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                {att.mimeType?.startsWith('image/') ? (
                                  <img
                                    src={att.url}
                                    alt={att.fileName}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                                    <File className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="max-w-[120px]">
                                  <p className="text-xs font-medium truncate">{att.fileName}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Download className="h-3 w-3" />
                                    Download
                                  </p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground">
                        Created by {revision.createdBy?.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Chat Tab (Private with Admin) */}
        <TabsContent value="admin-chat">
          <Card className="flex flex-col max-h-[70vh] sm:max-h-[600px] overflow-hidden">
            <CardHeader className="flex-shrink-0 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Chat with Admin</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Private conversation with Admin only
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 sm:px-6">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto scrollbar-modern space-y-4 mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg min-h-[250px] sm:min-h-[300px] max-h-[350px] sm:max-h-[400px]">
                {adminChatMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No messages yet. Start a private conversation with Admin!
                  </p>
                ) : (
                  adminChatMessages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`group flex gap-2 sm:gap-3 ${
                        msg.senderId === user?.id ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                        <AvatarImage src={msg.sender?.avatar} />
                        <AvatarFallback>
                          {msg.sender ? getInitials(msg.sender.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${
                          msg.senderId === user?.id ? 'text-right' : ''
                        }`}
                      >
                        {/* Message options dropdown */}
                        <div className={`flex items-center gap-1 mb-1 ${msg.senderId === user?.id ? 'flex-row-reverse' : ''}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={msg.senderId === user?.id ? 'end' : 'start'}>
                              <DropdownMenuItem onClick={() => handleCopyMessage(msg.message)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </DropdownMenuItem>
                              {msg.senderId === user?.id && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingText(msg.message);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Edit mode or normal message display */}
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingText('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditMessage(msg.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`inline-block p-2 sm:p-3 rounded-lg ${
                                msg.senderId === user?.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm sm:text-base break-words">{msg.message}</p>
                              {/* Show attachments in Admin Chat */}
                              {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {(msg.attachments as any[]).map((att: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs sm:text-sm hover:opacity-80"
                                    >
                                      {att.mimeType?.startsWith('image/') ? (
                                        <img src={att.url} alt={att.fileName} className="w-24 sm:w-32 h-auto rounded" />
                                      ) : (
                                        <span className="flex items-center gap-1 underline">
                                          <Download className="h-3 w-3" />
                                          <span className="truncate max-w-[150px]">{att.fileName}</span>
                                        </span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                              {msg.sender?.name} ({msg.sender?.role}) • {formatDateTime(msg.createdAt)}
                              {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                <span className="ml-1">(edited)</span>
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Admin Chat Attachments Preview */}
              {adminChatAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/30 rounded-lg flex-shrink-0">
                  {adminChatAttachments.map((file, index) => (
                    <div key={index} className="relative group/attachment">
                      {isImageFile(file.mimeType) ? (
                        <img
                          src={file.url}
                          alt={file.originalName}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                          <File className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(index, setAdminChatAttachments)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input area with file upload */}
              <div className="flex gap-2 flex-shrink-0 pt-2">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files, setAdminChatAttachments)}
                  className="hidden"
                  id="admin-chat-files"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById('admin-chat-files')?.click()}
                  disabled={uploading}
                  title="Attach files"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  placeholder="Message Admin... (Paste images directly)"
                  value={adminChatMessage}
                  onChange={(e) => setAdminChatMessage(e.target.value)}
                  onPaste={(e) => handlePaste(e, setAdminChatAttachments)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAdminMessage();
                    }
                  }}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button onClick={handleSendAdminMessage} disabled={sendingAdminMessage || uploading || (!adminChatMessage.trim() && adminChatAttachments.length === 0)}>
                  {sendingAdminMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 rounded-lg border-2 border-purple-400 bg-purple-100 dark:bg-purple-900/40 dark:border-purple-600 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              <strong>Private:</strong> Messages here are only visible to you and Admin.
            </p>
          </div>
        </TabsContent>

        {/* Team Lead Chat Tab (Private with Team Lead) */}
        <TabsContent value="teamlead-chat">
          <Card className="flex flex-col max-h-[70vh] sm:max-h-[600px] overflow-hidden">
            <CardHeader className="flex-shrink-0 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Chat with Team Lead</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Private conversation with Team Lead only
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 sm:px-6">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto scrollbar-modern space-y-4 mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg min-h-[250px] sm:min-h-[300px] max-h-[350px] sm:max-h-[400px]">
                {teamLeadChatMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No messages yet. Start a private conversation with the Team Lead!
                  </p>
                ) : (
                  teamLeadChatMessages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`group flex gap-2 sm:gap-3 ${
                        msg.senderId === user?.id ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                        <AvatarImage src={msg.sender?.avatar} />
                        <AvatarFallback>
                          {msg.sender ? getInitials(msg.sender.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${
                          msg.senderId === user?.id ? 'text-right' : ''
                        }`}
                      >
                        {/* Message options dropdown */}
                        <div className={`flex items-center gap-1 mb-1 ${msg.senderId === user?.id ? 'flex-row-reverse' : ''}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={msg.senderId === user?.id ? 'end' : 'start'}>
                              <DropdownMenuItem onClick={() => handleCopyMessage(msg.message)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </DropdownMenuItem>
                              {msg.senderId === user?.id && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingText(msg.message);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Edit mode or normal message display */}
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingText('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditMessage(msg.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`inline-block p-2 sm:p-3 rounded-lg ${
                                msg.senderId === user?.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm sm:text-base break-words">{msg.message}</p>
                              {/* Show attachments */}
                              {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {(msg.attachments as any[]).map((att: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs sm:text-sm hover:opacity-80"
                                    >
                                      {att.mimeType?.startsWith('image/') ? (
                                        <img src={att.url} alt={att.fileName} className="w-24 sm:w-32 h-auto rounded" />
                                      ) : (
                                        <span className="flex items-center gap-1 underline">
                                          <Download className="h-3 w-3" />
                                          <span className="truncate max-w-[150px]">{att.fileName}</span>
                                        </span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                              {msg.sender?.name} ({msg.sender?.role?.replace('_', ' ')}) • {formatDateTime(msg.createdAt)}
                              {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                <span className="ml-1">(edited)</span>
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Team Lead Chat Attachments Preview */}
              {teamLeadChatAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/30 rounded-lg flex-shrink-0">
                  {teamLeadChatAttachments.map((file, index) => (
                    <div key={index} className="relative group/attachment">
                      {isImageFile(file.mimeType) ? (
                        <img
                          src={file.url}
                          alt={file.originalName}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                          <File className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(index, setTeamLeadChatAttachments)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input area with file upload */}
              <div className="flex gap-2 flex-shrink-0 pt-2">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files, setTeamLeadChatAttachments)}
                  className="hidden"
                  id="teamlead-chat-files"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById('teamlead-chat-files')?.click()}
                  disabled={uploading}
                  title="Attach files"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  placeholder="Message Team Lead... (Paste images directly)"
                  value={teamLeadChatMessage}
                  onChange={(e) => setTeamLeadChatMessage(e.target.value)}
                  onPaste={(e) => handlePaste(e, setTeamLeadChatAttachments)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTeamLeadMessage();
                    }
                  }}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button onClick={handleSendTeamLeadMessage} disabled={sendingTeamLeadMessage || uploading || (!teamLeadChatMessage.trim() && teamLeadChatAttachments.length === 0)}>
                  {sendingTeamLeadMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 rounded-lg border-2 border-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 dark:border-indigo-600 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              <strong>Private:</strong> Messages here are only visible to you and the Team Lead.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Requirement Dialog */}
      <Dialog open={editRequirementOpen} onOpenChange={(open) => {
        setEditRequirementOpen(open);
        if (!open) {
          setEditingRequirement(null);
          setEditRequirementAttachments([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Requirement</DialogTitle>
            <DialogDescription>
              Update the requirement content. Changes will create a new version if approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Overview *</Label>
              <Textarea
                placeholder="Project overview and goals..."
                value={editRequirementContent.overview}
                onChange={(e) =>
                  setEditRequirementContent({
                    ...editRequirementContent,
                    overview: e.target.value,
                  })
                }
                rows={4}
              />
            </div>
            <div>
              <Label>Pages/Sections (one per line)</Label>
              <Textarea
                placeholder="Home&#10;About&#10;Services&#10;Contact"
                value={editRequirementContent.pages}
                onChange={(e) =>
                  setEditRequirementContent({
                    ...editRequirementContent,
                    pages: e.target.value,
                  })
                }
                rows={4}
              />
            </div>
            <div>
              <Label>Functional Requirements (one per line)</Label>
              <Textarea
                placeholder="Contact form&#10;Newsletter signup&#10;Blog with comments"
                value={editRequirementContent.functional}
                onChange={(e) =>
                  setEditRequirementContent({
                    ...editRequirementContent,
                    functional: e.target.value,
                  })
                }
                rows={4}
              />
            </div>
            <div>
              <Label>Design Notes</Label>
              <Textarea
                placeholder="Color scheme, typography, style references..."
                value={editRequirementContent.designNotes}
                onChange={(e) =>
                  setEditRequirementContent({
                    ...editRequirementContent,
                    designNotes: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plugins/Integrations (one per line)</Label>
                <Textarea
                  placeholder="WooCommerce&#10;Yoast SEO&#10;Contact Form 7"
                  value={editRequirementContent.plugins}
                  onChange={(e) =>
                    setEditRequirementContent({
                      ...editRequirementContent,
                      plugins: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Out of Scope (one per line)</Label>
                <Textarea
                  placeholder="Content creation&#10;Logo design&#10;Hosting setup"
                  value={editRequirementContent.outOfScope}
                  onChange={(e) =>
                    setEditRequirementContent({
                      ...editRequirementContent,
                      outOfScope: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
            </div>

            {/* File Attachments */}
            <div className="space-y-3">
              <Label>Attachments (Images, PDFs, Documents)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                  onChange={(e) => handleFileUpload(e.target.files, setEditRequirementAttachments)}
                  className="hidden"
                  id="edit-requirement-files"
                  disabled={uploading}
                />
                <label
                  htmlFor="edit-requirement-files"
                  className="inline-flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="mr-2 h-4 w-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Add Files'}
                </label>
                <span className="text-sm text-muted-foreground">
                  Images, PDFs, reference documents
                </span>
              </div>

              {/* Uploaded Files Preview */}
              {editRequirementAttachments.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {editRequirementAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="relative p-3 border rounded-lg bg-muted/30 group"
                    >
                      <button
                        type="button"
                        onClick={() => removeAttachment(index, setEditRequirementAttachments)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex items-center gap-3">
                        {isImageFile(file.mimeType) ? (
                          <img
                            src={file.url}
                            alt={file.originalName}
                            className="w-14 h-14 object-cover rounded cursor-pointer hover:opacity-80"
                            onClick={() => window.open(file.url, '_blank')}
                          />
                        ) : (
                          <div className="w-14 h-14 flex items-center justify-center bg-muted rounded">
                            <File className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditRequirementOpen(false);
                setEditingRequirement(null);
                setEditRequirementAttachments([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRequirement}
              disabled={updatingRequirement || uploading}
            >
              {updatingRequirement && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
