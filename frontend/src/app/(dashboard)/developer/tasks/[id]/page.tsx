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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileText, MessageSquare, Send, Loader2, Paperclip, MoreVertical, Pencil, Trash2, Copy, X, AlertCircle, CheckCircle, XCircle, Clock, Download, Image as ImageIcon, Upload, Globe, ExternalLink, Key, Mail, User as UserIcon, RefreshCw, Eye, Play } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TaskAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  attachments?: TaskAttachment[];
  rejectionNote?: string;
  rejectionAttachments?: TaskAttachment[];
  project: {
    id: string;
    internalName: string;
    teamLeadId: string;
    stagingLink?: string;
    stagingPassword?: string;
    clientEmail?: string;
    clientUsername?: string;
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
  assignedBy: {
    id: string;
    name: string;
  };
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
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
}

interface ChatAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
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
  attachments?: ChatAttachment[];
  mentions?: MentionData[];
  createdAt: string;
}

interface UploadedFile {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface ProjectTeam {
  teamLead?: { id: string; name: string; avatar?: string };
  designer?: { id: string; name: string; avatar?: string };
}

interface RevisionAttachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

interface Revision {
  id: string;
  description: string;
  status: string;
  isPaid: boolean;
  attachments?: RevisionAttachment[] | null;
  assignedDeveloperId: string | null;
  developerMessage?: string | null;
  submittedAt?: string | null;
  managerAccepted?: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

export default function DeveloperTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [task, setTask] = useState<Task | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Unified Team Chat state
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

  // Submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionAttachments, setSubmissionAttachments] = useState<UploadedFile[]>([]);
  const [uploadingSubmissionFile, setUploadingSubmissionFile] = useState(false);
  const submissionFileInputRef = useRef<HTMLInputElement>(null);

  // File input refs
  const teamChatFileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Legacy state
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [projectTeam, setProjectTeam] = useState<ProjectTeam>({});
  const chatSocketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Revisions state
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [viewRevisionModal, setViewRevisionModal] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [submitRevisionModal, setSubmitRevisionModal] = useState(false);
  const [revisionSubmitMessage, setRevisionSubmitMessage] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [revisionActionLoading, setRevisionActionLoading] = useState<string | null>(null);

  const taskId = params.id as string;

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Connect to chat WebSocket when we have the project ID from the task
  useEffect(() => {
    if (!token || !task?.project?.id) return;

    const projectId = task.project.id;
    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(`${backendUrl}/chat`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
    });

    socket.on('connect', () => {
      console.log('Developer: Connected to chat socket');
      socket.emit('join:project', { projectId });
    });

    socket.on('chat:message', (message: ChatMessage) => {
      console.log('Developer: Received chat message:', message);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    });

    socket.on('chat:message:updated', (updatedMessage: ChatMessage) => {
      console.log('Developer: Message updated:', updatedMessage);
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
      );
    });

    socket.on('chat:message:deleted', (data: { messageId: string }) => {
      console.log('Developer: Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Developer: Disconnected from chat socket:', reason);
    });

    chatSocketRef.current = socket;

