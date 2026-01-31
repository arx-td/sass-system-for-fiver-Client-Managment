'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Users,
  FileText,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Palette,
  Code,
  TrendingUp,
  ListTodo,
  RefreshCcw,
  Send,
  Loader2,
  Paperclip,
  X,
  File,
  Download,
  MoreVertical,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { apiGet, apiPatch, apiDelete, getErrorMessage } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth-store';

interface Project {
  id: string;
  internalName: string;
  projectType: string;
  complexity: string;
  priority: string;
  status: string;
  budget: number | null;
  internalDeadline: string | null;
  fiverrDeadline: string | null;
  meetingLink: string | null;
  createdAt: string;
  updatedAt: string;
  fiverrAccount: { id: string; accountName: string } | null;
  manager: { id: string; name: string; email: string } | null;
  teamLead: { id: string; name: string; email: string } | null;
  designer: { id: string; name: string; email: string } | null;
  tasks: Task[];
  requirements: Requirement[];
  _count: {
    tasks: number;
    requirements: number;
    revisions: number;
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

interface Requirement {
  id: string;
  version: number;
  status: string;
  content: any;
  createdAt: string;
  createdBy: { id: string; name: string };
}

interface Asset {
  id: string;
  name: string;
  assetType: string;
  status: string;
  createdAt: string;
}

interface RevisionAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface Revision {
  id: string;
  description: string;
  attachments?: RevisionAttachment[];
  isPaid: boolean;
  status: string;
  developerMessage?: string | null;
  managerAccepted?: boolean;
  submittedAt?: string | null;
  createdBy?: { id: string; name: string };
  assignedDeveloper?: { id: string; name: string } | null;
  createdAt: string;
}

interface ChatAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  sender: { id: string; name: string; role: string; avatar?: string };
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt?: string;
}

interface UploadedFile {
  url: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export default function AdminProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Admin: Connected to chat socket');
      socket.emit('join:project', { projectId });
    });

    socket.on('chat:message', (message: ChatMessage) => {
      console.log('Admin: Received chat message:', message);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    });

    socket.on('chat:message:updated', (updatedMessage: ChatMessage) => {
      console.log('Admin: Message updated:', updatedMessage);
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    });

    socket.on('chat:message:deleted', ({ messageId }: { messageId: string }) => {
      console.log('Admin: Message deleted:', messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Admin: Disconnected from chat socket:', reason);
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
      const [projectData, assetsData, revisionsData, messagesData] = await Promise.all([
        apiGet<Project>(`/projects/${projectId}`),
        apiGet<{ data: Asset[] }>(`/projects/${projectId}/assets`).catch(() => ({ data: [] })),
        apiGet<Revision[]>(`/projects/${projectId}/revisions`).catch(() => []),
        apiGet<{ data: ChatMessage[] }>(`/projects/${projectId}/chat`).catch(() => ({ data: [] })),
      ]);

      setProject(projectData);
      setAssets(assetsData.data || []);
      setRevisions(revisionsData || []);
      setMessages(messagesData.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
      router.push('/admin/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() && chatAttachments.length === 0) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: chatMessage || (chatAttachments.length > 0 ? 'Shared files' : ''),
          attachments: chatAttachments.map((f) => ({
            url: f.url,
            fileName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          })),
          visibleToRoles: ['ADMIN', 'MANAGER'], // Admin-Manager private chat
        }),
      });

      if (response.ok) {
        setChatMessage('');
        setChatAttachments([]);
        // Refresh messages
        const messagesData = await apiGet<{ data: ChatMessage[] }>(`/projects/${projectId}/chat`).catch(() => ({ data: [] }));
        setMessages(messagesData.data || []);
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (files: FileList | null) => {
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

      if (!response.ok) throw new Error('Upload failed');

      const uploadedFiles: UploadedFile[] = await response.json();
      setChatAttachments((prev) => [...prev, ...uploadedFiles]);
      toast.success(`${uploadedFiles.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Paste handler for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileList = new DataTransfer();
          fileList.items.add(file);
          await handleFileUpload(fileList.files);
        }
        break;
      }
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setChatAttachments((prev) => prev.filter((_, i) => i !== index));
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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if file is image
  const isImageFile = (mimeType?: string) => mimeType?.startsWith('image/');

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800';
      case 'REQUIREMENTS_PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
      case 'REVIEW': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'ON_HOLD': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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

  const calculateProgress = () => {
    if (!project || !project.tasks || project.tasks.length === 0) return 0;
    const completedTasks = project.tasks.filter(t => t.status === 'APPROVED').length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  };

  const getTaskStats = () => {
    if (!project || !project.tasks) return { total: 0, completed: 0, inProgress: 0, pending: 0, submitted: 0 };
    const tasks = project.tasks;
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'APPROVED').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      pending: tasks.filter(t => t.status === 'ASSIGNED').length,
      submitted: tasks.filter(t => t.status === 'SUBMITTED').length,
    };
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  const progress = calculateProgress();
  const taskStats = getTaskStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.internalName}</h1>
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground">{project.projectType} • {project.complexity}</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchProjectData}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Project Progress</h3>
              <p className="text-sm text-muted-foreground">
                {taskStats.completed} of {taskStats.total} tasks completed
              </p>
            </div>
            <div className="text-3xl font-bold text-primary">{progress}%</div>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
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
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Returned Notice - Shows when project is COMPLETED */}
      {project.status === 'COMPLETED' && (
        <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                  Project Completed Successfully! 🎉
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  If the client returns with additional changes, the assigned Manager ({project.manager?.name || 'N/A'}) can create a new revision from their project dashboard.
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <RefreshCcw className="h-3 w-3" />
                  Creating a revision will automatically reopen the project with &quot;Client Review&quot; status
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team & Info Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Manager */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-blue-100">
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  {project.manager ? getInitials(project.manager.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Manager</p>
                <p className="font-medium">{project.manager?.name || 'Not assigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Lead */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-indigo-100">
                <AvatarFallback className="bg-indigo-100 text-indigo-700">
                  {project.teamLead ? getInitials(project.teamLead.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Team Lead</p>
                <p className="font-medium">{project.teamLead?.name || 'Not assigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Designer */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-pink-100">
                <AvatarFallback className="bg-pink-100 text-pink-700">
                  {project.designer ? getInitials(project.designer.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Designer</p>
                <p className="font-medium">{project.designer?.name || 'Not assigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fiverr Account */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fiverr Account</p>
                <p className="font-medium">{project.fiverrAccount?.accountName || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details & Deadlines */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority</span>
              <Badge variant={project.priority === 'URGENT' || project.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                {project.priority}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Complexity</span>
              <span className="font-medium">{project.complexity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">{project.budget ? `$${project.budget}` : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatDate(project.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium">{formatDate(project.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deadlines & Counts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Internal Deadline
              </span>
              <span className="font-medium">{formatDate(project.internalDeadline)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Fiverr Deadline
              </span>
              <span className="font-medium">{formatDate(project.fiverrDeadline)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Tasks</span>
              <span className="font-medium">{project._count?.tasks || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requirements</span>
              <span className="font-medium">{project._count?.requirements || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revisions</span>
              <span className="font-medium">{project._count?.revisions || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="tasks" className="space-y-4 w-full overflow-hidden">
        <div className="tabs-scroll-container">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="tasks" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <ListTodo className="h-3 w-3 sm:h-4 sm:w-4" />
              Tasks ({project.tasks?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Team Activity</span>
              <span className="sm:hidden">Team</span>
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Palette className="h-3 w-3 sm:h-4 sm:w-4" />
              Assets ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              Chat ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="revisions" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <RefreshCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              Revisions ({revisions.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Complete task breakdown with developer assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {!project.tasks || project.tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No tasks created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {project.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          task.status === 'APPROVED' ? 'bg-green-500' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                          task.status === 'SUBMITTED' ? 'bg-amber-500' :
                          'bg-gray-300'
                        }`} />
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {task.assignedTo && (
                              <span className="flex items-center gap-1">
                                <Code className="h-3 w-3" />
                                {task.assignedTo.name}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={getTaskStatusColor(task.status) as any}>
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Activity Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Members & Activity</CardTitle>
              <CardDescription>Who is working on this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Manager Section */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-12 w-12 bg-blue-100">
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {project.manager ? getInitials(project.manager.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{project.manager?.name || 'Not assigned'}</p>
                      <p className="text-sm text-muted-foreground">Project Manager</p>
                    </div>
                    <Badge className="ml-auto">MANAGER</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Responsible for requirements, client communication, and project oversight.
                  </p>
                </div>

                {/* Team Lead Section */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-12 w-12 bg-indigo-100">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700">
                        {project.teamLead ? getInitials(project.teamLead.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{project.teamLead?.name || 'Not assigned'}</p>
                      <p className="text-sm text-muted-foreground">Team Lead</p>
                    </div>
                    <Badge className="ml-auto" variant="secondary">TEAM LEAD</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manages task assignments, code reviews, and developer coordination.
                  </p>
                </div>

                {/* Developers Section */}
                {project.tasks && project.tasks.length > 0 && (
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">Assigned Developers</h4>
                    <div className="space-y-3">
                      {Array.from(new Set(project.tasks.filter(t => t.assignedTo).map(t => JSON.stringify(t.assignedTo)))).map((devStr, idx) => {
                        const dev = JSON.parse(devStr);
                        const devTasks = project.tasks.filter(t => t.assignedTo?.id === dev.id);
                        const completedTasks = devTasks.filter(t => t.status === 'APPROVED').length;
                        return (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 bg-green-100">
                                <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                                  {getInitials(dev.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{dev.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {completedTasks}/{devTasks.length} tasks completed
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">DEVELOPER</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Designer Section */}
                {project.designer && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-12 w-12 bg-pink-100">
                        <AvatarFallback className="bg-pink-100 text-pink-700">
                          {getInitials(project.designer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{project.designer.name}</p>
                        <p className="text-sm text-muted-foreground">Designer</p>
                      </div>
                      <Badge className="ml-auto" variant="outline">DESIGNER</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Creates design assets, graphics, and visual elements. {assets.length} assets in this project.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Design Assets</CardTitle>
              <CardDescription>All assets created for this project</CardDescription>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Palette className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No assets yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {assets.map((asset) => (
                    <div key={asset.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-sm text-muted-foreground">{asset.assetType}</p>
                        </div>
                        <Badge variant={asset.status === 'APPROVED' ? 'default' : 'secondary'}>
                          {asset.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card className="flex flex-col max-h-[70vh] sm:max-h-[600px] overflow-hidden">
            <CardHeader className="flex-shrink-0 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Project Chat</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Chat with Manager about this project (Admin-Manager private)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 sm:px-6">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto scrollbar-modern space-y-4 mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg min-h-[250px] sm:min-h-[300px] max-h-[350px] sm:max-h-[400px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Start the conversation with the Manager!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`group flex gap-2 sm:gap-3 ${msg.senderId === user?.id ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(msg.sender.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${msg.senderId === user?.id ? 'text-right' : ''}`}>
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

                              {/* Attachments display */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {msg.attachments.map((attachment, idx) => (
                                    <div key={idx}>
                                      {isImageFile(attachment.mimeType) ? (
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img
                                            src={attachment.url}
                                            alt={attachment.fileName}
                                            className="max-w-[200px] max-h-[150px] rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`flex items-center gap-2 p-2 rounded-md hover:opacity-80 transition-opacity ${
                                            msg.senderId === user?.id
                                              ? 'bg-primary-foreground/10'
                                              : 'bg-background/50'
                                          }`}
                                        >
                                          <File className="h-4 w-4 flex-shrink-0" />
                                          <span className="text-xs truncate max-w-[150px]">
                                            {attachment.fileName}
                                          </span>
                                          <Download className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                              {msg.sender.name} ({msg.sender.role}) • {formatDateTime(msg.createdAt)}
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

              {/* Attachment preview area */}
              {chatAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/50 rounded-lg">
                  {chatAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="relative group/attachment flex items-center gap-2 bg-background rounded-md p-2 pr-8"
                    >
                      {isImageFile(file.mimeType) ? (
                        <img
                          src={file.url}
                          alt={file.originalName}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="max-w-[100px]">
                        <p className="text-xs truncate">{file.originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute right-1 top-1 p-1 rounded-full hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input area with file upload */}
              <div className="flex gap-2 flex-shrink-0 pt-2">
                {/* File upload button */}
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    id="chat-file-upload"
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById('chat-file-upload')?.click()}
                    disabled={uploading}
                    title="Attach files"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Text input with paste support */}
                <Textarea
                  ref={chatInputRef}
                  placeholder="Type a message to Manager... (Paste images directly)"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                />

                {/* Send button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || (!chatMessage.trim() && chatAttachments.length === 0)}
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revisions Tab */}
        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle>Revision History</CardTitle>
              <CardDescription>Track all revision requests and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCcw className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No revisions yet</p>
                  <p className="text-sm mt-1">Revisions are created by the Manager when client requests changes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className={`p-4 border rounded-lg space-y-3 ${
                        revision.status === 'COMPLETED' && revision.managerAccepted
                          ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20'
                          : revision.status === 'COMPLETED'
                          ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20'
                          : revision.status === 'SUBMITTED'
                          ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20'
                          : revision.status === 'IN_PROGRESS'
                          ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/20'
                          : 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              revision.status === 'COMPLETED' && revision.managerAccepted
                                ? 'default'
                                : revision.status === 'COMPLETED'
                                ? 'secondary'
                                : revision.status === 'SUBMITTED'
                                ? 'outline'
                                : 'destructive'
                            }
                            className={
                              revision.status === 'COMPLETED' && revision.managerAccepted
                                ? 'bg-green-600'
                                : ''
                            }
                          >
                            {revision.status === 'COMPLETED' && revision.managerAccepted
                              ? 'ACCEPTED'
                              : revision.status}
                          </Badge>
                          {revision.isPaid && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Paid
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(revision.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{revision.description}</p>
                      {revision.developerMessage && (
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">Developer&apos;s Response:</p>
                          <p className="text-sm text-yellow-900 dark:text-yellow-100">{revision.developerMessage}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created by: {revision.createdBy?.name || 'Unknown'}</span>
                        {revision.assignedDeveloper && (
                          <span>Assigned to: {revision.assignedDeveloper.name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
