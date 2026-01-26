'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Star,
  Trophy,
  Loader2,
  User,
  TrendingUp,
  Award,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet, apiPost, getErrorMessage } from '@/lib/api';
import { getInitials } from '@/lib/utils';

type DeveloperTier = 'TRAINEE' | 'JUNIOR' | 'MID' | 'SENIOR' | 'ELITE';

interface Developer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tier: DeveloperTier;
  completedProjects: number;
  averageRating: number;
  totalReviews: number;
  status: string;
}

interface ReviewableProject {
  id: string;
  internalName: string;
  projectType: string;
  status: string;
  complexity: string;
  tasks: { id: string; title: string; status: string }[];
}

interface ProjectReview {
  id: string;
  rating: number;
  clientFeedback?: string;
  adminNotes?: string;
  codeQuality?: number;
  communicationScore?: number;
  deliverySpeed?: number;
  problemSolving?: number;
  project: { id: string; internalName: string };
  developer: { id: string; name: string; tier: DeveloperTier };
  createdBy: { id: string; name: string };
  createdAt: string;
}

const tierConfig: Record<DeveloperTier, { color: string; icon: string; label: string }> = {
  TRAINEE: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    icon: '🌱',
    label: 'Trainee'
  },
  JUNIOR: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: '🌿',
    label: 'Junior'
  },
  MID: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    icon: '⭐',
    label: 'Mid-Level'
  },
  SENIOR: {
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    icon: '💎',
    label: 'Senior'
  },
  ELITE: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: '👑',
    label: 'Elite'
  },
};

const TIER_THRESHOLDS = {
  TRAINEE: { minProjects: 0, minRating: 0 },
  JUNIOR: { minProjects: 3, minRating: 3.0 },
  MID: { minProjects: 8, minRating: 3.5 },
  SENIOR: { minProjects: 15, minRating: 4.0 },
  ELITE: { minProjects: 25, minRating: 4.5 },
};