    return () => {
      socket.emit('leave:project', { projectId });
      socket.disconnect();
      chatSocketRef.current = null;
    };
  }, [token, task?.project?.id, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, we need to find which project this task belongs to
        // For now, we'll iterate through projects (in production, you'd have a direct task lookup)
        const projectsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const projectsData = await projectsRes.json();

        let foundTask: Task | null = null;
        let projectId: string | null = null;

        if (projectsData.data) {
          for (const project of projectsData.data) {
            const taskRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/tasks/${taskId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (taskRes.ok) {
              foundTask = await taskRes.json();
              projectId = project.id;
              break;
            }
          }
        }

        if (foundTask && projectId) {
          setTask(foundTask);

          // Fetch approved assets for this project
          const assetsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/assets?status=APPROVED`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const assetsData = await assetsRes.json();
          setAssets(assetsData.data || []);

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

          // Fetch project details for team info
          try {
            const projectRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (projectRes.ok) {
              const projectData = await projectRes.json();
              setProjectTeam({
                teamLead: projectData.teamLead,
                designer: projectData.designer,
              });
            }
          } catch (err) {
            console.error('Failed to fetch project details:', err);
          }

          // Fetch revisions for this project
          try {
            const revisionsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/revisions`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (revisionsRes.ok) {
              const revisionsData = await revisionsRes.json();
              setRevisions(revisionsData.data || revisionsData || []);
            }
          } catch (err) {
            console.error('Failed to fetch revisions:', err);
          }
        }
      } catch (error) {
        console.error('Failed to fetch task:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token && taskId) {
      fetchData();
    }
  }, [token, taskId]);

  const handleStartWork = async () => {
    if (!task) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/tasks/${task.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTask({ ...task, status: 'IN_PROGRESS' });
      }
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!task) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/tasks/${task.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: submissionNote || undefined,
          attachments: submissionAttachments.length > 0
            ? submissionAttachments.map((f) => ({
                url: f.url,
                fileName: f.originalName,
                mimeType: f.mimeType,
                size: f.size,
              }))
            : undefined,
        }),
      });

      if (res.ok) {
        setTask({ ...task, status: 'SUBMITTED', submittedAt: new Date().toISOString() });
        setShowSubmitModal(false);
        setSubmissionNote('');
        setSubmissionAttachments([]);
        toast.success('Task submitted successfully!');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to submit task');
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      toast.error('Failed to submit task');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle submission file upload
  const handleSubmissionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingSubmissionFile(true);
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
        setSubmissionAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('File(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingSubmissionFile(false);
      if (submissionFileInputRef.current) {
        submissionFileInputRef.current.value = '';
      }
    }
  };

  // Handle paste for submission note (pasting images)
  const handleSubmissionPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingSubmissionFile(true);
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
          setSubmissionAttachments((prev) => [...prev, uploadedFile]);
          toast.success('Image pasted');
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          toast.error('Failed to upload pasted image');
        } finally {
          setUploadingSubmissionFile(false);
        }
        break;
      }
    }
  };

  // Start working on a revision
  const handleStartRevision = async (revision: Revision) => {
    setRevisionActionLoading(revision.id);
    try {
      await apiPost(`/revisions/${revision.id}/start`);
      setRevisions((prev) =>
        prev.map((r) => (r.id === revision.id ? { ...r, status: 'IN_PROGRESS' } : r))
      );
      toast.success('Revision started');
    } catch (error) {
      console.error('Failed to start revision:', error);
      toast.error('Failed to start revision');
    } finally {
      setRevisionActionLoading(null);
    }
  };

  // Open submit revision modal
  const openSubmitRevisionModal = (revision: Revision) => {
    setSelectedRevision(revision);
    setRevisionSubmitMessage('');
    setSubmitRevisionModal(true);
  };

  // Submit revision work
  const handleSubmitRevisionWork = async () => {
    if (!selectedRevision) return;

    setSubmittingRevision(true);
    try {
      await apiPost(`/revisions/${selectedRevision.id}/submit`, {
        message: revisionSubmitMessage,
      });
      // Update the revision in the list to show SUBMITTED
      setRevisions((prev) =>
        prev.map((r) =>
          r.id === selectedRevision.id
            ? { ...r, status: 'SUBMITTED', developerMessage: revisionSubmitMessage }
            : r
        )
      );
      setSubmitRevisionModal(false);
      setSelectedRevision(null);
      setRevisionSubmitMessage('');
      toast.success('Revision submitted successfully!');
    } catch (error) {
      console.error('Failed to submit revision:', error);
      toast.error('Failed to submit revision');
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Open view revision modal
  const openViewRevisionModal = (revision: Revision) => {
    setSelectedRevision(revision);
    setViewRevisionModal(true);
  };

  // Get revision status badge color
  const getRevisionStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'secondary';
      case 'IN_PROGRESS':
        return 'default';
      case 'SUBMITTED':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      default:
        return 'secondary';
    }
  };

  // Get file icon for attachment
  const getRevisionFileIcon = (type?: string | null) => {
    if (!type) return <FileText className="h-4 w-4" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    return <FileText className="h-4 w-4" />;
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !task) return;

    setSendingMessage(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: chatMessage }),
      });

      if (res.ok) {
        setChatMessage('');
        // Refresh messages
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Get team members for @mention (Team Lead, Designer, Developer)
  const getTeamMembersForMention = useCallback((): MentionData[] => {
    const members: MentionData[] = [];

    if (projectTeam.teamLead) {
      members.push({
        id: projectTeam.teamLead.id,
        name: projectTeam.teamLead.name,
        role: 'TEAM_LEAD',
      });
    }

    if (projectTeam.designer) {
      members.push({
        id: projectTeam.designer.id,
        name: projectTeam.designer.name,
        role: 'DESIGNER',
      });
    }

    return members;
  }, [projectTeam]);

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
      // Check if there's a space after @, if so don't show dropdown
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
      // Don't add duplicate mentions
      if (prev.some((m) => m.id === member.id)) return prev;
      return [...prev, member];
    });
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);

    // Focus back on input
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
    if (!task) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat/${messageId}`, {
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
    if (!task) return;
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat/${messageId}`, {
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

  // Send message to Team Chat (Team Lead, Designer, Developer)
  const handleSendTeamChatMessage = async () => {
    if ((!teamChatMessage.trim() && teamChatAttachments.length === 0) || !task) return;

    setSendingTeamChatMessage(true);
    try {
      // Extract mentions from message text
      const messageMentions = extractMentionsFromText(teamChatMessage);

      // Build visibility roles - always include TEAM_LEAD and DEVELOPER, add DESIGNER if assigned
      const visibleToRoles = ['TEAM_LEAD', 'DEVELOPER'];
      if (projectTeam.designer) {
        visibleToRoles.push('DESIGNER');
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat`, {
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
        const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${task.project.id}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingTeamChatMessage(false);
    }
  };

  // Filter messages for Team Chat (Team Lead + Developer + Designer)
  const teamChatMessages = messages.filter((msg) => {
    const roles = msg.visibleToRoles || [];
    const isFromManager = msg.sender?.role === 'MANAGER';
    // Show messages visible to developer that are NOT from manager
    // Include messages that have DEVELOPER in visibleToRoles and are from team members
    return roles.includes('DEVELOPER') && !isFromManager && !roles.includes('MANAGER');
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

    // Create a regex to find all @mentions
    const mentionNames = mentions.map((m) => m.name).join('|');
    const mentionPattern = new RegExp(`(@(?:${mentionNames}))\\b`, 'gi');

    const parts = text.split(mentionPattern);

    return (
      <>
        {parts.map((part, index) => {
          // Check if this part is a mention
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

  const statusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'SUBMITTED': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/developer" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span>{task.title}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusColor(task.status)}>
                {task.status.replace('_', ' ')}
              </Badge>
              {task.priority > 7 && (
                <Badge variant="destructive">High Priority ({task.priority})</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {task.status === 'ASSIGNED' && (
              <Button onClick={handleStartWork} disabled={actionLoading}>
                {actionLoading ? 'Starting...' : 'Start Work'}
              </Button>
            )}
            {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && (
              <Button onClick={() => setShowSubmitModal(true)} disabled={actionLoading}>
                Submit Work
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {task.status === 'REJECTED' && (
        <div className="rounded-lg border-2 border-red-400 bg-red-100 dark:bg-red-900/40 dark:border-red-600 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                <strong>Changes Requested:</strong> The Team Lead has requested changes to your work.
              </p>
            </div>
          </div>

          {/* Rejection Feedback */}
          {task.rejectionNote && (
            <div className="ml-8 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Feedback from Team Lead:</p>
              <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap">{task.rejectionNote}</p>
            </div>
          )}

          {/* Rejection Reference Files */}
          {task.rejectionAttachments && task.rejectionAttachments.length > 0 && (
            <div className="ml-8">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-2">Reference Files:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {task.rejectionAttachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 p-2 bg-white/50 dark:bg-black/20 rounded-lg hover:bg-white/80 dark:hover:bg-black/40 transition-colors"
                  >
                    {att.mimeType?.startsWith('image/') ? (
                      <img
                        src={att.url}
                        alt={att.fileName}
                        className="w-full h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-16 flex items-center justify-center bg-red-200 dark:bg-red-800/50 rounded">
                        <FileText className="w-6 h-6 text-red-600 dark:text-red-300" />
                      </div>
                    )}
                    <p className="text-[10px] text-red-800 dark:text-red-200 truncate w-full text-center">
                      {att.fileName}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="ml-8 text-xs text-red-700 dark:text-red-300">
            Please review the feedback above and resubmit your work.
          </p>
        </div>
      )}

      {task.status === 'SUBMITTED' && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-100 dark:bg-amber-900/40 dark:border-amber-600 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            <strong>Awaiting Review:</strong> Your work has been submitted and is waiting for Team Lead approval.
          </p>
        </div>
      )}

      {task.status === 'APPROVED' && (
        <div className="rounded-lg border-2 border-green-400 bg-green-100 dark:bg-green-900/40 dark:border-green-600 p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            <strong>Approved:</strong> Great work! This task has been approved by the Team Lead.
          </p>
        </div>
      )}

      <Tabs defaultValue="details" className="space-y-4 w-full overflow-hidden">
        <div className="tabs-scroll-container">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Task Details</span>
              <span className="sm:hidden">Details</span>
            </TabsTrigger>
            <TabsTrigger value="team-chat" className="text-xs sm:text-sm">
              <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Team Chat</span>
              <span className="sm:hidden">Chat</span> ({teamChatMessages.length})
            </TabsTrigger>
            <TabsTrigger value="revisions" className="text-xs sm:text-sm">
              <RefreshCw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Revisions</span>
              <span className="sm:hidden">Revisions</span> ({revisions.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Task Details Tab */}
        <TabsContent value="details">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Task Details */}
            <div className="md:col-span-2 space-y-6">
              {/* Staging/Development Info */}
              {(task.project.stagingLink || task.project.stagingPassword || task.project.clientEmail || task.project.clientUsername) && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                  <CardContent className="py-4 space-y-3">
                    {/* Staging Link Row */}
                    {(task.project.stagingLink || task.project.stagingPassword) && (
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Globe className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">Staging Site:</span>
                        </div>
                        {task.project.stagingLink ? (
                          <a
                            href={task.project.stagingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {task.project.stagingLink}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                        {task.project.stagingPassword && (
                          <div className="flex items-center gap-2 ml-4">
                            <Key className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-800 dark:text-blue-200">Password:</span>
                            <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                              {task.project.stagingPassword}
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Client Info Row */}
                    {(task.project.clientEmail || task.project.clientUsername) && (
                      <div className="flex items-center gap-4 flex-wrap">
                        {task.project.clientEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-800 dark:text-blue-200">Client Email:</span>
                            <a href={`mailto:${task.project.clientEmail}`} className="text-blue-600 hover:underline">
                              {task.project.clientEmail}
                            </a>
                          </div>
                        )}
                        {task.project.clientUsername && (
                          <div className="flex items-center gap-2 ml-4">
                            <UserIcon className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-800 dark:text-blue-200">Client Username:</span>
                            <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                              {task.project.clientUsername}
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Task Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.description ? (
                    <div>
                      <h4 className="font-medium mb-2">Description</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No description provided</p>
                  )}

                  {/* Task Attachments */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        Attachments ({task.attachments.length})
                      </h4>
                      <div className="space-y-2">
                        {task.attachments.map((attachment, index) => (
                          <a
                            key={index}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={attachment.fileName}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors group"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              {attachment.mimeType?.startsWith('image/') ? (
                                <div className="w-10 h-10 rounded border bg-white dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="w-5 h-5 text-blue-500" />
                                </div>
                              ) : attachment.mimeType === 'application/pdf' ? (
                                <div className="w-10 h-10 rounded border bg-white dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-red-500" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded border bg-white dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                              <div className="overflow-hidden">
                                <p className="font-medium truncate">{attachment.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                  {attachment.mimeType && ` • ${attachment.mimeType.split('/')[1]?.toUpperCase() || attachment.mimeType}`}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="flex-shrink-0 opacity-70 group-hover:opacity-100">
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Approved Assets */}
              <Card>
                <CardHeader>
                  <CardTitle>Approved Design Assets</CardTitle>
                  <CardDescription>
                    Use these approved assets in your development work
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assets.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No approved assets available for this project
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{asset.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {asset.assetType} • {formatFileSize(asset.fileSize)}
                              </p>
                            </div>
                            {asset.fileUrl && (
                              <a
                                href={asset.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Download
                              </a>
                            )}
                          </div>
                          {asset.description && (
                            <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Project</p>
                    <p className="font-medium">{task.project.internalName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned By</p>
                    <p className="font-medium">{task.assignedBy.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <p className="font-medium">{task.priority}/10</p>
                  </div>
                  {task.dueDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</p>
                  </div>
                  {task.submittedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Submitted</p>
                      <p className="font-medium">{new Date(task.submittedAt).toLocaleDateString()}</p>
                    </div>
                  )}
                  {task.approvedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Approved</p>
                      <p className="font-medium">{new Date(task.approvedAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tips */}
              <Card>
                <CardHeader>
                  <CardTitle>Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Review the task description carefully</li>
                    <li>• Use the approved design assets provided</li>
                    <li>• Test your work before submitting</li>
                    <li>• Submit when ready for Team Lead review</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Team Chat Tab */}
        <TabsContent value="team-chat">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="flex flex-col max-h-[70vh] sm:max-h-[600px] overflow-hidden">
                <CardHeader className="flex-shrink-0 px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Team Chat</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Chat with Team Lead{projectTeam.designer ? ' and Designer' : ''}. Use @name to mention someone.
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
                  {projectTeam.teamLead ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-700">
                      <Avatar>
                        <AvatarImage src={projectTeam.teamLead.avatar} />
                        <AvatarFallback className="bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100">
                          {getInitials(projectTeam.teamLead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-indigo-900 dark:text-indigo-50">{projectTeam.teamLead.name}</p>
                        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Team Lead</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      No Team Lead assigned
                    </p>
                  )}

                  {/* Designer */}
                  {projectTeam.designer ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-100 dark:bg-pink-900/40 border-2 border-pink-300 dark:border-pink-700">
                      <Avatar>
                        <AvatarImage src={projectTeam.designer.avatar} />
                        <AvatarFallback className="bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-100">
                          {getInitials(projectTeam.designer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-pink-900 dark:text-pink-50">{projectTeam.designer.name}</p>
                        <p className="text-xs font-medium text-pink-700 dark:text-pink-300">Designer</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      No Designer attached
                    </p>
                  )}

                  {/* Current User (Developer) */}
                  {user && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/40 border-2 border-green-300 dark:border-green-700">
                      <Avatar>
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-green-900 dark:text-green-50">{user.name} (You)</p>
                        <p className="text-xs font-medium text-green-700 dark:text-green-300">Developer</p>
                      </div>
                    </div>
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

        {/* Revisions Tab */}
        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Project Revisions
              </CardTitle>
              <CardDescription>
                All revision requests for this project. Revisions assigned to you require immediate attention.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mb-4 opacity-30" />
                  <p className="font-medium">No revisions for this project</p>
                  <p className="text-sm">Revision requests will appear here when created by the Manager</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.map((revision) => {
                    const isAssignedToMe = revision.assignedDeveloperId === user?.id;
                    const canStart = isAssignedToMe && revision.status === 'PENDING';
                    const canSubmit = isAssignedToMe && revision.status === 'IN_PROGRESS';

                    return (
                      <div
                        key={revision.id}
                        className={`p-4 rounded-lg border-2 ${
                          isAssignedToMe
                            ? revision.status === 'PENDING'
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                              : revision.status === 'IN_PROGRESS'
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30'
                              : revision.status === 'SUBMITTED'
                              ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30'
                              : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getRevisionStatusColor(revision.status)}>
                                {revision.status.replace('_', ' ')}
                              </Badge>
                              {revision.isPaid && (
                                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  Paid Revision
                                </Badge>
                              )}
                              {isAssignedToMe && (
                                <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  Assigned to You
                                </Badge>
                              )}
                              {revision.managerAccepted && (
                                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  Accepted by Manager
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-foreground">{revision.description}</p>

                            {/* Attachments preview */}
                            {revision.attachments && revision.attachments.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Attachments:</span>
                                {revision.attachments.slice(0, 3).map((att, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {getRevisionFileIcon(att.type)}
                                    <span className="ml-1">{att.name}</span>
                                  </Badge>
                                ))}
                                {revision.attachments.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{revision.attachments.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Developer message if submitted */}
                            {revision.developerMessage && (
                              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Your Submission:</p>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100">{revision.developerMessage}</p>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Created: {new Date(revision.createdAt).toLocaleDateString()}
                              </span>
                              <span>By: {revision.createdBy.name}</span>
                              {revision.submittedAt && (
                                <span>Submitted: {new Date(revision.submittedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openViewRevisionModal(revision)}
                              className="whitespace-nowrap"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                            {canStart && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleStartRevision(revision)}
                                disabled={revisionActionLoading === revision.id}
                                className="whitespace-nowrap"
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {revisionActionLoading === revision.id ? 'Starting...' : 'Start Now'}
                              </Button>
                            )}
                            {canSubmit && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openSubmitRevisionModal(revision)}
                                className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Submit Work
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Work Modal */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Submit Your Work</DialogTitle>
            <DialogDescription>
              Add a note and attach any files to submit with your work. This will be reviewed by the Team Lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Submission Note */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Submission Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="Describe what you've completed, any notes for the reviewer..."
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                onPaste={handleSubmissionPaste}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Tip: You can paste images directly (Ctrl+V) to attach them
              </p>
            </div>

            {/* Submission Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Attachments <span className="text-muted-foreground">(optional)</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Upload screenshots, files, or any other deliverables
              </p>

              <input
                type="file"
                ref={submissionFileInputRef}
                onChange={handleSubmissionFileUpload}
                multiple
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => submissionFileInputRef.current?.click()}
                disabled={uploadingSubmissionFile}
              >
                {uploadingSubmissionFile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>

              {/* Attachment Preview */}
              {submissionAttachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {submissionAttachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {file.mimeType.startsWith('image/') ? (
                          <img
                            src={file.url}
                            alt={file.originalName}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium truncate">{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSubmissionAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
                setShowSubmitModal(false);
                setSubmissionNote('');
                setSubmissionAttachments([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitWork} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Work'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Revision Details Modal */}
      <Dialog open={viewRevisionModal} onOpenChange={setViewRevisionModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Revision Details
            </DialogTitle>
            <DialogDescription>
              {selectedRevision && `Revision for ${task?.project.internalName}`}
            </DialogDescription>
          </DialogHeader>

          {selectedRevision && (
            <div className="space-y-4">
              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getRevisionStatusColor(selectedRevision.status)}>
                  {selectedRevision.status.replace('_', ' ')}
                </Badge>
                {selectedRevision.isPaid && (
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Paid Revision
                  </Badge>
                )}
                {selectedRevision.assignedDeveloperId === user?.id && (
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    Assigned to You
                  </Badge>
                )}
              </div>

              {/* Description */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Revision Request:</Label>
                <p className="text-foreground whitespace-pre-wrap">{selectedRevision.description}</p>
              </div>

              {/* Attachments */}
              {selectedRevision.attachments && selectedRevision.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Attachments ({selectedRevision.attachments.length}):</Label>
                  <div className="grid gap-2">
                    {selectedRevision.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900 hover:border-primary hover:shadow-sm transition-all"
                      >
                        {att.type?.startsWith('image/') ? (
                          <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                            {getRevisionFileIcon(att.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{att.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Click to view/download'}
                          </p>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Developer message if submitted */}
              {selectedRevision.developerMessage && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700">
                  <Label className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2 block">Your Submission Message:</Label>
                  <p className="text-yellow-900 dark:text-yellow-100">{selectedRevision.developerMessage}</p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Created: {new Date(selectedRevision.createdAt).toLocaleString()}
                </span>
                <span>By: {selectedRevision.createdBy.name}</span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setViewRevisionModal(false)}>
                  Close
                </Button>
                {selectedRevision.assignedDeveloperId === user?.id && selectedRevision.status === 'PENDING' && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleStartRevision(selectedRevision);
                      setViewRevisionModal(false);
                    }}
                    disabled={revisionActionLoading === selectedRevision.id}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {revisionActionLoading === selectedRevision.id ? 'Starting...' : 'Start Now'}
                  </Button>
                )}
                {selectedRevision.assignedDeveloperId === user?.id && selectedRevision.status === 'IN_PROGRESS' && (
                  <Button
                    variant="default"
                    onClick={() => {
                      openSubmitRevisionModal(selectedRevision);
                      setViewRevisionModal(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submit Work
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Revision Modal */}
      <Dialog open={submitRevisionModal} onOpenChange={setSubmitRevisionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              Submit Revision Work
            </DialogTitle>
            <DialogDescription>
              {selectedRevision && `Submit your work for revision on ${task?.project.internalName}`}
            </DialogDescription>
          </DialogHeader>

          {selectedRevision && (
            <div className="space-y-4">
              {/* Original request summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">Original Request:</Label>
                <p className="text-sm text-foreground line-clamp-3">{selectedRevision.description}</p>
              </div>

              {/* Message input */}
              <div className="space-y-2">
                <Label htmlFor="revision-submit-message" className="font-medium">
                  Your Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="revision-submit-message"
                  placeholder="Describe what changes you made to complete this revision request..."
                  value={revisionSubmitMessage}
                  onChange={(e) => setRevisionSubmitMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to the Team Lead for review.
                </p>
              </div>

              {/* Actions */}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitRevisionModal(false);
                    setSelectedRevision(null);
                    setRevisionSubmitMessage('');
                  }}
                  disabled={submittingRevision}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmitRevisionWork}
                  disabled={!revisionSubmitMessage.trim() || submittingRevision}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submittingRevision ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Submit Revision
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
