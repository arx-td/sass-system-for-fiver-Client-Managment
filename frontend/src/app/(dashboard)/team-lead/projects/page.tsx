'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FolderKanban, Calendar, Users } from 'lucide-react';

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
    requirements: number;
  };
}

export default function TeamLeadProjectsPage() {
  const { user, token } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (priorityFilter !== 'all') params.append('priority', priorityFilter);
        if (search) params.append('search', search);

        const res = await fetch(`/api/v1/projects?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        // Debug: Log response including debug info from backend
        console.log('[TEAM_LEAD_PROJECTS] Response:', data);
        if (data.debug) {
          console.log('[TEAM_LEAD_PROJECTS] Debug info:', data.debug);
        }

        if (data.data) {
          setProjects(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProjects();
    }
  }, [token, statusFilter, priorityFilter, search]);

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
      case 'NEW': return 'secondary';
      case 'REQUIREMENTS_PENDING': return 'outline';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground">
            Projects assigned to you for execution
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FolderKanban className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-medium">No projects assigned</p>
            <p className="text-sm">Projects will appear here when assigned by Manager</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/team-lead/projects/${project.id}`}
            >
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{project.internalName}</h3>
                        <Badge variant={priorityColor(project.priority)}>
                          {project.priority}
                        </Badge>
                        <Badge variant={statusColor(project.status)}>
                          {project.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span>{project.projectType}</span>
                        <span className="hidden md:inline">|</span>
                        <span>{project.complexity}</span>
                        {project.manager && (
                          <>
                            <span className="hidden md:inline">|</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Manager: {project.manager.name}
                            </span>
                          </>
                        )}
                        {project.designer && (
                          <>
                            <span className="hidden md:inline">|</span>
                            <span>Designer: {project.designer.name}</span>
                          </>
                        )}
                      </div>
                      {project.internalDeadline && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Deadline: {formatDate(project.internalDeadline)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {project._count && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{project._count.tasks}</span> tasks
                        </div>
                      )}
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Info notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Team Lead Role:</strong> You own execution. Click on a project to break it into tasks,
          assign developers, and review submitted work.
        </p>
      </div>
    </div>
  );
}
