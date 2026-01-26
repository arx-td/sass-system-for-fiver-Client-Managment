'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ArrowLeft, Play, Send, Eye } from 'lucide-react';
import { toast } from 'sonner';

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

export default function DeveloperTasksPage() {
  const { user, token } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
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
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
        toast.error('Failed to fetch tasks');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchTasks();
    }
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
        toast.success('Task started');
      } else {
        toast.error('Failed to start task');
      }
    } catch (error) {
      console.error('Failed to start task:', error);
      toast.error('Failed to start task');
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
        toast.success('Task submitted for review');
      } else {
        toast.error('Failed to submit task');
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      toast.error('Failed to submit task');
    } finally {
      setActionLoading(null);
    }
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project.internalName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/developer">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">
            View and manage all your assigned tasks
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('ASSIGNED')}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'ASSIGNED').length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('IN_PROGRESS')}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'IN_PROGRESS').length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('SUBMITTED')}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold text-amber-600">{tasks.filter(t => t.status === 'SUBMITTED').length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('APPROVED')}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'APPROVED').length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('REJECTED')}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{tasks.filter(t => t.status === 'REJECTED').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
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
            <p className="font-medium text-muted-foreground">No tasks found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Tasks will appear here when assigned by Team Lead'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={task.status === 'REJECTED' ? 'border-red-200 dark:border-red-800' : ''}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{task.title}</h3>
                      <Badge variant={statusColor(task.status)}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                      {task.priority > 7 && (
                        <Badge variant="destructive">High Priority</Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </p>
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
                    <Link href={`/developer/tasks/${task.id}?projectId=${task.project.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    {task.status === 'ASSIGNED' && (
                      <Button
                        size="sm"
                        onClick={() => handleStartWork(task)}
                        disabled={actionLoading === task.id}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {actionLoading === task.id ? 'Starting...' : 'Start'}
                      </Button>
                    )}
                    {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && (
                      <Button
                        size="sm"
                        onClick={() => handleSubmitWork(task)}
                        disabled={actionLoading === task.id}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {actionLoading === task.id ? 'Submitting...' : 'Submit'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Task Count */}
      <div className="text-center text-sm text-muted-foreground">
        Showing {filteredTasks.length} of {tasks.length} tasks
      </div>
    </div>
  );
}
