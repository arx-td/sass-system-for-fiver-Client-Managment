import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DeveloperTier, UserRole, Prisma } from '@prisma/client';
import { CreateReviewDto, UpdateReviewDto, QueryReviewsDto } from './dto';

// Tier thresholds configuration
const TIER_THRESHOLDS = {
  TRAINEE: { minProjects: 0, minRating: 0 },
  JUNIOR: { minProjects: 3, minRating: 3.0 },
  MID: { minProjects: 8, minRating: 3.5 },
  SENIOR: { minProjects: 15, minRating: 4.0 },
  ELITE: { minProjects: 25, minRating: 4.5 },
};

@Injectable()
export class ProjectReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate the appropriate tier based on completed projects and average rating
   */
  calculateTier(completedProjects: number, averageRating: number): DeveloperTier {
    if (
      completedProjects >= TIER_THRESHOLDS.ELITE.minProjects &&
      averageRating >= TIER_THRESHOLDS.ELITE.minRating
    ) {
      return DeveloperTier.ELITE;
    }
    if (
      completedProjects >= TIER_THRESHOLDS.SENIOR.minProjects &&
      averageRating >= TIER_THRESHOLDS.SENIOR.minRating
    ) {
      return DeveloperTier.SENIOR;
    }
    if (
      completedProjects >= TIER_THRESHOLDS.MID.minProjects &&
      averageRating >= TIER_THRESHOLDS.MID.minRating
    ) {
      return DeveloperTier.MID;
    }
    if (
      completedProjects >= TIER_THRESHOLDS.JUNIOR.minProjects &&
      averageRating >= TIER_THRESHOLDS.JUNIOR.minRating
    ) {
      return DeveloperTier.JUNIOR;
    }
    return DeveloperTier.TRAINEE;
  }

  /**
   * Recalculate and update developer's tier based on all their reviews
   */
  async recalculateDeveloperTier(developerId: string): Promise<void> {
    const reviews = await this.prisma.projectReview.findMany({
      where: { developerId },
      select: { rating: true },
    });

    const totalReviews = reviews.length;
    const completedProjects = totalReviews;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    const newTier = this.calculateTier(completedProjects, averageRating);

    await this.prisma.user.update({
      where: { id: developerId },
      data: {
        completedProjects,
        averageRating: Math.round(averageRating * 100) / 100,
        totalReviews,
        tier: newTier,
      },
    });
  }

  /**
   * Create a new project review for a developer
   */
  async create(createDto: CreateReviewDto, adminId: string) {
    // Verify project exists and is completed
    const project = await this.prisma.project.findUnique({
      where: { id: createDto.projectId },
      select: { id: true, internalName: true, status: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify developer exists and has DEVELOPER role
    const developer = await this.prisma.user.findFirst({
      where: { id: createDto.developerId, role: UserRole.DEVELOPER },
    });

    if (!developer) {
      throw new BadRequestException('Developer not found or user is not a developer');
    }

    // Check if developer worked on this project (has tasks assigned)
    const developerTask = await this.prisma.task.findFirst({
      where: {
        projectId: createDto.projectId,
        assignedToId: createDto.developerId,
      },
    });

    if (!developerTask) {
      throw new BadRequestException(
        'Developer has no tasks assigned for this project',
      );
    }

    // Check for existing review
    const existingReview = await this.prisma.projectReview.findUnique({
      where: {
        projectId_developerId: {
          projectId: createDto.projectId,
          developerId: createDto.developerId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException(
        'A review already exists for this developer on this project',
      );
    }

    // Create the review
    const review = await this.prisma.projectReview.create({
      data: {
        projectId: createDto.projectId,
        developerId: createDto.developerId,
        createdById: adminId,
        rating: createDto.rating,
        clientFeedback: createDto.clientFeedback,
        adminNotes: createDto.adminNotes,
        codeQuality: createDto.codeQuality,
        communicationScore: createDto.communicationScore,
        deliverySpeed: createDto.deliverySpeed,
        problemSolving: createDto.problemSolving,
      },
      include: {
        project: {
          select: { id: true, internalName: true },
        },
        developer: {
          select: { id: true, name: true, email: true, tier: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Recalculate developer's tier
    await this.recalculateDeveloperTier(createDto.developerId);

    // Fetch updated developer info
    const updatedDeveloper = await this.prisma.user.findUnique({
      where: { id: createDto.developerId },
      select: {
        id: true,
        name: true,
        tier: true,
        completedProjects: true,
        averageRating: true,
        totalReviews: true,
      },
    });

    return {
      review,
      developerStats: updatedDeveloper,
    };
  }

  /**
   * Get all reviews with optional filtering
   */
  async findAll(query: QueryReviewsDto) {
    const { developerId, projectId, minRating, page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.ProjectReviewWhereInput = {};

    if (developerId) where.developerId = developerId;
    if (projectId) where.projectId = projectId;
    if (minRating) where.rating = { gte: minRating };

    const [reviews, total] = await Promise.all([
      this.prisma.projectReview.findMany({
        where,
        include: {
          project: {
            select: { id: true, internalName: true },
          },
          developer: {
            select: { id: true, name: true, email: true, tier: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.projectReview.count({ where }),
    ]);

    return {
      data: reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single review by ID
   */
  async findOne(id: string) {
    const review = await this.prisma.projectReview.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, internalName: true, projectType: true },
        },
        developer: {
          select: {
            id: true,
            name: true,
            email: true,
            tier: true,
            completedProjects: true,
            averageRating: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  /**
   * Update an existing review
   */
  async update(id: string, updateDto: UpdateReviewDto) {
    const review = await this.prisma.projectReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.projectReview.update({
      where: { id },
      data: updateDto,
      include: {
        project: {
          select: { id: true, internalName: true },
        },
        developer: {
          select: { id: true, name: true, email: true, tier: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Recalculate developer's tier if rating changed
    if (updateDto.rating !== undefined) {
      await this.recalculateDeveloperTier(review.developerId);
    }

    return updated;
  }

  /**
   * Delete a review
   */
  async delete(id: string) {
    const review = await this.prisma.projectReview.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.projectReview.delete({ where: { id } });

    // Recalculate developer's tier after deletion
    await this.recalculateDeveloperTier(review.developerId);

    return { message: 'Review deleted successfully' };
  }

  /**
   * Get developer statistics including tier info
   */
  async getDeveloperStats(developerId: string) {
    const developer = await this.prisma.user.findFirst({
      where: { id: developerId, role: UserRole.DEVELOPER },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        tier: true,
        completedProjects: true,
        averageRating: true,
        totalReviews: true,
      },
    });

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    // Get recent reviews
    const recentReviews = await this.prisma.projectReview.findMany({
      where: { developerId },
      include: {
        project: {
          select: { id: true, internalName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Calculate next tier requirements
    const nextTier = this.getNextTierRequirements(
      developer.tier || DeveloperTier.TRAINEE,
      developer.completedProjects,
      developer.averageRating,
    );

    return {
      developer,
      recentReviews,
      nextTier,
      tierThresholds: TIER_THRESHOLDS,
    };
  }

  /**
   * Get all developers with their tier info
   */
  async getAllDevelopersWithTiers() {
    const developers = await this.prisma.user.findMany({
      where: { role: UserRole.DEVELOPER },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        tier: true,
        completedProjects: true,
        averageRating: true,
        totalReviews: true,
        status: true,
      },
      orderBy: [
        { tier: 'desc' },
        { averageRating: 'desc' },
        { completedProjects: 'desc' },
      ],
    });

    return {
      data: developers,
      tierThresholds: TIER_THRESHOLDS,
    };
  }

  /**
   * Calculate progress towards next tier
   */
  private getNextTierRequirements(
    currentTier: DeveloperTier,
    completedProjects: number,
    averageRating: number,
  ) {
    const tiers = Object.entries(TIER_THRESHOLDS);
    const currentIndex = tiers.findIndex(([tier]) => tier === currentTier);

    if (currentIndex === tiers.length - 1) {
      return {
        nextTier: null,
        message: 'Maximum tier reached!',
        progress: 100,
      };
    }

    const [nextTierName, nextThreshold] = tiers[currentIndex + 1];
    const projectsNeeded = Math.max(0, nextThreshold.minProjects - completedProjects);
    const ratingNeeded = Math.max(0, nextThreshold.minRating - averageRating);

    const projectProgress = Math.min(
      100,
      (completedProjects / nextThreshold.minProjects) * 100,
    );
    const ratingProgress =
      averageRating >= nextThreshold.minRating
        ? 100
        : (averageRating / nextThreshold.minRating) * 100;

    return {
      nextTier: nextTierName,
      requirements: nextThreshold,
      projectsNeeded,
      ratingNeeded: Math.round(ratingNeeded * 100) / 100,
      progress: {
        projects: Math.round(projectProgress),
        rating: Math.round(ratingProgress),
        overall: Math.round((projectProgress + ratingProgress) / 2),
      },
    };
  }

  /**
   * Get projects that can be reviewed for a specific developer
   */
  async getReviewableProjects(developerId: string) {
    // Get projects where developer has tasks but no review yet
    const projectsWithTasks = await this.prisma.project.findMany({
      where: {
        tasks: {
          some: { assignedToId: developerId },
        },
        projectReviews: {
          none: { developerId },
        },
      },
      select: {
        id: true,
        internalName: true,
        projectType: true,
        status: true,
        complexity: true,
        createdAt: true,
        tasks: {
          where: { assignedToId: developerId },
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projectsWithTasks;
  }
}
