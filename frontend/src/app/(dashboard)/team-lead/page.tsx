'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesWidget } from '@/components/messages-widget';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, AlertTriangle, Clock, UserPlus, CheckCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiGet, apiPost } from '@/lib/api';

interface Project {
  id: string;
  internalName: string;
  projectType: string;
  complexity: string;
  priority: string;
  status: string;
  internalDeadline: string | null;
  fiverrDeadline: string | null;
  manager: {
    id: string;
    name: string;
  } | null;
  designer: {
    id: string;
    name: string;
  } | null;
  _count?: {
    tasks: number;
    assets: number;
  };
}

interface Task {
  id: string;
  title: string;
  status: string;
  assignedTo: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    internalName: string;
  };
  submittedAt: string | null;
}

interface Revision {
  id: string;
  description: string;
  status: string;
  isPaid: boolean;
  assignedDeveloperId: string | null;
  developerMessage?: string | null;
  submittedAt?: string | null;
  attachments?: any[];
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

interface SuggestedDeveloper {
  id: string;
  name: string;
  tier: string | null;
  activeTaskCount: number;
  workedOnProject: boolean;
  score: number;
}

export default function TeamLeadDashboardPage() {
  const { user, token } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Task[]>([]);
  const [pendingRevisions, setPendingRevisions] = useState<Revision[]>([]);
  const [submittedRevisions, setSubmittedRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    assignedProjects: 0,
    activeTasks: 0,
    pendingReviews: 0,
    pendingAssets: 0,
    pendingRevisions: 0,
    submittedRevisions: 0,
  });

  // Assign developer modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [suggestedDevelopers, setSuggestedDevelopers] = useState<SuggestedDeveloper[]>([]);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [loadingDevelopers, setLoadingDevelopers] = useState(false);
  const [completingRevision, setCompletingRevision] = useState<string | null>(null);

  // Fetch pending revisions (needs developer assignment)
  const fetchPendingRevisions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet<Revision[]>('/revisions/pending');
      console.log('[TEAM_LEAD] Pending revisions:', data);
      setPendingRevisions(data || []);
      setStats(prev => ({ ...prev, pendingRevisions: data?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch pending revisions:', error);
    }
  }, [token]);

