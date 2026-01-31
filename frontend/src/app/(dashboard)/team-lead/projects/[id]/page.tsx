'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  X,
  FileText,
  Image as ImageIcon,
  Info,
  Lock,
  Users,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Globe,
  ExternalLink,
  Key,
  User as UserIcon,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  internalName: string;
  projectType: string;
  complexity: string;
  priority: string;
  status: string;
  internalDeadline: string | null;
  stagingLink?: string;
  stagingPassword?: string;
  clientEmail?: string;
  clientUsername?: string;
  manager: { id: string; name: string } | null;
  designer: { id: string; name: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  assignedTo: { id: string; name: string; email: string };
  assignedBy: { id: string; name: string };
  submittedAt: string | null;
  createdAt: string;
}

interface AssetAttachment {
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
  referenceAttachments?: AssetAttachment[];
  requestedBy: { id: string; name: string };
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

interface RequirementAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface Requirement {
  id: string;
  version: number;
  content: {
    overview?: string;
    pages?: string;
    functional?: string;
    designNotes?: string;
    plugins?: string;
    outOfScope?: string;
  };
  attachments?: RequirementAttachment[];
  status: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}

type DeveloperTier = 'TRAINEE' | 'JUNIOR' | 'MID' | 'SENIOR' | 'ELITE';

interface Developer {
  id: string;
  name: string;
  email: string;
  tier?: DeveloperTier;
  completedProjects?: number;
  averageRating?: number;
}

const tierConfig: Record<DeveloperTier, { icon: string; label: string }> = {
  TRAINEE: { icon: '🌱', label: 'Trainee' },
  JUNIOR: { icon: '🌿', label: 'Junior' },
  MID: { icon: '⭐', label: 'Mid' },
  SENIOR: { icon: '💎', label: 'Senior' },
  ELITE: { icon: '👑', label: 'Elite' },
};

interface ChatAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: { id: string; name: string; role: string };
  visibleToRoles?: string[];
  priority?: 'NORMAL' | 'HIGH';
  attachments?: ChatAttachment[];
  createdAt: string;
}

interface UploadedFile {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
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
  createdBy: { id: string; name: string };
  createdAt: string;
}

