import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { UserRole, RevisionStatus, TaskStatus } from '@prisma/client';
import { CreateRevisionDto, UpdateRevisionDto } from './dto';

@Injectable()
export class RevisionsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Find a revision by ID (helper for global controller)
   */
  async findRevisionById(revisionId: string) {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    return revision;
  }

  async create(
    projectId: string,
    dto: CreateRevisionDto,
    userId: string,
    userRole: UserRole,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Manager assigned to project or Admin can create revisions
    if (userRole !== UserRole.ADMIN && project.managerId !== userId) {
      throw new ForbiddenException('Only assigned manager can create revisions');
    }

    // Get creator name for notification
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const revision = await this.prisma.revision.create({
      data: {
        projectId,
        description: dto.description,
        attachments: (dto.attachments || []) as any,
        isPaid: dto.isPaid || false,
        status: RevisionStatus.PENDING,
        createdById: userId,
        assignedTeamLeadId: project.teamLeadId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Update project status to CLIENT_REVIEW when revision is created
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'CLIENT_REVIEW',
      },
    });

    // Notify team lead about new revision
    if (project.teamLeadId) {
      await this.notificationsService.notifyRevisionCreated(
        projectId,
        project.internalName,
        project.teamLeadId,
        creator?.name || 'Manager',
      );

      // Emit WebSocket event for real-time update
      this.notificationsGateway.notifyTeamLeadsNewRevision(project.teamLeadId, {
        ...revision,
        project: {
          id: projectId,
          internalName: project.internalName,
          priority: project.priority,
          internalDeadline: project.internalDeadline,
        },
      });
    }

    return revision;
  }

  async findAllByProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access based on role
    if (userRole === UserRole.ADMIN) {
      // Admin has full access
    } else if (userRole === UserRole.MANAGER) {
      if (project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.DEVELOPER) {
      // Developer can only see revisions assigned to them
      return this.prisma.revision.findMany({
        where: {
          projectId,
          assignedDeveloperId: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          assignedDeveloper: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.revision.findMany({
      where: { projectId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        assignedDeveloper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    projectId: string,
    revisionId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findFirst({
      where: {
        id: revisionId,
        projectId,
      },
      include: {
        project: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Check access
    if (userRole === UserRole.ADMIN) {
      // Admin has full access
    } else if (userRole === UserRole.MANAGER) {
      if (revision.project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (revision.project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.DEVELOPER) {
      if (revision.assignedDeveloperId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    return revision;
  }

  async update(
    projectId: string,
    revisionId: string,
    dto: UpdateRevisionDto,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findFirst({
      where: {
        id: revisionId,
        projectId,
      },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Check permissions
    if (userRole === UserRole.ADMIN) {
      // Admin can do everything
    } else if (userRole === UserRole.MANAGER) {
      if (revision.project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (revision.project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
      // Team Lead can only update status and assign developer
      if (dto.assignedTeamLeadId) {
        throw new ForbiddenException('Cannot reassign team lead');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        status: dto.status,
        assignedTeamLeadId: dto.assignedTeamLeadId,
        assignedDeveloperId: dto.assignedDeveloperId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async complete(
    projectId: string,
    revisionId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findFirst({
      where: {
        id: revisionId,
        projectId,
      },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Only Team Lead or Admin can mark as complete
    if (
      userRole !== UserRole.ADMIN &&
      revision.project.teamLeadId !== userId
    ) {
      throw new ForbiddenException('Only team lead can complete revisions');
    }

    // Get completer name for notification
    const completer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updatedRevision = await this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        status: RevisionStatus.COMPLETED,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Notify manager and other stakeholders about revision completion
    const notifyUserIds: string[] = [];
    if (revision.project.managerId) notifyUserIds.push(revision.project.managerId);
    if (revision.createdById && revision.createdById !== revision.project.managerId) {
      notifyUserIds.push(revision.createdById);
    }

    if (notifyUserIds.length > 0) {
      await this.notificationsService.notifyRevisionCompleted(
        revision.project.id,
        revision.project.internalName,
        notifyUserIds,
        completer?.name || 'Team Lead',
      );
    }

    return updatedRevision;
  }

  /**
   * Get all pending revisions for a Team Lead (needs developer assignment)
   * Used for the RED alert box - revisions from Manager that need assignment
   */
  async getPendingRevisionsForTeamLead(userId: string) {
    const revisions = await this.prisma.revision.findMany({
      where: {
        assignedTeamLeadId: userId,
        status: RevisionStatus.PENDING,
        assignedDeveloperId: null, // Not yet assigned to developer
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            priority: true,
            internalDeadline: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' }, // Oldest first (FIFO)
      ],
    });

    return revisions;
  }

  /**
   * Get all submitted revisions for a Team Lead (developer completed, needs review)
   * Used for the YELLOW alert box
   */
  async getSubmittedRevisionsForTeamLead(userId: string) {
    const revisions = await this.prisma.revision.findMany({
      where: {
        assignedTeamLeadId: userId,
        status: RevisionStatus.SUBMITTED,
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            priority: true,
            internalDeadline: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { submittedAt: 'asc' }, // Oldest first
      ],
    });

    return revisions;
  }

  /**
   * Get all completed revisions for Manager that need acceptance
   * Used for the GREEN alert box
   */
  async getCompletedRevisionsForManager(userId: string) {
    // Get projects where user is manager
    const projects = await this.prisma.project.findMany({
      where: { managerId: userId },
      select: { id: true },
    });

    const projectIds = projects.map(p => p.id);

    const revisions = await this.prisma.revision.findMany({
      where: {
        projectId: { in: projectIds },
        status: RevisionStatus.COMPLETED,
        managerAccepted: false, // Not yet accepted by manager
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            priority: true,
            internalDeadline: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'asc' }, // Oldest first
      ],
    });

    return revisions;
  }

  /**
   * Get all assigned revisions for a Developer
   * Used for the priority revision alert box
   */
  async getAssignedRevisionsForDeveloper(userId: string) {
    const revisions = await this.prisma.revision.findMany({
      where: {
        assignedDeveloperId: userId,
        status: {
          in: [RevisionStatus.PENDING, RevisionStatus.IN_PROGRESS],
        },
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            priority: true,
            internalDeadline: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' }, // Oldest first (FIFO)
      ],
    });

    return revisions;
  }

  /**
   * Smart developer auto-selection for revision assignment
   * Finds the best available developer based on:
   * 1. Developers who worked on this project before
   * 2. Current workload (fewer active tasks = better)
   * 3. Tier/experience level
   */
  async getSuggestedDevelopers(projectId: string) {
    // Get developers who worked on this project (via tasks)
    const projectDevelopers = await this.prisma.task.findMany({
      where: {
        projectId,
        assignedTo: {
          role: UserRole.DEVELOPER,
          status: 'ACTIVE',
        },
      },
      select: {
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
      distinct: ['assignedToId'],
    });

    // Get all active developers with their workload
    const allDevelopers = await this.prisma.user.findMany({
      where: {
        role: UserRole.DEVELOPER,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        tier: true,
        assignedTasks: {
          where: {
            status: {
              in: [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS],
            },
          },
          select: { id: true },
        },
      },
    });

    // Calculate scores for each developer
    const projectDevIds = new Set(projectDevelopers.map(d => d.assignedToId));

    const scoredDevelopers = allDevelopers.map(dev => {
      let score = 0;

      // Worked on this project before (+50 points)
      if (projectDevIds.has(dev.id)) {
        score += 50;
      }

      // Lower workload = higher score (max 30 points)
      const activeTaskCount = dev.assignedTasks.length;
      score += Math.max(0, 30 - activeTaskCount * 5);

      // Tier bonus (higher tier = more points, max 20 points)
      const tierScores: Record<string, number> = {
        TRAINEE: 0,
        JUNIOR: 5,
        MID: 10,
        SENIOR: 15,
        ELITE: 20,
      };
      score += tierScores[dev.tier || 'TRAINEE'] || 0;

      return {
        id: dev.id,
        name: dev.name,
        tier: dev.tier,
        activeTaskCount,
        workedOnProject: projectDevIds.has(dev.id),
        score,
      };
    });

    // Sort by score descending
    scoredDevelopers.sort((a, b) => b.score - a.score);

    return {
      recommended: scoredDevelopers[0] || null,
      all: scoredDevelopers,
    };
  }

  /**
   * Assign a developer to a revision
   * Also starts the revision if it was pending
   */
  async assignDeveloper(
    projectId: string,
    revisionId: string,
    developerId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findFirst({
      where: {
        id: revisionId,
        projectId,
      },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Only Team Lead assigned to this project or Admin can assign developers
    if (
      userRole !== UserRole.ADMIN &&
      revision.project.teamLeadId !== userId
    ) {
      throw new ForbiddenException('Only assigned team lead can assign developers');
    }

    // Verify the developer exists and is active
    const developer = await this.prisma.user.findFirst({
      where: {
        id: developerId,
        role: UserRole.DEVELOPER,
        status: 'ACTIVE',
      },
    });

    if (!developer) {
      throw new BadRequestException('Developer not found or inactive');
    }

    // Get assigner name for notification
    const assigner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Update revision
    const updatedRevision = await this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        assignedDeveloperId: developerId,
        status: RevisionStatus.IN_PROGRESS, // Auto-start when assigned
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify the developer about the revision assignment
    await this.notificationsService.create({
      userId: developerId,
      type: 'revision_assigned',
      title: 'Revision Assigned to You',
      message: `You have been assigned a revision on project "${revision.project.internalName}" by ${assigner?.name || 'Team Lead'}. This is a HIGH PRIORITY task.`,
      referenceType: 'revision',
      referenceId: revisionId,
    });

    // Emit WebSocket event for real-time update on developer's dashboard
    this.notificationsGateway.notifyRevisionAssigned(developerId, updatedRevision);

    return updatedRevision;
  }

  /**
   * Mark a revision as started (for developer)
   */
  async startRevision(
    revisionId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Only the assigned developer or admin can start
    if (
      userRole !== UserRole.ADMIN &&
      revision.assignedDeveloperId !== userId
    ) {
      throw new ForbiddenException('Only assigned developer can start this revision');
    }

    if (revision.status !== RevisionStatus.PENDING) {
      throw new BadRequestException('Revision is already in progress or completed');
    }

    return this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        status: RevisionStatus.IN_PROGRESS,
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Submit revision work (for developer)
   * Changes status to SUBMITTED and notifies Team Lead
   */
  async submitRevision(
    revisionId: string,
    message: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Only the assigned developer or admin can submit
    if (
      userRole !== UserRole.ADMIN &&
      revision.assignedDeveloperId !== userId
    ) {
      throw new ForbiddenException('Only assigned developer can submit this revision');
    }

    if (revision.status !== RevisionStatus.IN_PROGRESS) {
      throw new BadRequestException('Revision must be in progress to submit');
    }

    // Get submitter name for notification
    const submitter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Update revision with SUBMITTED status and message
    const updatedRevision = await this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        status: RevisionStatus.SUBMITTED,
        developerMessage: message,
        submittedAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify Team Lead about submission
    if (revision.assignedTeamLeadId) {
      await this.notificationsService.create({
        userId: revision.assignedTeamLeadId,
        type: 'revision_submitted',
        title: 'Revision Submitted for Review',
        message: `${submitter?.name || 'Developer'} has completed revision work on project "${revision.project.internalName}". Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        referenceType: 'revision',
        referenceId: revisionId,
      });

      // Emit WebSocket event for real-time update
      this.notificationsGateway.notifyRevisionSubmitted(revision.assignedTeamLeadId, updatedRevision);
    }

    return updatedRevision;
  }

  /**
   * Manager accepts a completed revision
   * Notifies Admin that revision is fully complete
   */
  async managerAcceptRevision(
    revisionId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        project: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Only the project manager or admin can accept
    if (
      userRole !== UserRole.ADMIN &&
      revision.project.managerId !== userId
    ) {
      throw new ForbiddenException('Only project manager can accept this revision');
    }

    if (revision.status !== RevisionStatus.COMPLETED) {
      throw new BadRequestException('Revision must be completed before acceptance');
    }

    if (revision.managerAccepted) {
      throw new BadRequestException('Revision is already accepted');
    }

    // Get manager name for notification
    const manager = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Update revision
    const updatedRevision = await this.prisma.revision.update({
      where: { id: revisionId },
      data: {
        managerAccepted: true,
        managerAcceptedAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Check if there are any other pending/in-progress revisions for this project
    const pendingRevisions = await this.prisma.revision.count({
      where: {
        projectId: revision.project.id,
        OR: [
          { status: RevisionStatus.PENDING },
          { status: RevisionStatus.IN_PROGRESS },
          { status: RevisionStatus.SUBMITTED },
          {
            status: RevisionStatus.COMPLETED,
            managerAccepted: false,
          },
        ],
        id: { not: revisionId }, // Exclude the one we just accepted
      },
    });

    // If no more pending revisions, update project status based on task completion
    if (pendingRevisions === 0) {
      // Check if all tasks are completed/approved
      const incompleteTasks = await this.prisma.task.count({
        where: {
          projectId: revision.project.id,
          status: {
            notIn: ['APPROVED'],
          },
        },
      });

      // If all tasks are approved, set to COMPLETED; otherwise IN_PROGRESS
      const newStatus = incompleteTasks === 0 ? 'COMPLETED' : 'IN_PROGRESS';

      await this.prisma.project.update({
        where: { id: revision.project.id },
        data: {
          status: newStatus,
        },
      });

      // If project became COMPLETED, notify all Admins immediately
      if (newStatus === 'COMPLETED') {
        const adminsForCompletion = await this.prisma.user.findMany({
          where: {
            role: UserRole.ADMIN,
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        for (const admin of adminsForCompletion) {
          await this.notificationsService.create({
            userId: admin.id,
            type: 'project_completed',
            title: 'Project Completed',
            message: `Project "${revision.project.internalName}" has been completed and approved by ${manager?.name || 'Manager'}. All revisions accepted.`,
            referenceType: 'project',
            referenceId: revision.project.id,
          });
        }

        // Emit WebSocket event for real-time update to Admins
        this.notificationsGateway.server.emit('project:completed', {
          projectId: revision.project.id,
          projectName: revision.project.internalName,
          completedBy: manager?.name || 'Manager',
        });
      }
    }

    // Notify all Admins about revision acceptance
    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.notificationsService.create({
        userId: admin.id,
        type: 'revision_accepted',
        title: 'Revision Accepted by Manager',
        message: `${manager?.name || 'Manager'} has accepted the completed revision for project "${revision.project.internalName}".`,
        referenceType: 'project',
        referenceId: revision.project.id,
      });
    }

    return updatedRevision;
  }

  /**
   * Get revision details with full information including attachments
   */
  async getRevisionDetails(
    revisionId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            priority: true,
            teamLeadId: true,
            managerId: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Check access based on role
    if (userRole === UserRole.ADMIN) {
      // Full access
    } else if (userRole === UserRole.MANAGER) {
      if (revision.project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (revision.project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.DEVELOPER) {
      if (revision.assignedDeveloperId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    return revision;
  }

  /**
   * Get all revisions for a project (for Revisions tab)
   */
  async getProjectRevisions(
    projectId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access based on role
    let whereClause: any = { projectId };

    if (userRole === UserRole.ADMIN) {
      // Full access
    } else if (userRole === UserRole.MANAGER) {
      if (project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.DEVELOPER) {
      // Developer can see revisions assigned to them or any revision for this project they worked on
      whereClause = {
        projectId,
        OR: [
          { assignedDeveloperId: userId },
          { assignedDeveloperId: null }, // Can see unassigned ones too for context
        ],
      };
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.revision.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
