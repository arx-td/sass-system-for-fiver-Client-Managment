'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Users,
  Loader2,
  Calendar,
  DollarSign,
  Trash2,
  AlertTriangle,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPatch, apiDelete, getErrorMessage } from '@/lib/api';
import {
  Project,
  FiverrAccount,
  User,
  PaginatedResponse,
  ProjectStatus,
  ProjectComplexity,
  ProjectPriority,
} from '@/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<ProjectStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  REQUIREMENTS_PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  CLIENT_REVIEW: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ON_HOLD: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const priorityColors: Record<ProjectPriority, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [fiverrAccounts, setFiverrAccounts] = useState<FiverrAccount[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [designers, setDesigners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const [formData, setFormData] = useState({
    internalName: '',
    fiverrAccountId: '',
    projectType: '',
    complexity: 'MEDIUM' as ProjectComplexity,
    priority: 'MEDIUM' as ProjectPriority,
    internalDeadline: '',
    fiverrDeadline: '',
    budget: '',
    meetingLink: '',
    stagingLink: '',
    stagingPassword: '',
    clientEmail: '',
    clientUsername: '',
    managerId: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchFiverrAccounts();
    fetchManagers();
    fetchDesigners();
  }, [page, statusFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiGet<PaginatedResponse<Project>>(
        `/projects?${params.toString()}`
      );
      setProjects(response.data);
      setTotalPages(response.totalPages);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchFiverrAccounts = async () => {
    try {
      const response = await apiGet<PaginatedResponse<FiverrAccount>>(
        '/fiverr-accounts?limit=100'
      );
      setFiverrAccounts(response.data.filter((a) => a.isActive));
    } catch (error) {
      console.error('Failed to fetch Fiverr accounts:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await apiGet<PaginatedResponse<User>>(
        '/users?role=MANAGER&status=ACTIVE&limit=100'
      );
      setManagers(response.data);
    } catch (error) {
      console.error('Failed to fetch managers:', error);
    }
  };

  const fetchDesigners = async () => {
    try {
      const response = await apiGet<PaginatedResponse<User>>(
        '/users?role=DESIGNER&status=ACTIVE&limit=100'
      );
      setDesigners(response.data);
    } catch (error) {
      console.error('Failed to fetch designers:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.internalName || !formData.fiverrAccountId || !formData.projectType) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      setCreating(true);
      const payload: Record<string, unknown> = {
        internalName: formData.internalName,
        fiverrAccountId: formData.fiverrAccountId,
        projectType: formData.projectType,
        complexity: formData.complexity,
        priority: formData.priority,
      };

      if (formData.internalDeadline) {
        payload.internalDeadline = new Date(formData.internalDeadline).toISOString();
      }
      if (formData.fiverrDeadline) {
        payload.fiverrDeadline = new Date(formData.fiverrDeadline).toISOString();
      }
      if (formData.budget) payload.budget = formData.budget;
      if (formData.meetingLink) payload.meetingLink = formData.meetingLink;
      if (formData.stagingLink) payload.stagingLink = formData.stagingLink;
      if (formData.stagingPassword) payload.stagingPassword = formData.stagingPassword;
      if (formData.clientEmail) payload.clientEmail = formData.clientEmail;
      if (formData.clientUsername) payload.clientUsername = formData.clientUsername;
      if (formData.managerId) payload.managerId = formData.managerId;

      await apiPost('/projects', payload);
      toast.success('Project created successfully');
      setCreateDialogOpen(false);
      setFormData({
        internalName: '',
        fiverrAccountId: '',
        projectType: '',
        complexity: 'MEDIUM',
        priority: 'MEDIUM',
        internalDeadline: '',
        fiverrDeadline: '',
        budget: '',
        meetingLink: '',
        stagingLink: '',
        stagingPassword: '',
        clientEmail: '',
        clientUsername: '',
        managerId: '',
      });
      fetchProjects();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  // Edit form data state
  const [editFormData, setEditFormData] = useState({
    internalName: '',
    projectType: '',
    complexity: 'MEDIUM' as ProjectComplexity,
    priority: 'MEDIUM' as ProjectPriority,
    internalDeadline: '',
    fiverrDeadline: '',
    budget: '',
    meetingLink: '',
    stagingLink: '',
    stagingPassword: '',
    clientEmail: '',
    clientUsername: '',
    status: 'NEW' as ProjectStatus,
    designerId: '',
  });

  // Open edit dialog with project data
  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setEditFormData({
      internalName: project.internalName,
      projectType: project.projectType,
      complexity: project.complexity,
      priority: project.priority,
      internalDeadline: project.internalDeadline
        ? new Date(project.internalDeadline).toISOString().split('T')[0]
        : '',
      fiverrDeadline: project.fiverrDeadline
        ? new Date(project.fiverrDeadline).toISOString().split('T')[0]
        : '',
      budget: project.budget || '',
      meetingLink: project.meetingLink || '',
      stagingLink: project.stagingLink || '',
      stagingPassword: project.stagingPassword || '',
      clientEmail: project.clientEmail || '',
      clientUsername: project.clientUsername || '',
      status: project.status,
      designerId: project.designer?.id || '',
    });
    setEditDialogOpen(true);
  };

  // Handle edit project
  const handleEdit = async () => {
    if (!selectedProject) return;

    if (!editFormData.internalName || !editFormData.projectType) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      setEditing(true);
      const payload: Record<string, unknown> = {
        internalName: editFormData.internalName,
        projectType: editFormData.projectType,
        complexity: editFormData.complexity,
        priority: editFormData.priority,
        status: editFormData.status,
      };

      if (editFormData.internalDeadline) {
        payload.internalDeadline = new Date(editFormData.internalDeadline).toISOString();
      }
      if (editFormData.fiverrDeadline) {
        payload.fiverrDeadline = new Date(editFormData.fiverrDeadline).toISOString();
      }
      if (editFormData.budget) payload.budget = editFormData.budget;
      if (editFormData.meetingLink) payload.meetingLink = editFormData.meetingLink;
      payload.stagingLink = editFormData.stagingLink || '';
      payload.stagingPassword = editFormData.stagingPassword || '';
      payload.clientEmail = editFormData.clientEmail || '';
      payload.clientUsername = editFormData.clientUsername || '';
      if (editFormData.designerId) payload.designerId = editFormData.designerId;

      await apiPatch(`/projects/${selectedProject.id}`, payload);
      toast.success('Project updated successfully');
      setEditDialogOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEditing(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  // Handle delete project
  const handleDelete = async () => {
    if (!projectToDelete) return;

    try {
      setDeleting(true);
      const response = await apiDelete<{ success: boolean; message: string }>(
        `/projects/${projectToDelete.id}`
      );
      toast.success(response.message || 'Project deleted successfully');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      fetchProjects();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.internalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage all projects across Fiverr accounts
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Fill in the project details to create a new project.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto scrollbar-modern">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="internalName">Internal Project Name *</Label>
                  <Input
                    id="internalName"
                    placeholder="e.g., PROJ-001-ClientName"
                    value={formData.internalName}
                    onChange={(e) =>
                      setFormData({ ...formData, internalName: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="projectType">Project Type *</Label>
                  <Input
                    id="projectType"
                    placeholder="e.g., WordPress, E-commerce"
                    value={formData.projectType}
                    onChange={(e) =>
                      setFormData({ ...formData, projectType: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fiverrAccount">Fiverr Account *</Label>
                  <Select
                    value={formData.fiverrAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fiverrAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {fiverrAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manager">Assign Manager</Label>
                  <Select
                    value={formData.managerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, managerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="complexity">Complexity</Label>
                  <Select
                    value={formData.complexity}
                    onValueChange={(value: ProjectComplexity) =>
                      setFormData({ ...formData, complexity: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIMPLE">Simple</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="COMPLEX">Complex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: ProjectPriority) =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="internalDeadline">Internal Deadline</Label>
                  <Input
                    id="internalDeadline"
                    type="date"
                    value={formData.internalDeadline}
                    onChange={(e) =>
                      setFormData({ ...formData, internalDeadline: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fiverrDeadline">Fiverr Deadline</Label>
                  <Input
                    id="fiverrDeadline"
                    type="date"
                    value={formData.fiverrDeadline}
                    onChange={(e) =>
                      setFormData({ ...formData, fiverrDeadline: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget (Admin Only)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="budget"
                      placeholder="0.00"
                      value={formData.budget}
                      onChange={(e) =>
                        setFormData({ ...formData, budget: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="meetingLink">Meeting Link</Label>
                  <Input
                    id="meetingLink"
                    placeholder="https://..."
                    value={formData.meetingLink}
                    onChange={(e) =>
                      setFormData({ ...formData, meetingLink: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stagingLink">Staging/Dev Site Link</Label>
                  <Input
                    id="stagingLink"
                    placeholder="https://staging.example.com"
                    value={formData.stagingLink}
                    onChange={(e) =>
                      setFormData({ ...formData, stagingLink: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stagingPassword">Staging Password</Label>
                  <Input
                    id="stagingPassword"
                    type="password"
                    placeholder="Password for staging access"
                    value={formData.stagingPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, stagingPassword: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="clientEmail">Client Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="clientEmail"
                      type="email"
                      placeholder="client@example.com"
                      value={formData.clientEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, clientEmail: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="clientUsername">Client Username</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="clientUsername"
                      placeholder="fiverr_username"
                      value={formData.clientUsername}
                      onChange={(e) =>
                        setFormData({ ...formData, clientUsername: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="REQUIREMENTS_PENDING">Requirements Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="REVIEW">Review</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Fiverr Account</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No projects found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{project.internalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.projectType}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.fiverrAccount?.accountName || '-'}
                  </TableCell>
                  <TableCell>
                    {project.manager?.name || (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[project.status]}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[project.priority]}>
                      {project.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.internalDeadline ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(project.internalDeadline)}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {project.budget ? (
                      <span className="font-medium">${project.budget}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/admin/projects/${project.id}`)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(project)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/admin/projects/${project.id}`)
                          }
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Manage Team
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(project)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto scrollbar-modern">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-internalName">Internal Project Name *</Label>
                <Input
                  id="edit-internalName"
                  placeholder="e.g., PROJ-001-ClientName"
                  value={editFormData.internalName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, internalName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-projectType">Project Type *</Label>
                <Input
                  id="edit-projectType"
                  placeholder="e.g., WordPress, E-commerce"
                  value={editFormData.projectType}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, projectType: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value: ProjectStatus) =>
                    setEditFormData({ ...editFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="REQUIREMENTS_PENDING">Requirements Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="REVIEW">Review</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select
                  value={editFormData.priority}
                  onValueChange={(value: ProjectPriority) =>
                    setEditFormData({ ...editFormData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-complexity">Complexity</Label>
                <Select
                  value={editFormData.complexity}
                  onValueChange={(value: ProjectComplexity) =>
                    setEditFormData({ ...editFormData, complexity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="COMPLEX">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-budget">Budget (Admin Only)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-budget"
                    placeholder="0.00"
                    value={editFormData.budget}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, budget: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-internalDeadline">Internal Deadline</Label>
                <Input
                  id="edit-internalDeadline"
                  type="date"
                  value={editFormData.internalDeadline}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, internalDeadline: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-fiverrDeadline">Fiverr Deadline</Label>
                <Input
                  id="edit-fiverrDeadline"
                  type="date"
                  value={editFormData.fiverrDeadline}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, fiverrDeadline: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-meetingLink">Meeting Link</Label>
                <Input
                  id="edit-meetingLink"
                  placeholder="https://..."
                  value={editFormData.meetingLink}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, meetingLink: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-designer">Designer</Label>
                <Select
                  value={editFormData.designerId || '__none__'}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, designerId: value === '__none__' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {designers.map((designer) => (
                      <SelectItem key={designer.id} value={designer.id}>
                        {designer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-stagingLink">Staging/Dev Site Link</Label>
                <Input
                  id="edit-stagingLink"
                  placeholder="https://staging.example.com"
                  value={editFormData.stagingLink}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, stagingLink: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-stagingPassword">Staging Password</Label>
                <Input
                  id="edit-stagingPassword"
                  type="password"
                  placeholder="Password for staging access"
                  value={editFormData.stagingPassword}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, stagingPassword: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-clientEmail">Client Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-clientEmail"
                    type="email"
                    placeholder="client@example.com"
                    value={editFormData.clientEmail}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, clientEmail: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-clientUsername">Client Username</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-clientUsername"
                    placeholder="fiverr_username"
                    value={editFormData.clientUsername}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, clientUsername: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {projectToDelete && (
            <div className="py-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                <p className="font-medium text-red-800 dark:text-red-200">
                  {projectToDelete.internalName}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Type: {projectToDelete.projectType}
                </p>
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  This will permanently delete all associated:
                </p>
                <ul className="mt-1 list-inside list-disc text-sm text-red-600 dark:text-red-400">
                  <li>Tasks</li>
                  <li>Requirements</li>
                  <li>Design assets</li>
                  <li>Revisions</li>
                  <li>Chat messages</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