export default function TeamLeadProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();

  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  // Team Chat state (with Developers/Designer)
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [teamMessagePriority, setTeamMessagePriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [teamChatAttachments, setTeamChatAttachments] = useState<UploadedFile[]>([]);
  const [uploadingTeamFile, setUploadingTeamFile] = useState(false);

  // Manager Chat state (private with Manager)
  const [managerMessage, setManagerMessage] = useState('');
  const [sendingManagerMessage, setSendingManagerMessage] = useState(false);
  const [managerMessagePriority, setManagerMessagePriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [managerChatAttachments, setManagerChatAttachments] = useState<UploadedFile[]>([]);
  const [uploadingManagerFile, setUploadingManagerFile] = useState(false);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');

  // File input refs
  const teamFileInputRef = useRef<HTMLInputElement>(null);
  const managerFileInputRef = useRef<HTMLInputElement>(null);

  // Task creation state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedToId: '',
    priority: 5,
    dueDate: '',
  });
  const [creating, setCreating] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<UploadedFile[]>([]);
  const [uploadingTaskFile, setUploadingTaskFile] = useState(false);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // Asset request state
  const [isRequestAssetOpen, setIsRequestAssetOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    assetType: 'LOGO',
    description: '',
  });
  const [requesting, setRequesting] = useState(false);
  const [assetAttachments, setAssetAttachments] = useState<UploadedFile[]>([]);
  const [uploadingAssetFile, setUploadingAssetFile] = useState(false);
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  // Mark as delivered state
  const [markingDelivered, setMarkingDelivered] = useState(false);

  const projectId = params.id as string;
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
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Connected to chat socket');
      // Join project room
      socket.emit('join:project', { projectId });
    });

    socket.on('chat:message', (message: ChatMessage) => {
      console.log('Received chat message:', message);
      // Add message to state if not already present (avoid duplicates from sender)
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    });

    socket.on('chat:message:updated', (updatedMessage: ChatMessage) => {
      console.log('Message updated:', updatedMessage);
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    });

    socket.on('chat:message:deleted', (data: { messageId: string }) => {
      console.log('Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from chat socket:', reason);
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
    const fetchData = async () => {
      try {
        // Fetch project details
        const projectRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const projectData = await projectRes.json();
        setProject(projectData);

        // Fetch tasks
        const tasksRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tasksData = await tasksRes.json();
        setTasks(tasksData.data || []);

        // Fetch assets
        const assetsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const assetsData = await assetsRes.json();
        setAssets(assetsData.data || []);

        // Fetch requirements
        const reqRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/requirements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const reqData = await reqRes.json();
        // Backend returns array directly for requirements, not { data: [] }
        setRequirements(Array.isArray(reqData) ? reqData : (reqData.data || []));

        // Fetch revisions
        const revRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/revisions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const revData = await revRes.json();
        setRevisions(Array.isArray(revData) ? revData : (revData.data || []));

        // Fetch developers for assignment
        const devRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users?role=DEVELOPER&status=ACTIVE`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const devData = await devRes.json();
        setDevelopers(devData.data || []);

        // Fetch chat messages
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const chatData = await chatRes.json();
        setMessages(chatData.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token && projectId) {
      fetchData();
    }
  }, [token, projectId]);

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedToId) return;

    setCreating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          assignedToId: newTask.assignedToId,
          priority: newTask.priority,
          dueDate: newTask.dueDate || undefined,
          attachments: taskAttachments.length > 0 ? taskAttachments.map((f) => ({
            url: f.url,
            fileName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          })) : undefined,
        }),
      });

      if (res.ok) {
        const task = await res.json();
        setTasks([task, ...tasks]);
        setIsCreateTaskOpen(false);
        setNewTask({ title: '', description: '', assignedToId: '', priority: 5, dueDate: '' });
        setTaskAttachments([]);
        toast.success('Task created successfully');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  // File upload handler for Task attachments
  const handleTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingTaskFile(true);
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
        setTaskAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('File(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingTaskFile(false);
      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }
    }
  };

  const handleRequestAsset = async () => {
    if (!newAsset.name) return;

    setRequesting(true);
    try {
      const requestBody = {
        ...newAsset,
        attachments: assetAttachments.map((f) => ({
          url: f.url,
          fileName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
        })),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const asset = await res.json();
        setAssets([asset, ...assets]);
        setIsRequestAssetOpen(false);
        setNewAsset({ name: '', assetType: 'LOGO', description: '' });
        setAssetAttachments([]);
      }
    } catch (error) {
      console.error('Failed to request asset:', error);
    } finally {
      setRequesting(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'APPROVED' } : t));
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'REJECTED' } : t));
      }
    } catch (error) {
      console.error('Failed to reject task:', error);
    }
  };

  const handleApproveAsset = async (assetId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets/${assetId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAssets(assets.map(a => a.id === assetId ? { ...a, status: 'APPROVED' } : a));
      }
    } catch (error) {
      console.error('Failed to approve asset:', error);
    }
  };

  const handleRejectAsset = async (assetId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets/${assetId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAssets(assets.map(a => a.id === assetId ? { ...a, status: 'REJECTED' } : a));
      }
    } catch (error) {
      console.error('Failed to reject asset:', error);
    }
  };

  // File upload handler for Team Chat
  const handleTeamFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingTeamFile(true);
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
      setUploadingTeamFile(false);
      if (teamFileInputRef.current) {
        teamFileInputRef.current.value = '';
      }
    }
  };

  // File upload handler for Manager Chat
  const handleManagerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingManagerFile(true);
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
        setManagerChatAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('File(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingManagerFile(false);
      if (managerFileInputRef.current) {
        managerFileInputRef.current.value = '';
      }
    }
  };

  // Paste handler for Team Chat
  const handleTeamPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingTeamFile(true);
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
          setUploadingTeamFile(false);
        }
        break;
      }
    }
  };

  // Paste handler for Manager Chat
  const handleManagerPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingManagerFile(true);
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
          setManagerChatAttachments((prev) => [...prev, uploadedFile]);
          toast.success('Image pasted');
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          toast.error('Failed to upload pasted image');
        } finally {
          setUploadingManagerFile(false);
        }
        break;
      }
    }
  };

  // File upload handler for Asset Request
  const handleAssetFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingAssetFile(true);
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
        setAssetAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('Reference file(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingAssetFile(false);
      if (assetFileInputRef.current) {
        assetFileInputRef.current.value = '';
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() && teamChatAttachments.length === 0) return;

    setSendingMessage(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: newMessage || (teamChatAttachments.length > 0 ? 'Shared files' : ''),
          priority: teamMessagePriority,
          attachments: teamChatAttachments.map((f) => ({
            url: f.url,
            fileName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          })),
          visibleToRoles: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'DEVELOPER', 'DESIGNER'],
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages([...messages, msg]);
        setNewMessage('');
        setTeamMessagePriority('NORMAL');
        setTeamChatAttachments([]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Send message to Manager only (private chat)
  const handleSendManagerMessage = async () => {
    if (!managerMessage.trim() && managerChatAttachments.length === 0) return;

    setSendingManagerMessage(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: managerMessage || (managerChatAttachments.length > 0 ? 'Shared files' : ''),
          priority: managerMessagePriority,
          attachments: managerChatAttachments.map((f) => ({
            url: f.url,
            fileName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          })),
          visibleToRoles: ['MANAGER', 'TEAM_LEAD'],
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages([...messages, msg]);
        setManagerMessage('');
        setManagerMessagePriority('NORMAL');
        setManagerChatAttachments([]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingManagerMessage(false);
    }
  };

  // Filter messages for Manager chat (only MANAGER, TEAM_LEAD visibility)
  const managerChatMessages = messages.filter((msg: any) => {
    const roles = msg.visibleToRoles || [];
    return roles.length === 2 &&
           roles.includes('MANAGER') &&
           roles.includes('TEAM_LEAD') &&
           !roles.includes('DEVELOPER') &&
           !roles.includes('DESIGNER');
  });

  // Filter messages for Team chat (includes DEVELOPER or DESIGNER, but NOT from Manager)
  const teamChatMessages = messages.filter((msg: any) => {
    const roles = msg.visibleToRoles || [];
    const isFromManager = msg.sender?.role === 'MANAGER';
    // Exclude messages from Manager - those should only appear in Manager tab
    return (roles.includes('DEVELOPER') || roles.includes('DESIGNER')) && !isFromManager;
  });

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const taskStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'SUBMITTED': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const assetStatusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'SUBMITTED': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-96" />
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

  // Check if all tasks are approved
  const allTasksApproved = tasks.length > 0 && tasks.every(t => t.status === 'APPROVED');
  const canMarkDelivered = allTasksApproved && project.status === 'IN_PROGRESS';

  const handleMarkAsDelivered = async () => {
    if (!canMarkDelivered) return;

    setMarkingDelivered(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/mark-delivered`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        toast.success('Project marked as delivered!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to mark as delivered');
      }
    } catch (error) {
      console.error('Failed to mark as delivered:', error);
      toast.error('Failed to mark as delivered');
    } finally {
      setMarkingDelivered(false);
    }
  };

  const latestRequirement = requirements.find(r => r.status === 'APPROVED') || requirements[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/team-lead" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span>{project.internalName}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.internalName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{project.projectType}</Badge>
            <Badge variant="outline">{project.complexity}</Badge>
            <Badge className={
              project.status === 'REVIEW' ? 'bg-orange-100 text-orange-800' :
              project.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              ''
            }>{project.status.replace('_', ' ')}</Badge>
          </div>
        </div>
        <div>
          {canMarkDelivered && (
            <Button
              onClick={handleMarkAsDelivered}
              disabled={markingDelivered}
              className="bg-green-600 hover:bg-green-700"
            >
              {markingDelivered ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Delivered
                </>
              )}
            </Button>
          )}
          {project.status === 'REVIEW' && (
            <Badge className="bg-orange-100 text-orange-800 text-sm py-2 px-4">
              Awaiting Final Review
            </Badge>
          )}
          {project.status === 'COMPLETED' && (
            <Badge className="bg-green-100 text-green-800 text-sm py-2 px-4">
              Project Completed
            </Badge>
          )}
        </div>
      </div>

      {/* Project Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Manager</p>
            <p className="font-medium">{project.manager?.name || 'Not assigned'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Designer</p>
            <p className="font-medium">{project.designer?.name || 'Not assigned'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Internal Deadline</p>
            <p className="font-medium">
              {project.internalDeadline
                ? new Date(project.internalDeadline).toLocaleDateString()
                : 'Not set'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tasks Progress</p>
            <p className="font-medium">
              {tasks.filter(t => t.status === 'APPROVED').length} / {tasks.length} completed
            </p>
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
                    <Mail className="h-4 w-4 text-blue-600" />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full overflow-hidden">
        <div className="tabs-scroll-container">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs sm:text-sm">
              Assets ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="requirements" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Requirements</span>
              <span className="sm:hidden">Reqs</span>
            </TabsTrigger>
            <TabsTrigger value="revisions" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Revisions</span>
              <span className="sm:hidden">Rev</span> ({revisions.length})
            </TabsTrigger>
            <TabsTrigger value="manager-chat" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Manager</span>
              <span className="sm:hidden">Mgr</span> ({managerChatMessages.length})
            </TabsTrigger>
            <TabsTrigger value="team-chat" className="text-xs sm:text-sm">
              Team ({teamChatMessages.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Break down the project into tasks and assign to developers
            </p>
            <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button>Create Task</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Break down work into a task and assign to a developer
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g., Implement homepage hero section"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Detailed requirements for this task..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="developer">Assign Developer</Label>
                    <Select
                      value={newTask.assignedToId}
                      onValueChange={(value) => setNewTask({ ...newTask, assignedToId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select developer" />
                      </SelectTrigger>
                      <SelectContent>
                        {developers.map((dev) => (
                          <SelectItem key={dev.id} value={dev.id}>
                            <div className="flex items-center gap-2">
                              <span>{dev.name}</span>
                              {dev.tier && (
                                <span className="text-xs" title={tierConfig[dev.tier].label}>
                                  {tierConfig[dev.tier].icon}
                                </span>
                              )}
                              {dev.averageRating !== undefined && dev.averageRating > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ★{dev.averageRating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority (0-10)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min={0}
                        max={10}
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  {/* Attachments Section */}
                  <div className="space-y-2">
                    <Label>Attachments (Images, PDFs, Word Docs)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={taskFileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        multiple
                        onChange={handleTaskFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => taskFileInputRef.current?.click()}
                        disabled={uploadingTaskFile}
                      >
                        <Paperclip className="w-4 h-4 mr-2" />
                        {uploadingTaskFile ? 'Uploading...' : 'Add Files'}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {taskAttachments.length > 0 ? `${taskAttachments.length} file(s) attached` : 'No files attached'}
                      </span>
                    </div>
                    {/* Attached Files Preview */}
                    {taskAttachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {taskAttachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-3 py-2 text-sm bg-muted rounded-md"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              {file.mimeType?.startsWith('image/') ? (
                                <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              ) : file.mimeType === 'application/pdf' ? (
                                <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="truncate">{file.originalName}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setTaskAttachments((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsCreateTaskOpen(false); setTaskAttachments([]); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask} disabled={creating || !newTask.title || !newTask.assignedToId}>
                    {creating ? 'Creating...' : 'Create Task'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="text-muted-foreground">No tasks created yet</p>
                <p className="text-sm text-muted-foreground">
                  Break down the project requirements into tasks
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{task.title}</h3>
                          <Badge variant={taskStatusColor(task.status)}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                          {task.priority > 7 && (
                            <Badge variant="destructive">High Priority</Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {task.assignedTo.name}
                          {task.dueDate && ` • Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === 'SUBMITTED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectTask(task.id)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveTask(task.id)}
                            >
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Request design assets from the designer
            </p>
            <Dialog open={isRequestAssetOpen} onOpenChange={setIsRequestAssetOpen}>
              <DialogTrigger asChild>
                <Button disabled={!project.designer}>Request Asset</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Request Design Asset</DialogTitle>
                  <DialogDescription>
                    Request a design asset from {project.designer?.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="assetName">Asset Name</Label>
                    <Input
                      id="assetName"
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                      placeholder="e.g., Company Logo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assetType">Asset Type</Label>
                    <Select
                      value={newAsset.assetType}
                      onValueChange={(value) => setNewAsset({ ...newAsset, assetType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOGO">Logo</SelectItem>
                        <SelectItem value="BANNER">Banner</SelectItem>
                        <SelectItem value="IMAGE">Image</SelectItem>
                        <SelectItem value="ICON">Icon</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assetDesc">Description/Requirements</Label>
                    <Textarea
                      id="assetDesc"
                      value={newAsset.description}
                      onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                      placeholder="Describe what you need..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reference Files (Optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Attach reference images, PDFs, or other files to help the designer
                    </p>
                    <input
                      type="file"
                      ref={assetFileInputRef}
                      onChange={handleAssetFileUpload}
                      multiple
                      accept="image/*,.pdf,.txt,.doc,.docx"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => assetFileInputRef.current?.click()}
                      disabled={uploadingAssetFile}
                      className="w-full"
                    >
                      {uploadingAssetFile ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Add Reference Files
                        </div>
                      )}
                    </Button>
                    {/* Preview attachments */}
                    {assetAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 p-2 border rounded-lg bg-muted/30">
                        {assetAttachments.map((file, idx) => (
                          <div key={idx} className="relative group">
                            {file.mimeType.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.originalName}
                                className="w-16 h-16 object-cover rounded"
                              />
                            ) : file.mimeType === 'application/pdf' ? (
                              <div className="w-16 h-16 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded">
                                <FileText className="w-6 h-6 text-red-500" />
                              </div>
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                                <FileText className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setAssetAttachments((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <p className="text-[10px] truncate w-16 text-center mt-1">
                              {file.originalName}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsRequestAssetOpen(false);
                    setAssetAttachments([]);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleRequestAsset} disabled={requesting || !newAsset.name}>
                    {requesting ? 'Requesting...' : 'Request Asset'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {!project.designer && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-100 dark:bg-amber-900/40 dark:border-amber-600 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                No designer assigned to this project. Contact the Admin to attach a designer.
              </p>
            </div>
          )}

          {assets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="text-muted-foreground">No assets requested yet</p>
                <p className="text-sm text-muted-foreground">
                  Request logos, banners, and other design assets
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{asset.name}</h3>
                          <Badge variant="outline">{asset.assetType}</Badge>
                          <Badge variant={assetStatusColor(asset.status)}>
                            {asset.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {asset.description && (
                          <p className="text-sm text-muted-foreground">{asset.description}</p>
                        )}
                        {asset.fileUrl && (
                          <a
                            href={asset.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View file: {asset.fileName}
                          </a>
                        )}
                        {/* Reference Attachments */}
                        {asset.referenceAttachments && asset.referenceAttachments.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">Reference files:</p>
                            <div className="flex flex-wrap gap-2">
                              {asset.referenceAttachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2 py-1 text-xs border rounded hover:bg-muted/50 transition-colors"
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
                      <div className="flex items-center gap-2">
                        {asset.status === 'SUBMITTED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectAsset(asset.id)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveAsset(asset.id)}
                            >
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Requirements defined by the Manager (read-only)
          </p>

          {!latestRequirement ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="text-muted-foreground">No requirements available</p>
                <p className="text-sm text-muted-foreground">
                  Manager has not published requirements yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Requirements v{latestRequirement.version}</CardTitle>
                    <CardDescription>
                      By {latestRequirement.createdBy.name} on{' '}
                      {new Date(latestRequirement.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={latestRequirement.status === 'APPROVED' ? 'success' : 'secondary'}>
                    {latestRequirement.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestRequirement.content.overview && (
                  <div>
                    <h4 className="font-medium mb-1">Project Overview</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.overview}
                    </p>
                  </div>
                )}
                {latestRequirement.content.pages && (
                  <div>
                    <h4 className="font-medium mb-1">Pages/Sections</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.pages}
                    </p>
                  </div>
                )}
                {latestRequirement.content.functional && (
                  <div>
                    <h4 className="font-medium mb-1">Functional Requirements</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.functional}
                    </p>
                  </div>
                )}
                {latestRequirement.content.designNotes && (
                  <div>
                    <h4 className="font-medium mb-1">Design Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.designNotes}
                    </p>
                  </div>
                )}
                {latestRequirement.content.plugins && (
                  <div>
                    <h4 className="font-medium mb-1">Plugins/Integrations</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.plugins}
                    </p>
                  </div>
                )}
                {latestRequirement.content.outOfScope && (
                  <div>
                    <h4 className="font-medium mb-1">Out of Scope</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {latestRequirement.content.outOfScope}
                    </p>
                  </div>
                )}
                {/* Display Attachments */}
                {latestRequirement.attachments && latestRequirement.attachments.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Attachments ({latestRequirement.attachments.length})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {latestRequirement.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          {att.mimeType?.startsWith('image/') ? (
                            <img
                              src={att.url}
                              alt={att.fileName}
                              className="w-full h-24 object-cover rounded"
                            />
                          ) : att.mimeType === 'application/pdf' ? (
                            <div className="w-full h-24 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded">
                              <FileText className="w-10 h-10 text-red-500" />
                            </div>
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center bg-muted rounded">
                              <FileText className="w-10 h-10 text-muted-foreground" />
                            </div>
                          )}
                          <div className="text-center w-full">
                            <p className="text-xs font-medium truncate">{att.fileName}</p>
                            <p className="text-[10px] text-muted-foreground group-hover:text-primary">
                              Click to view
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Revisions Tab */}
        <TabsContent value="revisions" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Revision requests from the Manager. Review the attachments and assign tasks accordingly.
          </p>

          {revisions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="text-muted-foreground">No revisions yet</p>
                <p className="text-sm text-muted-foreground">
                  Revisions will appear here when the Manager creates them
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {revisions.map((revision) => (
                <Card key={revision.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            revision.status === 'COMPLETED'
                              ? 'default'
                              : revision.status === 'IN_PROGRESS'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {revision.status.replace('_', ' ')}
                        </Badge>
                        {revision.isPaid && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Paid Revision
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(revision.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {revision.description}
                      </p>
                    </div>

                    {/* Display Attachments */}
                    {revision.attachments && revision.attachments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Attachments ({revision.attachments.length})</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {revision.attachments.map((att, idx) => (
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
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-muted-foreground"
                                  >
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{att.fileName}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Click to view
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Created by {revision.createdBy?.name || 'Manager'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Manager Chat Tab (Private with Manager) */}
        <TabsContent value="manager-chat" className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Private chat with the Project Manager
          </p>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              {/* Messages list */}
              <div className="h-[300px] sm:h-[400px] overflow-y-auto scrollbar-modern mb-4 space-y-3 rounded-xl p-3 sm:p-4 bg-muted/30">
                {managerChatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No messages yet. Start a conversation with the Manager!</p>
                    </div>
                  </div>
                ) : (
                  managerChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender.id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="relative group max-w-[85%] sm:max-w-[75%]">
                        <div
                          className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm ${
                            msg.priority === 'HIGH'
                              ? 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900 dark:to-green-800 border border-green-400 dark:border-green-600'
                              : msg.sender.id === user?.id
                              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-bl-md'
                          }`}
                        >
                          {msg.priority === 'HIGH' && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-green-300 dark:border-green-600">
                              <span className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs font-semibold tracking-wide uppercase">HIGH PRIORITY</span>
                            </div>
                          )}
                          {msg.sender.id !== user?.id && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`font-semibold text-xs sm:text-sm ${msg.priority === 'HIGH' ? 'text-green-700 dark:text-green-300' : 'text-slate-800 dark:text-white'}`}>{msg.sender.name}</span>
                              <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Manager</Badge>
                            </div>
                          )}
                          {editingMessageId === msg.id ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                value={editMessageText}
                                onChange={(e) => setEditMessageText(e.target.value)}
                                className="text-xs sm:text-sm h-8"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditMessage(msg.id, editMessageText);
                                  } else if (e.key === 'Escape') {
                                    setEditingMessageId(null);
                                  }
                                }}
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleEditMessage(msg.id, editMessageText)}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <p className={`text-xs sm:text-sm break-words leading-relaxed ${msg.priority === 'HIGH' ? 'text-green-800 dark:text-green-200' : 'text-slate-700 dark:text-slate-100'}`}>{msg.message}</p>
                          )}
                          {/* Display attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                                >
                                  {att.mimeType?.startsWith('image/') ? (
                                    <img src={att.url} alt={att.fileName} className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-md" />
                                  ) : (
                                    <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded-lg">
                                      <FileText className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                                    </div>
                                  )}
                                  <span className="text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px]">{att.fileName}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className={`text-[9px] sm:text-[10px] mt-1 px-1 text-slate-500 dark:text-slate-400 ${msg.sender.id === user?.id ? 'text-right' : ''}`}>
                          {formatMessageTime(msg.createdAt)}
                        </p>
                        {/* Edit/Delete dropdown for own messages */}
                        {msg.sender.id === user?.id && (
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
              {managerChatAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-lg bg-muted/30">
                  {managerChatAttachments.map((file, idx) => (
                    <div key={idx} className="relative group">
                      {file.mimeType.startsWith('image/') ? (
                        <img src={file.url} alt={file.originalName} className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => setManagerChatAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-[10px] truncate w-16 text-center mt-1">{file.originalName}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Message input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={managerFileInputRef}
                    onChange={handleManagerFileUpload}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => managerFileInputRef.current?.click()}
                    disabled={uploadingManagerFile}
                  >
                    {uploadingManagerFile ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                  <Input
                    placeholder="Message Manager..."
                    value={managerMessage}
                    onChange={(e) => setManagerMessage(e.target.value)}
                    onPaste={handleManagerPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendManagerMessage();
                      }
                    }}
                    disabled={sendingManagerMessage}
                    className={managerMessagePriority === 'HIGH' ? 'border-green-500' : ''}
                  />
                  <Button onClick={handleSendManagerMessage} disabled={sendingManagerMessage || (!managerMessage.trim() && managerChatAttachments.length === 0)}>
                    {sendingManagerMessage ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="managerPriority"
                    checked={managerMessagePriority === 'HIGH'}
                    onCheckedChange={(checked) =>
                      setManagerMessagePriority(checked ? 'HIGH' : 'NORMAL')
                    }
                  />
                  <Label htmlFor="managerPriority" className="text-sm text-green-600 dark:text-green-400 cursor-pointer">
                    ⚡ High Priority Message
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border-2 border-purple-400 bg-purple-100 dark:bg-purple-900/40 dark:border-purple-600 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              <strong>Private:</strong> Messages here are only visible to you and the Manager.
            </p>
          </div>
        </TabsContent>

        {/* Team Chat Tab (with Developers and Designer) */}
        <TabsContent value="team-chat" className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Public chat with Developers and Designer about this project
          </p>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              {/* Messages list */}
              <div className="h-[300px] sm:h-[400px] overflow-y-auto scrollbar-modern mb-4 space-y-3 rounded-xl p-3 sm:p-4 bg-muted/30">
                {teamChatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No messages yet. Start a conversation with your team!</p>
                    </div>
                  </div>
                ) : (
                  teamChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender.id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="relative group max-w-[85%] sm:max-w-[75%]">
                        <div
                          className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm ${
                            msg.priority === 'HIGH'
                              ? 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900 dark:to-green-800 border border-green-400 dark:border-green-600'
                              : msg.sender.id === user?.id
                              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-bl-md'
                          }`}
                        >
                          {msg.priority === 'HIGH' && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-green-300 dark:border-green-600">
                              <span className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs font-semibold tracking-wide uppercase">HIGH PRIORITY</span>
                            </div>
                          )}
                          {msg.sender.id !== user?.id && (
                            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-1.5">
                              <span className={`font-semibold text-xs sm:text-sm ${msg.priority === 'HIGH' ? 'text-green-700 dark:text-green-300' : 'text-slate-800 dark:text-white'}`}>{msg.sender.name}</span>
                              <Badge
                                variant="secondary"
                                className={`text-[9px] sm:text-[10px] px-1.5 py-0 h-4 ${
                                  msg.sender.role === 'DEVELOPER'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : msg.sender.role === 'DESIGNER'
                                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
                                    : msg.sender.role === 'MANAGER'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {msg.sender.role.replace('_', ' ')}
                              </Badge>
                            </div>
                          )}
                          {editingMessageId === msg.id ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                value={editMessageText}
                                onChange={(e) => setEditMessageText(e.target.value)}
                                className="text-xs sm:text-sm h-8"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditMessage(msg.id, editMessageText);
                                  } else if (e.key === 'Escape') {
                                    setEditingMessageId(null);
                                  }
                                }}
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleEditMessage(msg.id, editMessageText)}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <p className={`text-xs sm:text-sm break-words leading-relaxed ${msg.priority === 'HIGH' ? 'text-green-800 dark:text-green-200' : 'text-slate-700 dark:text-slate-100'}`}>{msg.message}</p>
                          )}
                          {/* Display attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                                >
                                  {att.mimeType?.startsWith('image/') ? (
                                    <img src={att.url} alt={att.fileName} className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-md" />
                                  ) : (
                                    <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded-lg">
                                      <FileText className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                                    </div>
                                  )}
                                  <span className="text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px]">{att.fileName}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className={`text-[9px] sm:text-[10px] mt-1 px-1 text-slate-500 dark:text-slate-400 ${msg.sender.id === user?.id ? 'text-right' : ''}`}>
                          {formatMessageTime(msg.createdAt)}
                        </p>
                        {/* Edit/Delete dropdown for own messages */}
                        {msg.sender.id === user?.id && (
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

              {/* Message input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={teamFileInputRef}
                    onChange={handleTeamFileUpload}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => teamFileInputRef.current?.click()}
                    disabled={uploadingTeamFile}
                  >
                    {uploadingTeamFile ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                  <Input
                    placeholder="Message your team..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onPaste={handleTeamPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sendingMessage}
                    className={teamMessagePriority === 'HIGH' ? 'border-green-500' : ''}
                  />
                  <Button onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && teamChatAttachments.length === 0)}>
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="teamPriority"
                    checked={teamMessagePriority === 'HIGH'}
                    onCheckedChange={(checked) =>
                      setTeamMessagePriority(checked ? 'HIGH' : 'NORMAL')
                    }
                  />
                  <Label htmlFor="teamPriority" className="text-sm text-green-600 dark:text-green-400 cursor-pointer">
                    ⚡ High Priority Message
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-600 p-4 flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              <strong>Team Chat:</strong> Messages are visible to Developers and Designer assigned to this project.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