function StarRating({ rating, onChange, readonly = false }: {
  rating: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          <Star
            className={`h-5 w-5 ${
              star <= (hover || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function DeveloperTiersPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Add Review Dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [reviewableProjects, setReviewableProjects] = useState<ReviewableProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    projectId: '',
    rating: 0,
    clientFeedback: '',
    adminNotes: '',
    codeQuality: 0,
    communicationScore: 0,
    deliverySpeed: 0,
    problemSolving: 0,
  });

  useEffect(() => {
    fetchDevelopers();
    fetchReviews();
  }, []);

  const fetchDevelopers = async () => {
    try {
      setLoading(true);
      const response = await apiGet<{ data: Developer[] }>('/project-reviews/developers');
      setDevelopers(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await apiGet<{ data: ProjectReview[] }>('/project-reviews?limit=50');
      setReviews(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReviewsLoading(false);
    }
  };

  const openReviewDialog = async (developer: Developer) => {
    setSelectedDeveloper(developer);
    setReviewForm({
      projectId: '',
      rating: 0,
      clientFeedback: '',
      adminNotes: '',
      codeQuality: 0,
      communicationScore: 0,
      deliverySpeed: 0,
      problemSolving: 0,
    });
    setReviewDialogOpen(true);

    // Fetch reviewable projects for this developer
    try {
      setLoadingProjects(true);
      const projects = await apiGet<ReviewableProject[]>(
        `/project-reviews/developers/${developer.id}/reviewable-projects`
      );
      setReviewableProjects(projects);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedDeveloper || !reviewForm.projectId || reviewForm.rating === 0) {
      toast.error('Please select a project and provide a rating');
      return;
    }

    try {
      setSubmitting(true);
      await apiPost('/project-reviews', {
        developerId: selectedDeveloper.id,
        projectId: reviewForm.projectId,
        rating: reviewForm.rating,
        clientFeedback: reviewForm.clientFeedback || undefined,
        adminNotes: reviewForm.adminNotes || undefined,
        codeQuality: reviewForm.codeQuality || undefined,
        communicationScore: reviewForm.communicationScore || undefined,
        deliverySpeed: reviewForm.deliverySpeed || undefined,
        problemSolving: reviewForm.problemSolving || undefined,
      });
      toast.success('Review submitted successfully');
      setReviewDialogOpen(false);
      fetchDevelopers();
      fetchReviews();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDevelopers = developers.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || dev.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Stats
  const tierCounts = developers.reduce((acc, dev) => {
    acc[dev.tier] = (acc[dev.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Developer Tiers & Reviews</h1>
        <p className="text-muted-foreground">
          Manage developer performance reviews and tier progression
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(tierConfig).map(([tier, config]) => (
          <Card key={tier}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
              <span className="text-2xl">{config.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tierCounts[tier] || 0}</div>
              <p className="text-xs text-muted-foreground">
                {TIER_THRESHOLDS[tier as DeveloperTier].minProjects}+ projects, {TIER_THRESHOLDS[tier as DeveloperTier].minRating}+ rating
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="developers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="developers">
            <User className="mr-2 h-4 w-4" />
            Developers
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="mr-2 h-4 w-4" />
            Recent Reviews
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <TrendingUp className="mr-2 h-4 w-4" />
            Tier Thresholds
          </TabsTrigger>
        </TabsList>

        {/* Developers Tab */}
        <TabsContent value="developers" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search developers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {Object.entries(tierConfig).map(([tier, config]) => (
                  <SelectItem key={tier} value={tier}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Developers Table */}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Projects</TableHead>
                  <TableHead className="text-center">Avg Rating</TableHead>
                  <TableHead className="text-center">Reviews</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredDevelopers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No developers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevelopers.map((dev) => (
                    <TableRow key={dev.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={dev.avatar} />
                            <AvatarFallback>{getInitials(dev.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{dev.name}</p>
                            <p className="text-sm text-muted-foreground">{dev.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={tierConfig[dev.tier]?.color}>
                          {tierConfig[dev.tier]?.icon} {tierConfig[dev.tier]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {dev.completedProjects}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {dev.averageRating.toFixed(1)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {dev.totalReviews}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(dev)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Reviewed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : reviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No reviews yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{review.developer.name}</span>
                          <Badge className={tierConfig[review.developer.tier]?.color} variant="outline">
                            {tierConfig[review.developer.tier]?.icon}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {review.project.internalName}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <StarRating rating={review.rating} readonly />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {review.clientFeedback || review.adminNotes || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {review.createdBy.name}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tier Progression System</CardTitle>
              <CardDescription>
                Developers automatically progress through tiers based on completed projects and average rating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(TIER_THRESHOLDS).map(([tier, thresholds], index, arr) => (
                <div key={tier} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-32">
                    <Badge className={tierConfig[tier as DeveloperTier]?.color}>
                      {tierConfig[tier as DeveloperTier]?.icon} {tierConfig[tier as DeveloperTier]?.label}
                    </Badge>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Min Projects: <strong>{thresholds.minProjects}</strong></span>
                      <span>Min Rating: <strong>{thresholds.minRating}</strong></span>
                    </div>
                    <Progress
                      value={(index / (arr.length - 1)) * 100}
                      className="h-2"
                    />
                  </div>
                  {index < arr.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  {index === arr.length - 1 && (
                    <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Project Review</DialogTitle>
            <DialogDescription>
              Add a performance review for <strong>{selectedDeveloper?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Project Selection */}
            <div className="grid gap-2">
              <Label>Select Project</Label>
              {loadingProjects ? (
                <Skeleton className="h-10 w-full" />
              ) : reviewableProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No projects available for review. The developer needs to have completed tasks on a project first.
                </p>
              ) : (
                <Select
                  value={reviewForm.projectId}
                  onValueChange={(value) => setReviewForm({ ...reviewForm, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.internalName} ({project.tasks.length} tasks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Overall Rating */}
            <div className="grid gap-2">
              <Label>Overall Rating *</Label>
              <StarRating
                rating={reviewForm.rating}
                onChange={(value) => setReviewForm({ ...reviewForm, rating: value })}
              />
            </div>

            {/* Detailed Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Code Quality</Label>
                <StarRating
                  rating={reviewForm.codeQuality}
                  onChange={(value) => setReviewForm({ ...reviewForm, codeQuality: value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Communication</Label>
                <StarRating
                  rating={reviewForm.communicationScore}
                  onChange={(value) => setReviewForm({ ...reviewForm, communicationScore: value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Delivery Speed</Label>
                <StarRating
                  rating={reviewForm.deliverySpeed}
                  onChange={(value) => setReviewForm({ ...reviewForm, deliverySpeed: value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Problem Solving</Label>
                <StarRating
                  rating={reviewForm.problemSolving}
                  onChange={(value) => setReviewForm({ ...reviewForm, problemSolving: value })}
                />
              </div>
            </div>

            {/* Client Feedback */}
            <div className="grid gap-2">
              <Label>Client Feedback (from Fiverr)</Label>
              <Textarea
                placeholder="Copy client's feedback here..."
                value={reviewForm.clientFeedback}
                onChange={(e) => setReviewForm({ ...reviewForm, clientFeedback: e.target.value })}
                rows={3}
              />
            </div>

            {/* Admin Notes */}
            <div className="grid gap-2">
              <Label>Admin Notes</Label>
              <Textarea
                placeholder="Your observations about the developer's performance..."
                value={reviewForm.adminNotes}
                onChange={(e) => setReviewForm({ ...reviewForm, adminNotes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || !reviewForm.projectId || reviewForm.rating === 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
