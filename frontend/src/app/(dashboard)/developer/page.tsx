'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessagesWidget } from '@/components/messages-widget';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, AlertTriangle, Info, Star, TrendingUp, Award, Clock, Play, Send, CheckCircle, FileText, Download, Image, Eye } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiGet, apiPost } from '@/lib/api';

// Tier icons and colors
const TIER_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  TRAINEE: { icon: '🌱', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  JUNIOR: { icon: '🌿', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  MID_LEVEL: { icon: '⭐', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  SENIOR: { icon: '💎', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  ELITE: { icon: '👑', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

interface TierStats {
  developer: {
    id: string;
    name: string;
    tier: string | null;
    completedProjects: number;
    averageRating: number;
    totalReviews: number;
  };
  nextTier: {
    name: string;
    projectsNeeded: number;
    ratingNeeded: number;
    isMaxTier: boolean;
  } | null;
  tierThresholds: Record<string, { minProjects: number; minRating: number }>;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  project: {
    id: string;
    internalName: string;
  };
  assignedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Attachment {
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
  attachments?: Attachment[] | null;
  createdAt: string;
  project: {
    id: string;
    internalName: string;
    priority: string;
    internalDeadline: string | null;
  };
  createdBy: {
    id: string;
    name: string;
  };
}

export default function DeveloperDashboardPage() {
  const { user, token } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignedRevisions, setAssignedRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [revisionActionLoading, setRevisionActionLoading] = useState<string | null>(null);
  const [tierStats, setTierStats] = useState<TierStats | null>(null);

  // Submit revision modal state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedRevisionForSubmit, setSelectedRevisionForSubmit] = useState<Revision | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // View revision details modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRevisionForView, setSelectedRevisionForView] = useState<Revision | null>(null);

  const stats = {
    assigned: tasks.filter(t => t.status === 'ASSIGNED').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    submitted: tasks.filter(t => t.status === 'SUBMITTED').length,
    approved: tasks.filter(t => t.status === 'APPROVED').length,
    rejected: tasks.filter(t => t.status === 'REJECTED').length,
    pendingRevisions: assignedRevisions.length,
  };

  // Fetch assigned revisions
  const fetchAssignedRevisions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet<Revision[]>('/revisions/assigned');
      console.log('[DEVELOPER] Assigned revisions:', data);
      setAssignedRevisions(data || []);
    } catch (error) {
      console.error('Failed to fetch assigned revisions:', error);
    }
  }, [token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tier stats
        const tierRes = await fetch('/api/v1/project-reviews/my-stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tierRes.ok) {
          const tierData = await tierRes.json();
          setTierStats(tierData);
        }

        // Fetch all tasks assigned to the current user across all projects
        const res = await fetch('/api/v1/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const projectsData = await res.json();

        const allTasks: Task[] = [];

        if (projectsData.data) {
          for (const project of projectsData.data) {
            const tasksRes = await fetch(`/api/v1/projects/${project.id}/tasks`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const tasksData = await tasksRes.json();

            if (tasksData.data) {
              allTasks.push(...tasksData.data.map((t: Task) => ({
                ...t,
                project: { id: project.id, internalName: project.internalName }
              })));
            }
          }
        }

        setTasks(allTasks);

        // Fetch assigned revisions
        await fetchAssignedRevisions();
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, fetchAssignedRevisions]);

  // WebSocket connection for real-time revision updates
  useEffect(() => {
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket: Socket = io(`${backendUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[DEVELOPER] Connected to WebSocket');
    });

    // Listen for new revision assignments
    socket.on('revision:assigned', (revision: Revision) => {
      console.log('[DEVELOPER] Revision assigned:', revision);
      setAssignedRevisions(prev => [revision, ...prev.filter(r => r.id !== revision.id)]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleStartWork = async (task: Task) => {
    setActionLoading(task.id);
    try {
      const res = await fetch(`/api/v1/projects/${task.project.id}/tasks/${task.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: 'IN_PROGRESS' } : t));
      }
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitWork = async (task: Task) => {
    setActionLoading(task.id);
    try {
      const res = await fetch(`/api/v1/projects/${task.project.id}/tasks/${task.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: 'SUBMITTED' } : t));
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Start working on a revision
  const handleStartRevision = async (revision: Revision) => {
    setRevisionActionLoading(revision.id);
    try {
      await apiPost(`/revisions/${revision.id}/start`);
      setAssignedRevisions(prev =>
        prev.map(r => r.id === revision.id ? { ...r, status: 'IN_PROGRESS' } : r)
      );
    } catch (error) {
      console.error('Failed to start revision:', error);
    } finally {
      setRevisionActionLoading(null);
    }
  };

  // Open submit modal for revision
  const openSubmitModal = (revision: Revision) => {
    setSelectedRevisionForSubmit(revision);
    setSubmitMessage('');
    setSubmitModalOpen(true);
  };

  // Open view modal for revision details
  const openViewModal = (revision: Revision) => {
    setSelectedRevisionForView(revision);
    setViewModalOpen(true);
  };

  // Submit revision work with message
  const handleSubmitRevision = async () => {
    if (!selectedRevisionForSubmit) return;

    setSubmittingRevision(true);
    try {
      await apiPost(`/revisions/${selectedRevisionForSubmit.id}/submit`, {
        message: submitMessage,
      });
      // Remove from list after submission (Team Lead will mark complete)
      setAssignedRevisions(prev => prev.filter(r => r.id !== selectedRevisionForSubmit.id));
      setSubmitModalOpen(false);
      setSelectedRevisionForSubmit(null);
      setSubmitMessage('');
    } catch (error) {
      console.error('Failed to submit revision:', error);
      alert('Failed to submit revision. Please try again.');
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Helper to get file icon
  const getFileIcon = (type?: string | null) => {
    if (!type) return <FileText className="h-4 w-4" />;
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    return <FileText className="h-4 w-4" />;
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

  const activeTasks = tasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'].includes(t.status));
  const submittedTasks = tasks.filter(t => t.status === 'SUBMITTED');
  const completedTasks = tasks.filter(t => t.status === 'APPROVED');

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Developer Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Focus on your assigned tasks.
        </p>
      </div>

      {/* HIGH PRIORITY: Assigned Revisions Alert - RED BOX */}
      {assignedRevisions.length > 0 && (
        <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/50 dark:border-red-700 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 animate-pulse" />
              <CardTitle className="text-red-900 dark:text-red-100">
                HIGH PRIORITY: Client Revisions ({assignedRevisions.length})
              </CardTitle>
            </div>
            <CardDescription className="text-red-800 dark:text-red-200">
              These revisions have TOP PRIORITY over all other tasks. Complete them FIRST.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignedRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="p-4 rounded-lg border-2 border-red-300 dark:border-red-800 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground">{revision.project.internalName}</h4>
                        <Badge variant={revision.status === 'PENDING' ? 'destructive' : 'default'}>
                          {revision.status === 'PENDING' ? 'Not Started' : 'In Progress'}
                        </Badge>
                        {revision.isPaid && (
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Paid Revision
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground">
                        {revision.description}
                      </p>

                      {/* Attachments preview */}
                      {revision.attachments && revision.attachments.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Attachments:</span>
                          {revision.attachments.slice(0, 3).map((att, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {getFileIcon(att.type)}
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

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Assigned: {new Date(revision.createdAt).toLocaleDateString()}
                        </span>
                        <span>From: {revision.createdBy.name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewModal(revision)}
                        className="whitespace-nowrap"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {revision.status === 'PENDING' ? (
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
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openSubmitModal(revision)}
                          className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Submit Work
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier Card */}
      {tierStats && (
        <Card className={`border-2 ${TIER_CONFIG[tierStats.developer.tier || 'TRAINEE']?.bgColor || 'bg-gray-100'}`}>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">
                  {TIER_CONFIG[tierStats.developer.tier || 'TRAINEE']?.icon || '🌱'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xl font-bold ${TIER_CONFIG[tierStats.developer.tier || 'TRAINEE']?.color || 'text-gray-600'}`}>
                      {(tierStats.developer.tier || 'TRAINEE').replace('_', ' ')}
                    </h3>
                    <Badge variant="outline" className="font-normal">
                      <Award className="h-3 w-3 mr-1" />
                      Your Tier
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tierStats.developer.completedProjects} projects completed • {tierStats.developer.averageRating.toFixed(1)} avg rating • {tierStats.developer.totalReviews} reviews
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{tierStats.developer.averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/5</span>
                </div>
              </div>
            </div>

            {/* Next Tier Progress */}
            {tierStats.nextTier && tierStats.nextTier.name && !tierStats.nextTier.isMaxTier && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Next: {tierStats.nextTier.name.replace('_', ' ')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {tierStats.nextTier.projectsNeeded} more projects, {tierStats.nextTier.ratingNeeded?.toFixed(1) || '0'}+ rating needed
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (tierStats.developer.completedProjects / (tierStats.developer.completedProjects + (tierStats.nextTier.projectsNeeded || 1))) * 100)}
                  className="h-2"
                />
              </div>
            )}

            {tierStats.nextTier?.isMaxTier && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-center text-muted-foreground">
                  🎉 Congratulations! You&apos;ve reached the highest tier!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Assigned</p>
            <p className="text-3xl font-bold mt-1">{stats.assigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-3xl font-bold mt-1 text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="text-3xl font-bold mt-1 text-amber-600">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-3xl font-bold mt-1 text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rejected Tasks Alert */}
      {stats.rejected > 0 && (
        <div className="rounded-lg border-2 border-red-400 bg-red-100 dark:bg-red-900/40 dark:border-red-600 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            <strong>Attention:</strong> You have {stats.rejected} rejected task(s) that need to be reworked and resubmitted.
          </p>
        </div>
      )}

      {/* Tasks and Messages Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tasks Tabs */}
        <div className="lg:col-span-2 w-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="tabs-scroll-container">
              <TabsList className="w-max sm:w-auto">
                <TabsTrigger value="active" className="text-xs sm:text-sm">
                  Active ({activeTasks.length})
                </TabsTrigger>
                <TabsTrigger value="submitted" className="text-xs sm:text-sm">
                  Submitted ({submittedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs sm:text-sm">
                  Completed ({completedTasks.length})
                </TabsTrigger>
              </TabsList>
            </div>

        {/* Active Tasks */}
        <TabsContent value="active" className="space-y-4">
          {activeTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <svg
                  className="w-12 h-12 mb-4 opacity-50 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <p className="font-medium text-muted-foreground">No active tasks</p>
                <p className="text-sm text-muted-foreground">
                  Tasks will appear here when assigned by Team Lead
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <Card key={task.id} className={task.status === 'REJECTED' ? 'border-red-200 dark:border-red-800' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{task.title}</h3>
                          <Badge variant={statusColor(task.status)}>
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
                          Project: {task.project.internalName} • Assigned by: {task.assignedBy.name}
                          {task.dueDate && ` • Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                        </p>
                        {task.status === 'REJECTED' && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            This task was rejected. Please review and resubmit.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/developer/tasks/${task.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                        {task.status === 'ASSIGNED' && (
                          <Button
                            size="sm"
                            onClick={() => handleStartWork(task)}
                            disabled={actionLoading === task.id}
                          >
                            {actionLoading === task.id ? 'Starting...' : 'Start Work'}
                          </Button>
                        )}
                        {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && (
                          <Button
                            size="sm"
                            onClick={() => handleSubmitWork(task)}
                            disabled={actionLoading === task.id}
                          >
                            {actionLoading === task.id ? 'Submitting...' : 'Submit Work'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Submitted Tasks */}
        <TabsContent value="submitted" className="space-y-4">
          {submittedTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="font-medium text-muted-foreground">No submitted tasks</p>
                <p className="text-sm text-muted-foreground">
                  Tasks awaiting review will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submittedTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{task.title}</h3>
                          <Badge variant="warning">Awaiting Review</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Project: {task.project.internalName} • Submitted for Team Lead review
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Tasks */}
        <TabsContent value="completed" className="space-y-4">
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="font-medium text-muted-foreground">No completed tasks</p>
                <p className="text-sm text-muted-foreground">
                  Approved tasks will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{task.title}</h3>
                          <Badge variant="success">Approved</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Project: {task.project.internalName}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notice */}
      <div className="rounded-lg border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-600 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          <strong>Developer Role:</strong> Focus on execution. Work on assigned tasks,
          use approved design assets, and submit your work for review.
        </p>
      </div>
    </div>

        {/* Messages Widget */}
        <MessagesWidget />
      </div>

      {/* View Revision Details Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Revision Details
            </DialogTitle>
            <DialogDescription>
              {selectedRevisionForView && (
                <span>Project: <strong>{selectedRevisionForView.project.internalName}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRevisionForView && (
            <div className="space-y-4">
              {/* Status and Info */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={selectedRevisionForView.status === 'PENDING' ? 'destructive' : 'default'}>
                  {selectedRevisionForView.status === 'PENDING' ? 'Not Started' : 'In Progress'}
                </Badge>
                {selectedRevisionForView.isPaid && (
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Paid Revision
                  </Badge>
                )}
              </div>

              {/* Revision Description */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Revision Request:</Label>
                <p className="text-foreground whitespace-pre-wrap">{selectedRevisionForView.description}</p>
              </div>

              {/* Attachments */}
              {selectedRevisionForView.attachments && selectedRevisionForView.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Attachments ({selectedRevisionForView.attachments.length}):</Label>
                  <div className="grid gap-2">
                    {selectedRevisionForView.attachments.map((att, idx) => (
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
                            {getFileIcon(att.type)}
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

              {/* Meta info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Created: {new Date(selectedRevisionForView.createdAt).toLocaleString()}
                </span>
                <span>By: {selectedRevisionForView.createdBy.name}</span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                  Close
                </Button>
                {selectedRevisionForView.status === 'PENDING' ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleStartRevision(selectedRevisionForView);
                      setViewModalOpen(false);
                    }}
                    disabled={revisionActionLoading === selectedRevisionForView.id}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {revisionActionLoading === selectedRevisionForView.id ? 'Starting...' : 'Start Now'}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    onClick={() => {
                      openSubmitModal(selectedRevisionForView);
                      setViewModalOpen(false);
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
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              Submit Revision Work
            </DialogTitle>
            <DialogDescription>
              {selectedRevisionForSubmit && (
                <span>Project: <strong>{selectedRevisionForSubmit.project.internalName}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRevisionForSubmit && (
            <div className="space-y-4">
              {/* Original request summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">Original Request:</Label>
                <p className="text-sm text-foreground line-clamp-3">{selectedRevisionForSubmit.description}</p>
              </div>

              {/* Message input */}
              <div className="space-y-2">
                <Label htmlFor="submit-message" className="font-medium">
                  Your Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="submit-message"
                  placeholder="Describe what changes you made to complete this revision request..."
                  value={submitMessage}
                  onChange={(e) => setSubmitMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to the Team Lead for review.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitModalOpen(false);
                    setSelectedRevisionForSubmit(null);
                    setSubmitMessage('');
                  }}
                  disabled={submittingRevision}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmitRevision}
                  disabled={!submitMessage.trim() || submittingRevision}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submittingRevision ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Submit Revision
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
