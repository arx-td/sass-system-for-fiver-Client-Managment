'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  AlertTriangle,
  Upload,
  Loader2,
  X,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';

interface TaskAttachment {
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

interface UploadedFile {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: TaskAttachment[];
  submissionNote?: string;
  submissionAttachments?: TaskAttachment[];
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
  assignedBy: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    internalName: string;
  };
}

export default function TeamLeadTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionAttachments, setRejectionAttachments] = useState<UploadedFile[]>([]);
  const [uploadingRejectionFile, setUploadingRejectionFile] = useState(false);
  const rejectionFileInputRef = useRef<HTMLInputElement>(null);
  const rejectionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const projectId = params.id as string;
  const taskId = params.taskId as string;

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch task');
        }

        const data = await response.json();
        setTask(data);
      } catch (error) {
        console.error('Failed to fetch task:', error);
        toast.error('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    if (token && projectId && taskId) {
      fetchTask();
    }
  }, [token, projectId, taskId]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTask(updatedTask);
        toast.success('Task approved successfully');
      } else {
        const errorData = await response.json();
        console.error('Approve error:', errorData);
        toast.error(errorData.message || 'Failed to approve task');
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
      toast.error('Failed to approve task');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim() && rejectionAttachments.length === 0) {
      toast.error('Please provide feedback or attach reference files');
      return;
    }

    setRejecting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note: rejectionNote || undefined,
          attachments: rejectionAttachments.length > 0
            ? rejectionAttachments.map((f) => ({
                url: f.url,
                fileName: f.originalName,
                mimeType: f.mimeType,
                size: f.size,
              }))
            : undefined,
        }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTask(updatedTask);
        setShowRejectForm(false);
        setRejectionNote('');
        setRejectionAttachments([]);
        toast.success('Feedback sent - Developer has been notified');
      } else {
        toast.error('Failed to send feedback');
      }
    } catch (error) {
      console.error('Failed to reject task:', error);
      toast.error('Failed to send feedback');
    } finally {
      setRejecting(false);
    }
  };

  // Handle rejection file upload
  const handleRejectionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingRejectionFile(true);
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
        setRejectionAttachments((prev) => [...prev, uploadedFile]);
      }
      toast.success('File(s) uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingRejectionFile(false);
      if (rejectionFileInputRef.current) {
        rejectionFileInputRef.current.value = '';
      }
    }
  };

  // Handle paste for images in rejection textarea
  const handleRejectionPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setUploadingRejectionFile(true);
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
          setRejectionAttachments((prev) => [...prev, uploadedFile]);
          toast.success('Image pasted and uploaded');
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          toast.error('Failed to upload pasted image');
        } finally {
          setUploadingRejectionFile(false);
        }
        break;
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      ASSIGNED: { variant: 'secondary', label: 'Assigned' },
      IN_PROGRESS: { variant: 'default', label: 'In Progress' },
      SUBMITTED: { variant: 'outline', label: 'Submitted for Review' },
      APPROVED: { variant: 'default', label: 'Approved' },
      REJECTED: { variant: 'destructive', label: 'Rejected' },
    };
    const { variant, label } = config[status] || { variant: 'secondary', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge variant="destructive">High Priority ({priority})</Badge>;
    if (priority >= 5) return <Badge variant="outline">Medium Priority ({priority})</Badge>;
    return <Badge variant="secondary">Low Priority ({priority})</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/team-lead" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={`/team-lead/projects/${projectId}`} className="hover:underline">
              {task.project.internalName}
            </Link>
            <span>/</span>
            <span>Task Review</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            {getStatusBadge(task.status)}
            {getPriorityBadge(task.priority)}
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Description */}
          <Card>
            <CardHeader>
              <CardTitle>Task Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description provided</p>
              )}
            </CardContent>
          </Card>

          {/* Task Attachments (from when task was created) */}
          {task.attachments && task.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Task Reference Files</CardTitle>
                <CardDescription>Files attached when creating this task</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {task.attachments.map((att, idx) => (
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
                        {att.size && (
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Section - Only shown if task is SUBMITTED or later */}
          {(task.status === 'SUBMITTED' || task.status === 'APPROVED' || task.status === 'REJECTED') && (
            <Card className={task.status === 'SUBMITTED' ? 'border-amber-500 border-2' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {task.status === 'SUBMITTED' && <Clock className="h-5 w-5 text-amber-500" />}
                      {task.status === 'APPROVED' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {task.status === 'REJECTED' && <XCircle className="h-5 w-5 text-red-500" />}
                      Developer Submission
                    </CardTitle>
                    <CardDescription>
                      Submitted on {formatDate(task.submittedAt)}
                    </CardDescription>
                  </div>
                  {task.status === 'SUBMITTED' && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      Awaiting Review
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Submission Note */}
                {task.submissionNote && (
                  <div>
                    <h4 className="font-medium mb-2">Developer's Note</h4>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{task.submissionNote}</p>
                    </div>
                  </div>
                )}

                {/* Submission Attachments */}
                {task.submissionAttachments && task.submissionAttachments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Submitted Files ({task.submissionAttachments.length})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {task.submissionAttachments.map((att, idx) => (
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
                            {att.size && (
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                            )}
                            <p className="text-[10px] text-primary group-hover:underline flex items-center justify-center gap-1">
                              <ExternalLink className="h-3 w-3" /> View
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Actions - Only for SUBMITTED tasks */}
                {task.status === 'SUBMITTED' && (
                  <div className="pt-4 border-t space-y-4">
                    <h4 className="font-medium">Review Actions</h4>

                    {!showRejectForm ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={handleApprove}
                          disabled={approving}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {approving ? 'Approving...' : 'Approve Work'}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setShowRejectForm(true)}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Request Changes
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                Request Changes
                              </p>
                              <p className="text-xs text-red-600 dark:text-red-400">
                                The developer will be notified and can resubmit their work.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rejectionNote">Feedback for Developer</Label>
                          <Textarea
                            ref={rejectionTextareaRef}
                            id="rejectionNote"
                            value={rejectionNote}
                            onChange={(e) => setRejectionNote(e.target.value)}
                            onPaste={handleRejectionPaste}
                            placeholder="Explain what needs to be changed or improved... (Paste images directly here)"
                            rows={4}
                          />
                          <p className="text-xs text-muted-foreground">
                            Tip: You can paste images directly from clipboard (Ctrl+V / Cmd+V)
                          </p>
                        </div>

                        {/* File Upload Section */}
                        <div className="space-y-2">
                          <Label>Reference Files (optional)</Label>
                          <input
                            type="file"
                            ref={rejectionFileInputRef}
                            onChange={handleRejectionFileUpload}
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => rejectionFileInputRef.current?.click()}
                            disabled={uploadingRejectionFile}
                            className="w-full"
                          >
                            {uploadingRejectionFile ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Reference Files
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Rejection Attachments Preview */}
                        {rejectionAttachments.length > 0 && (
                          <div className="space-y-2">
                            <Label>Attached Files ({rejectionAttachments.length})</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {rejectionAttachments.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="relative flex items-center gap-2 p-2 rounded-lg border bg-muted/50 group"
                                >
                                  {file.mimeType.startsWith('image/') ? (
                                    <img
                                      src={file.url}
                                      alt={file.originalName}
                                      className="w-12 h-12 object-cover rounded"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                                      <FileText className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-medium truncate">{file.originalName}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 absolute top-1 right-1"
                                    onClick={() =>
                                      setRejectionAttachments((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowRejectForm(false);
                              setRejectionNote('');
                              setRejectionAttachments([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejecting || (!rejectionNote.trim() && rejectionAttachments.length === 0)}
                          >
                            {rejecting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              'Send Feedback'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{task.assignedTo.name}</p>
                  <p className="text-xs text-muted-foreground">{task.assignedTo.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{task.assignedBy.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(task.dueDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(task.createdAt)}</p>
                </div>
              </div>

              {task.submittedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="font-medium">{formatDate(task.submittedAt)}</p>
                  </div>
                </div>
              )}

              {task.approvedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="font-medium">{formatDate(task.approvedAt)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/team-lead/projects/${projectId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
