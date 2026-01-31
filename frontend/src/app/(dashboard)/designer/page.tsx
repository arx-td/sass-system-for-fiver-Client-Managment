'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, ExternalLink, Info, FolderKanban, Clock, ArrowRight } from 'lucide-react';
import { MessagesWidget } from '@/components/messages-widget';

interface Asset {
  id: string;
  name: string;
  assetType: string;
  description: string | null;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  project: {
    id: string;
    internalName: string;
  };
  requestedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Project {
  id: string;
  internalName: string;
  projectType: string;
  status: string;
  complexity: string;
  priority: string;
  internalDeadline: string | null;
  teamLead: {
    id: string;
    name: string;
  } | null;
  _count?: {
    assets: number;
  };
}

export default function DesignerDashboardPage() {
  const { user, token } = useAuthStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [uploadData, setUploadData] = useState({
    fileUrl: '',
    fileName: '',
    fileSize: 0,
  });
  const [uploading, setUploading] = useState(false);

  const stats = {
    requested: assets.filter(a => a.status === 'REQUESTED').length,
    inProgress: assets.filter(a => a.status === 'IN_PROGRESS').length,
    submitted: assets.filter(a => a.status === 'SUBMITTED').length,
    approved: assets.filter(a => a.status === 'APPROVED').length,
    rejected: assets.filter(a => a.status === 'REJECTED').length,
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all assets assigned to the designer
        const [assetsRes, projectsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/my-queue`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const assetsData = await assetsRes.json();
        const projectsData = await projectsRes.json();

        setAssets(assetsData.data || []);
        setProjects(projectsData.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const handleStartWork = async (asset: Asset) => {
    setActionLoading(asset.id);
    try {
      const res = await fetch(`/api/v1/projects/${asset.project.id}/assets/${asset.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAssets(assets.map(a => a.id === asset.id ? { ...a, status: 'IN_PROGRESS' } : a));
      }
    } catch (error) {
      console.error('Failed to start work:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const openUploadDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setUploadData({ fileUrl: '', fileName: '', fileSize: 0 });
    setUploadDialogOpen(true);
  };

  const handleSubmitAsset = async () => {
    if (!selectedAsset || !uploadData.fileUrl || !uploadData.fileName) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/v1/projects/${selectedAsset.project.id}/assets/${selectedAsset.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(uploadData),
      });

      if (res.ok) {
        setAssets(assets.map(a =>
          a.id === selectedAsset.id
            ? { ...a, status: 'SUBMITTED', fileUrl: uploadData.fileUrl, fileName: uploadData.fileName }
            : a
        ));
        setUploadDialogOpen(false);
        setSelectedAsset(null);
      }
    } catch (error) {
      console.error('Failed to submit asset:', error);
    } finally {
      setUploading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'SUBMITTED': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const pendingAssets = assets.filter(a => ['REQUESTED', 'IN_PROGRESS', 'REJECTED'].includes(a.status));
  const submittedAssets = assets.filter(a => a.status === 'SUBMITTED');
  const completedAssets = assets.filter(a => a.status === 'APPROVED');

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
        <h1 className="text-2xl font-bold tracking-tight">Designer Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Manage your design assets.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Requested</p>
            <p className="text-3xl font-bold mt-1">{stats.requested}</p>
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

      {/* Rejected Assets Alert */}
      {stats.rejected > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Attention:</strong> You have {stats.rejected} rejected asset(s) that need to be reworked and resubmitted.
          </p>
        </div>
      )}

      {/* Assigned Projects Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-pink-600" />
              <CardTitle className="text-lg">Assigned Projects</CardTitle>
            </div>
            <Badge variant="secondary">{projects.length} Projects</Badge>
          </div>
          <CardDescription>
            Projects where you are attached as the designer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-muted-foreground">No projects assigned</p>
              <p className="text-sm text-muted-foreground">
                You will see projects here when assigned by Admin
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/designer/projects/${project.id}`}
                  className="block"
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-pink-500 h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {project.internalName}
                        </h4>
                        <Badge
                          variant={
                            project.status === 'IN_PROGRESS'
                              ? 'default'
                              : project.status === 'COMPLETED'
                              ? 'success'
                              : project.status === 'REVIEW'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-xs shrink-0"
                        >
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <span className="font-medium">Type:</span> {project.projectType}
                        </p>
                        {project.teamLead && (
                          <p className="flex items-center gap-1">
                            <span className="font-medium">Lead:</span> {project.teamLead.name}
                          </p>
                        )}
                        {project.internalDeadline && (
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(project.internalDeadline).toLocaleDateString()}
                          </p>
                        )}
                        {project._count?.assets !== undefined && (
                          <p className="flex items-center gap-1">
                            <span className="font-medium">Assets:</span> {project._count.assets}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-end mt-3 text-xs text-pink-600 dark:text-pink-400">
                        <span>View Project</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets and Messages Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assets Tabs */}
        <div className="lg:col-span-2 w-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="tabs-scroll-container">
              <TabsList className="w-max sm:w-auto">
                <TabsTrigger value="pending" className="text-xs sm:text-sm">
                  Pending ({pendingAssets.length})
                </TabsTrigger>
                <TabsTrigger value="submitted" className="text-xs sm:text-sm">
                  Submitted ({submittedAssets.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs sm:text-sm">
                  Completed ({completedAssets.length})
                </TabsTrigger>
              </TabsList>
            </div>

        {/* Pending Assets */}
        <TabsContent value="pending" className="space-y-4">
          {pendingAssets.length === 0 ? (
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
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="font-medium text-muted-foreground">No pending assets</p>
                <p className="text-sm text-muted-foreground">
                  Asset requests will appear here when created by Team Leads
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingAssets.map((asset) => (
                <Card key={asset.id} className={asset.status === 'REJECTED' ? 'border-red-200 dark:border-red-800' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{asset.name}</h3>
                          <Badge variant="outline">{asset.assetType}</Badge>
                          <Badge variant={statusColor(asset.status)}>
                            {asset.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {asset.description && (
                          <p className="text-sm text-muted-foreground">{asset.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Project:{' '}
                          <Link href={`/designer/projects/${asset.project.id}`} className="text-blue-600 hover:underline">
                            {asset.project.internalName}
                          </Link>{' '}
                          • Requested by: {asset.requestedBy.name}
                        </p>
                        {asset.status === 'REJECTED' && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            This asset was rejected. Please review and resubmit.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/designer/projects/${asset.project.id}`}>
                          <Button size="sm" variant="ghost" title="Chat with team">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </Link>
                        {asset.status === 'REQUESTED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartWork(asset)}
                            disabled={actionLoading === asset.id}
                          >
                            {actionLoading === asset.id ? 'Starting...' : 'Start Work'}
                          </Button>
                        )}
                        {(asset.status === 'IN_PROGRESS' || asset.status === 'REJECTED') && (
                          <Button
                            size="sm"
                            onClick={() => openUploadDialog(asset)}
                          >
                            Upload & Submit
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

        {/* Submitted Assets */}
        <TabsContent value="submitted" className="space-y-4">
          {submittedAssets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="font-medium text-muted-foreground">No submitted assets</p>
                <p className="text-sm text-muted-foreground">
                  Assets awaiting review will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submittedAssets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{asset.name}</h3>
                          <Badge variant="outline">{asset.assetType}</Badge>
                          <Badge variant="warning">Awaiting Review</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Project:{' '}
                          <Link href={`/designer/projects/${asset.project.id}`} className="text-blue-600 hover:underline">
                            {asset.project.internalName}
                          </Link>{' '}
                          • Submitted for Team Lead review
                        </p>
                        {asset.fileUrl && (
                          <a
                            href={asset.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View: {asset.fileName}
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Assets */}
        <TabsContent value="completed" className="space-y-4">
          {completedAssets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48">
                <p className="font-medium text-muted-foreground">No completed assets</p>
                <p className="text-sm text-muted-foreground">
                  Approved assets will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedAssets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{asset.name}</h3>
                          <Badge variant="outline">{asset.assetType}</Badge>
                          <Badge variant="success">Approved</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Project:{' '}
                          <Link href={`/designer/projects/${asset.project.id}`} className="text-blue-600 hover:underline">
                            {asset.project.internalName}
                          </Link>
                        </p>
                        {asset.fileUrl && (
                          <a
                            href={asset.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View: {asset.fileName}
                          </a>
                        )}
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
      <div className="rounded-lg border-2 border-blue-400 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-600 p-4 mt-6 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          <strong>Designer Role:</strong> Provide visual assets. Upload logos, banners,
          and images. Your approved assets will be available to developers.
        </p>
      </div>
        </div>

        {/* Messages Widget */}
        <MessagesWidget />
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>
              Upload the design asset for "{selectedAsset?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fileUrl">File URL</Label>
              <Input
                id="fileUrl"
                value={uploadData.fileUrl}
                onChange={(e) => setUploadData({ ...uploadData, fileUrl: e.target.value })}
                placeholder="https://example.com/asset.png"
              />
              <p className="text-xs text-muted-foreground">
                Upload your file to a cloud storage and paste the URL here
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={uploadData.fileName}
                onChange={(e) => setUploadData({ ...uploadData, fileName: e.target.value })}
                placeholder="logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileSize">File Size (bytes)</Label>
              <Input
                id="fileSize"
                type="number"
                value={uploadData.fileSize}
                onChange={(e) => setUploadData({ ...uploadData, fileSize: parseInt(e.target.value) || 0 })}
                placeholder="1024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAsset}
              disabled={uploading || !uploadData.fileUrl || !uploadData.fileName}
            >
              {uploading ? 'Submitting...' : 'Submit Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