  // Fetch submitted revisions (developer completed, needs review)
  const fetchSubmittedRevisions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet<Revision[]>('/revisions/submitted');
      console.log('[TEAM_LEAD] Submitted revisions:', data);
      setSubmittedRevisions(data || []);
      setStats(prev => ({ ...prev, submittedRevisions: data?.length || 0 }));
    } catch (error) {
      console.error('Failed to fetch submitted revisions:', error);
    }
  }, [token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects - backend auto-filters for Team Lead role
        const projectsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const projectsData = await projectsRes.json();

        // Debug: Log the response to check filtering
        console.log('[TEAM_LEAD] Projects response:', projectsData);

        if (projectsData.data) {
          setProjects(projectsData.data);
          setStats(prev => ({ ...prev, assignedProjects: projectsData.data.length }));

          // Fetch pending reviews (submitted tasks) from all projects
          const allTasks: Task[] = [];
          let totalActiveTasks = 0;
          let totalPendingReviews = 0;

          for (const project of projectsData.data) {
            const tasksRes = await fetch(`/api/v1/projects/${project.id}/tasks`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const tasksData = await tasksRes.json();

            if (tasksData.data) {
              const submitted = tasksData.data.filter((t: Task) => t.status === 'SUBMITTED');
              const active = tasksData.data.filter((t: Task) =>
                ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)
              );

              totalActiveTasks += active.length;
              totalPendingReviews += submitted.length;

              allTasks.push(...submitted.map((t: Task) => ({
                ...t,
                project: { id: project.id, internalName: project.internalName }
              })));
            }
          }

          setPendingReviews(allTasks);
          setStats(prev => ({
            ...prev,
            activeTasks: totalActiveTasks,
            pendingReviews: totalPendingReviews,
          }));
        }

        // Fetch pending revisions and submitted revisions
        await Promise.all([
          fetchPendingRevisions(),
          fetchSubmittedRevisions(),
        ]);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id && token) {
      fetchData();
    }
  }, [user?.id, token, fetchPendingRevisions, fetchSubmittedRevisions]);

  // WebSocket connection for real-time revision updates
  useEffect(() => {
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket: Socket = io(`${backendUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[TEAM_LEAD] Connected to WebSocket');
    });

    // Listen for new revisions (from Manager)
    socket.on('revision:pending:new', (revision: Revision) => {
      console.log('[TEAM_LEAD] New revision received:', revision);
      setPendingRevisions(prev => [revision, ...prev]);
      setStats(prev => ({ ...prev, pendingRevisions: prev.pendingRevisions + 1 }));
    });

    // Listen for submitted revisions (from Developer)
    socket.on('revision:submitted', (revision: Revision) => {
      console.log('[TEAM_LEAD] Revision submitted by developer:', revision);
      setSubmittedRevisions(prev => [revision, ...prev]);
      setStats(prev => ({ ...prev, submittedRevisions: prev.submittedRevisions + 1 }));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Open assign modal
  const openAssignModal = async (revision: Revision) => {
    setSelectedRevision(revision);
    setAssignModalOpen(true);
    setLoadingDevelopers(true);
    setSelectedDeveloperId('');

    try {
      const data = await apiGet<{ recommended: SuggestedDeveloper | null; all: SuggestedDeveloper[] }>(
        `/revisions/${revision.id}/suggested-developers`
      );
      setSuggestedDevelopers(data.all || []);
      // Auto-select recommended developer
      if (data.recommended) {
        setSelectedDeveloperId(data.recommended.id);
      }
    } catch (error) {
      console.error('Failed to fetch suggested developers:', error);
    } finally {
      setLoadingDevelopers(false);
    }
  };

  // Assign developer to revision
  const handleAssignDeveloper = async () => {
    if (!selectedRevision || !selectedDeveloperId) return;

    setAssigning(true);
    try {
      await apiPost(`/revisions/${selectedRevision.id}/assign-developer`, {
        developerId: selectedDeveloperId,
      });
      // Remove from pending list
      setPendingRevisions(prev => prev.filter(r => r.id !== selectedRevision.id));
      setStats(prev => ({ ...prev, pendingRevisions: Math.max(0, prev.pendingRevisions - 1) }));
      setAssignModalOpen(false);
      setSelectedRevision(null);
    } catch (error: any) {
      console.error('Failed to assign developer:', error);
      alert(error.response?.data?.message || 'Failed to assign developer');
    } finally {
      setAssigning(false);
    }
  };

  // Mark submitted revision as complete (send to Manager)
  const handleMarkComplete = async (revisionId: string) => {
    setCompletingRevision(revisionId);
    try {
      // Find the revision to get its project ID
      const revision = submittedRevisions.find(r => r.id === revisionId);
      if (!revision) return;

      await apiPost(`/projects/${revision.project.id}/revisions/${revisionId}/complete`, {});

      // Remove from submitted list
      setSubmittedRevisions(prev => prev.filter(r => r.id !== revisionId));
      setStats(prev => ({ ...prev, submittedRevisions: Math.max(0, prev.submittedRevisions - 1) }));
    } catch (error: any) {
      console.error('Failed to mark revision as complete:', error);
      alert(error.response?.data?.message || 'Failed to mark revision as complete');
    } finally {
      setCompletingRevision(null);
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'warning';
      default: return 'secondary';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'default';
      case 'REVIEW': return 'warning';
      case 'COMPLETED': return 'success';
      default: return 'secondary';
    }
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Team Lead Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Manage your team's execution.
        </p>
      </div>

      {/* HIGH PRIORITY: Pending Revisions Alert - RED BOX */}
      {pendingRevisions.length > 0 && (
        <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/50 dark:border-red-700 shadow-lg animate-pulse-slow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              <CardTitle className="text-red-900 dark:text-red-100">
                HIGH PRIORITY: Client Revisions ({pendingRevisions.length})
              </CardTitle>
            </div>
            <CardDescription className="text-red-800 dark:text-red-200">
              These revisions require IMMEDIATE attention. Assign a developer NOW.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="flex items-center justify-between p-4 rounded-lg border-2 border-red-300 dark:border-red-800 bg-white dark:bg-gray-900"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{revision.project.internalName}</h4>
                      <Badge variant="destructive">
                        {revision.status === 'PENDING' ? 'Needs Assignment' : 'In Progress'}
                      </Badge>
                      {revision.isPaid && (
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          Paid Revision
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {revision.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created: {new Date(revision.createdAt).toLocaleDateString()}
                      </span>
                      <span>By: {revision.createdBy.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {revision.status === 'PENDING' && !revision.assignedDeveloperId ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openAssignModal(revision)}
                        className="whitespace-nowrap"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign Developer
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Assigned
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* YELLOW BOX: Submitted Revisions (Developer completed, needs Team Lead review) */}
      {submittedRevisions.length > 0 && (
        <Card className="border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50 dark:border-yellow-600 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              <CardTitle className="text-yellow-900 dark:text-yellow-100">
                Developer Submissions ({submittedRevisions.length})
              </CardTitle>
            </div>
            <CardDescription className="text-yellow-800 dark:text-yellow-200">
              Revisions submitted by developers. Review and mark as complete to send to Manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {submittedRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="p-4 rounded-lg border-2 border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground">{revision.project.internalName}</h4>
                        <Badge variant="warning">Submitted</Badge>
                        {revision.isPaid && (
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Paid Revision
                          </Badge>
                        )}
                      </div>

                      {/* Original revision description */}
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Original Request:</p>
                        <p className="text-sm text-foreground">{revision.description}</p>
                      </div>

                      {/* Developer's submission message */}
                      {revision.developerMessage && (
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Developer's Message:</p>
                          <p className="text-sm text-yellow-900 dark:text-yellow-100">{revision.developerMessage}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Submitted: {revision.submittedAt ? new Date(revision.submittedAt).toLocaleString() : 'N/A'}
                        </span>
                        <span>Created by: {revision.createdBy.name}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link href={`/team-lead/projects/${revision.project.id}`}>
                        <Button variant="outline" size="sm" className="whitespace-nowrap">
                          View Project
                        </Button>
                      </Link>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarkComplete(revision.id)}
                        disabled={completingRevision === revision.id}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                      >
                        {completingRevision === revision.id ? (
                          'Completing...'
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Assigned Projects</p>
            <p className="text-3xl font-bold mt-1">{stats.assignedProjects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Tasks</p>
            <p className="text-3xl font-bold mt-1">{stats.activeTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Reviews</p>
            <p className="text-3xl font-bold mt-1 text-amber-600">{stats.pendingReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Assets</p>
            <p className="text-3xl font-bold mt-1">{stats.pendingAssets}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <Card className="border-2 border-amber-400 bg-amber-100/50 dark:bg-amber-900/30 dark:border-amber-600">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-100">
              Pending Reviews ({pendingReviews.length})
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              Tasks submitted by developers awaiting your approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReviews.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href={`/team-lead/projects/${task.project.id}/tasks/${task.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.project.internalName} • Submitted by {task.assignedTo.name}
                    </p>
                  </div>
                  <Badge variant="warning">Review</Badge>
                </Link>
              ))}
              {pendingReviews.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">
                  And {pendingReviews.length - 5} more pending reviews
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects and Messages Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My Projects</CardTitle>
            <CardDescription>
              Projects assigned to you for execution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <svg
                  className="w-12 h-12 mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="font-medium">No projects assigned</p>
                <p className="text-sm">Projects will appear here when assigned by Manager</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-modern">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/team-lead/projects/${project.id}`}
                    className="block p-4 rounded-lg border bg-card hover:border-primary hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{project.internalName}</h3>
                          <Badge variant={priorityColor(project.priority)}>
                            {project.priority}
                          </Badge>
                          <Badge variant={statusColor(project.status)}>
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.projectType} • {project.complexity}
                          {project.manager && ` • Manager: ${project.manager.name}`}
                          {project.designer && ` • Designer: ${project.designer.name}`}
                        </p>
                        {project.internalDeadline && (
                          <p className="text-xs text-muted-foreground">
                            Deadline: {new Date(project.internalDeadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        View →
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Widget */}
        <MessagesWidget />
      </div>

      {/* Notice */}
      <div className="rounded-lg border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-600 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          <strong>Team Lead Role:</strong> You own execution. Break projects into tasks,
          assign developers, and review work. You can coordinate with Designers for assets.
        </p>
      </div>

      {/* Assign Developer Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Assign Developer to Revision
            </DialogTitle>
            <DialogDescription>
              {selectedRevision && (
                <span>
                  Project: <strong>{selectedRevision.project.internalName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRevision && (
            <div className="space-y-4">
              {/* Revision Details */}
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  Revision Description:
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">
                  {selectedRevision.description}
                </p>
              </div>

              {/* Developer Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Developer:</label>
                {loadingDevelopers ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a developer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suggestedDevelopers.map((dev, index) => (
                        <SelectItem key={dev.id} value={dev.id}>
                          <div className="flex items-center gap-2">
                            <span>{dev.name}</span>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                Recommended
                              </Badge>
                            )}
                            {dev.workedOnProject && (
                              <Badge variant="secondary" className="text-xs">
                                Worked on project
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              ({dev.activeTaskCount} active tasks)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Developer Recommendation Info */}
                {suggestedDevelopers.length > 0 && selectedDeveloperId && (
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const selectedDev = suggestedDevelopers.find(d => d.id === selectedDeveloperId);
                      if (!selectedDev) return null;
                      return (
                        <p>
                          <strong>{selectedDev.name}</strong> - Tier: {selectedDev.tier || 'TRAINEE'} |
                          Active Tasks: {selectedDev.activeTaskCount} |
                          {selectedDev.workedOnProject ? ' Previously worked on this project' : ' New to this project'}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setAssignModalOpen(false)}
                  disabled={assigning}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleAssignDeveloper}
                  disabled={!selectedDeveloperId || assigning}
                >
                  {assigning ? 'Assigning...' : 'Assign Developer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
