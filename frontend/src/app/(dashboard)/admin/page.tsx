'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  FolderKanban,
  Building2,
  ClipboardList,
  Settings,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  Globe,
  ExternalLink,
  Pencil,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessagesWidget } from '@/components/messages-widget';
import { apiGet, apiPatch, getErrorMessage } from '@/lib/api';
import { Project, User, PaginatedResponse, AuditLog } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalUsers: number;
  activeUsers: number;
  fiverrAccounts: number;
  pendingRequirements: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalUsers: 0,
    activeUsers: 0,
    fiverrAccounts: 0,
    pendingRequirements: 0,
  });
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [editingDomainValue, setEditingDomainValue] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [projectsRes, usersRes, accountsRes, auditRes, completedRes] = await Promise.all([
        apiGet<PaginatedResponse<Project>>('/projects?limit=5').catch(() => ({ data: [], total: 0 })),
        apiGet<PaginatedResponse<User>>('/users?limit=100').catch(() => ({ data: [], total: 0 })),
        apiGet<{ data: unknown[]; total: number }>('/fiverr-accounts?limit=100').catch(() => ({ data: [], total: 0 })),
        apiGet<PaginatedResponse<AuditLog>>('/audit?limit=10').catch(() => ({ data: [], total: 0 })),
        apiGet<PaginatedResponse<Project>>('/projects?status=COMPLETED&limit=50').catch(() => ({ data: [], total: 0 })),
      ]);

      const projects = projectsRes as PaginatedResponse<Project>;
      const users = usersRes as PaginatedResponse<User>;
      const accounts = accountsRes as { data: unknown[]; total: number };
      const audit = auditRes as PaginatedResponse<AuditLog>;
      const completed = completedRes as PaginatedResponse<Project>;

      setStats({
        totalProjects: projects.total || 0,
        activeProjects: projects.data?.filter(
          (p) => p.status === 'IN_PROGRESS' || p.status === 'REVIEW'
        ).length || 0,
        totalUsers: users.total || 0,
        activeUsers: users.data?.filter((u) => u.status === 'ACTIVE').length || 0,
        fiverrAccounts: accounts.total || 0,
        pendingRequirements: projects.data?.filter(
          (p) => p.status === 'REQUIREMENTS_PENDING'
        ).length || 0,
      });

      setRecentProjects(projects.data || []);
      setRecentActivity(audit.data || []);
      setCompletedProjects(completed.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      icon: FolderKanban,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      href: '/admin/projects',
    },
    {
      label: 'Active Users',
      value: stats.activeUsers,
      subValue: `${stats.totalUsers} total`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      href: '/admin/users',
    },
    {
      label: 'Fiverr Accounts',
      value: stats.fiverrAccounts,
      icon: Building2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      href: '/admin/fiverr-accounts',
    },
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      href: '/admin/projects?status=IN_PROGRESS',
    },
  ];

  const quickActions = [
    {
      label: 'Create Project',
      description: 'Start a new project',
      href: '/admin/projects',
      icon: FolderKanban,
    },
    {
      label: 'Invite User',
      description: 'Add team member',
      href: '/admin/users',
      icon: Users,
    },
    {
      label: 'Manage Accounts',
      description: 'Fiverr accounts',
      href: '/admin/fiverr-accounts',
      icon: Building2,
    },
    {
      label: 'View Audit Logs',
      description: 'System activity',
      href: '/admin/audit-logs',
      icon: ClipboardList,
    },
    {
      label: 'Settings',
      description: 'System config',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800',
      REQUIREMENTS_PENDING: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      REVIEW: 'bg-orange-100 text-orange-800',
      CLIENT_REVIEW: 'bg-indigo-100 text-indigo-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleEditDomain = (project: Project) => {
    setEditingDomainId(project.id);
    setEditingDomainValue(project.domainLink || '');
  };

  const handleCancelEdit = () => {
    setEditingDomainId(null);
    setEditingDomainValue('');
  };

  const handleSaveDomain = async (projectId: string) => {
    try {
      setSavingDomain(true);
      await apiPatch(`/projects/${projectId}`, { domainLink: editingDomainValue });
      setCompletedProjects(prev =>
        prev.map(p =>
          p.id === projectId ? { ...p, domainLink: editingDomainValue } : p
        )
      );
      setEditingDomainId(null);
      setEditingDomainValue('');
      toast.success('Domain link updated successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingDomain(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Here's your system overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <a key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <div className={cn('rounded-full p-2', stat.bgColor)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.subValue && (
                  <p className="text-xs text-muted-foreground">
                    {stat.subValue}
                  </p>
                )}
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickActions.map((action) => (
              <a key={action.label} href={action.href}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-4 transition-colors',
                    'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Three Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Projects</CardTitle>
            <a
              href="/admin/projects"
              className="text-sm text-primary hover:underline"
            >
              View all
            </a>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects yet</p>
                <a
                  href="/admin/projects"
                  className="text-sm text-primary hover:underline mt-2"
                >
                  Create your first project
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{project.internalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.projectType} • {project.manager?.name || 'Unassigned'}
                      </p>
                    </div>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <a
              href="/admin/audit-logs"
              className="text-sm text-primary hover:underline"
            >
              View all
            </a>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="rounded-full bg-muted p-2">
                      <Activity className="h-3 w-3" />
                    </div>
                    <div className="flex-1">
                      <p>
                        <span className="font-medium">
                          {log.user?.name || 'System'}
                        </span>{' '}
                        {log.action.toLowerCase()} {log.entityType}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Widget */}
        <MessagesWidget />
      </div>

      {/* Completed Projects Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Completed Projects</CardTitle>
            <Badge variant="secondary">{completedProjects.length}</Badge>
          </div>
          <a
            href="/admin/projects?status=COMPLETED"
            className="text-sm text-primary hover:underline"
          >
            View all
          </a>
        </CardHeader>
        <CardContent>
          {completedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No completed projects yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{project.internalName}</p>
                      <Badge className="bg-green-100 text-green-800">Completed</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {project.projectType} • {project.fiverrAccount?.accountName || 'N/A'}
                    </p>
                    {/* Domain Link Display/Edit */}
                    <div className="mt-2 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {editingDomainId === project.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingDomainValue}
                            onChange={(e) => setEditingDomainValue(e.target.value)}
                            placeholder="https://example.com"
                            className="h-8 text-sm max-w-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveDomain(project.id)}
                            disabled={savingDomain}
                            className="h-8 w-8 p-0"
                          >
                            {savingDomain ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={savingDomain}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {project.domainLink ? (
                            <>
                              <a
                                href={project.domainLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {project.domainLink}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditDomain(project)}
                                className="h-6 w-6 p-0"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditDomain(project)}
                              className="h-7 text-xs"
                            >
                              <Globe className="h-3 w-3 mr-1" />
                              Add Domain Link
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Team Lead: {project.teamLead?.name || 'N/A'}</p>
                    <p>Manager: {project.manager?.name || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {stats.pendingRequirements > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                {stats.pendingRequirements} project(s) pending requirements
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-300">
                These projects need requirements to be written by their assigned managers.
              </p>
            </div>
            <a href="/admin/projects?status=REQUIREMENTS_PENDING">
              <Badge variant="outline" className="cursor-pointer">
                View Projects
              </Badge>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
