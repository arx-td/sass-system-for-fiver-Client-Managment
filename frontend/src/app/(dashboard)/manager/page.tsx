'use client';

import { useState, useEffect } from 'react';
import {
  FolderKanban,
  Clock,
  Users,
  FileText,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesWidget } from '@/components/messages-widget';
import { apiGet, apiPost, getErrorMessage } from '@/lib/api';
import { Project, PaginatedResponse } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  REQUIREMENTS_PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  CLIENT_REVIEW: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ON_HOLD: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const priorityColors: Record<string, string> = {
  LOW: 'border-gray-300',
  MEDIUM: 'border-blue-300',
  HIGH: 'border-orange-300',
  URGENT: 'border-red-400',
};

interface CompletedRevision {
  id: string;
  description: string;
  status: string;
  isPaid: boolean;
  developerMessage?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  project: {
    id: string;
    internalName: string;
    priority: string;
  };
  createdBy: {
    id: string;
    name: string;
  };
}

export default function ManagerDashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [completedRevisions, setCompletedRevisions] = useState<CompletedRevision[]>([]);
  const [acceptingRevision, setAcceptingRevision] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchCompletedRevisions();
  }, []);

  const fetchCompletedRevisions = async () => {
    try {
      const data = await apiGet<CompletedRevision[]>('/revisions/completed');
      setCompletedRevisions(data || []);
    } catch (error) {
      console.error('Failed to fetch completed revisions:', error);
    }
  };

  const handleAcceptRevision = async (revisionId: string) => {
    setAcceptingRevision(revisionId);
    try {
      await apiPost(`/revisions/${revisionId}/accept`, {});
      // Remove from the list after acceptance
      setCompletedRevisions((prev) => prev.filter((r) => r.id !== revisionId));
      toast.success('Revision accepted! Admin has been notified.');
    } catch (error) {
      console.error('Failed to accept revision:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setAcceptingRevision(null);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // Fetch manager's dashboard data
      const response = await apiGet<{
        pendingProjects: Project[];
        activeProjects: Project[];
      }>('/projects/manager/dashboard');

      setPendingProjects(response.pendingProjects || []);
      setActiveProjects(response.activeProjects || []);
    } catch (error) {
      // Fallback to regular projects endpoint if dashboard doesn't exist
      try {
        const projects = await apiGet<PaginatedResponse<Project>>(
          '/projects?limit=50'
        );
        const pending = projects.data.filter(
          (p) =>
            !p.teamLeadId ||
            p.status === 'NEW' ||
            p.status === 'REQUIREMENTS_PENDING'
        );
        const active = projects.data.filter(
          (p) =>
            p.teamLeadId &&
            (p.status === 'IN_PROGRESS' || p.status === 'REVIEW')
        );
        setPendingProjects(pending);
        setActiveProjects(active);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <a
      href={`/manager/projects/${project.id}`}
      className={cn(
        'block rounded-lg border-l-4 bg-card p-4 shadow-sm hover:shadow-md transition-shadow',
        priorityColors[project.priority] || 'border-gray-300'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold">{project.internalName}</h3>
          <p className="text-sm text-muted-foreground">{project.projectType}</p>
        </div>
        <Badge className={statusColors[project.status]}>
          {project.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
        {project.fiverrAccount && (
          <span className="flex items-center gap-1">
            <FolderKanban className="h-3 w-3" />
            {project.fiverrAccount.accountName}
          </span>
        )}
        {project.teamLead ? (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {project.teamLead.name}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-yellow-600">
            <AlertCircle className="h-3 w-3" />
            No Team Lead
          </span>
        )}
        {project.internalDeadline && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(project.internalDeadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {project.complexity}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {project.priority}
          </Badge>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </a>
  );

  const EmptyState = ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
  }) => (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <Icon className="w-12 h-12 mb-4 opacity-50" />
      <p className="font-medium">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Manage your projects below.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Projects
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingProjects.length}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingProjects.length + activeProjects.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned to you
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Urgent
            </CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...pendingProjects, ...activeProjects].filter(
                (p) => p.priority === 'URGENT'
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GREEN BOX: Completed Revisions (needs Manager acceptance) */}
      {completedRevisions.length > 0 && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/50 dark:border-green-700 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <CardTitle className="text-green-900 dark:text-green-100">
                Completed Revisions ({completedRevisions.length})
              </CardTitle>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200">
              These revisions have been completed by the team. Review and accept to notify the Admin.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="p-4 rounded-lg border-2 border-green-300 dark:border-green-700 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground">{revision.project.internalName}</h4>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                          Completed
                        </Badge>
                        {revision.isPaid && (
                          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Paid Revision
                          </Badge>
                        )}
                      </div>

                      {/* Original revision description */}
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Original Request:</p>
                        <p className="text-sm text-foreground">{revision.description}</p>
                      </div>

                      {/* Developer's completion message */}
                      {revision.developerMessage && (
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded border border-green-300 dark:border-green-700">
                          <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">Developer&apos;s Completion Note:</p>
                          <p className="text-sm text-green-900 dark:text-green-100">{revision.developerMessage}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created: {new Date(revision.createdAt).toLocaleDateString()}
                        </span>
                        {revision.submittedAt && (
                          <span>Completed: {new Date(revision.submittedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <a href={`/manager/projects/${revision.project.id}`}>
                        <Button variant="outline" size="sm" className="whitespace-nowrap">
                          View Project
                        </Button>
                      </a>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAcceptRevision(revision.id)}
                        disabled={acceptingRevision === revision.id}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                      >
                        {acceptingRevision === revision.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
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

      {/* Three-Section Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Section A: Pending Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <CardTitle className="text-lg">Pending Projects</CardTitle>
              </div>
              <Badge variant="secondary">{pendingProjects.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Projects needing Team Lead assignment or requirements
            </p>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-modern">
            {pendingProjects.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All caught up!"
                description="No pending projects at the moment"
              />
            ) : (
              pendingProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Section B: Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <CardTitle className="text-lg">Active Projects</CardTitle>
              </div>
              <Badge variant="secondary">{activeProjects.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Projects with Team Lead assigned and in progress
            </p>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-modern">
            {activeProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No active projects"
                description="Assign Team Leads to move projects here"
              />
            ) : (
              activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Messages Widget */}
        <MessagesWidget />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <a href="/manager/projects">
              <Button variant="outline" className="w-full justify-start">
                <FolderKanban className="mr-2 h-4 w-4" />
                All Projects
              </Button>
            </a>
            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="mr-2 h-4 w-4" />
              Requirements (Coming Soon)
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
