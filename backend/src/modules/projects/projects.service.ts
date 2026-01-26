import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectStatus, UserRole, Prisma } from '@prisma/client';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectsDto,
  AssignTeamLeadDto,
  AttachDesignerDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private getBaseInclude(userRole: UserRole) {
    const include: Prisma.ProjectInclude = {
      createdBy: {
        select: { id: true, name: true },
      },
      manager: {
        select: { id: true, name: true, email: true },
      },
      teamLead: {
        select: { id: true, name: true, email: true },
      },
      designer: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          tasks: true,
          requirements: true,
          revisions: true,
        },
      },
    };

    // Only Admin and Manager can see Fiverr account details
    if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
      include.fiverrAccount = {
        select: { id: true, accountName: true },
      };
    }

    return include;
  }

  async create(createDto: CreateProjectDto, userId: string) {
    // Verify Fiverr account exists
    const fiverrAccount = await this.prisma.fiverrAccount.findUnique({
      where: { id: createDto.fiverrAccountId },
    });

    if (!fiverrAccount) {
      throw new BadRequestException('Invalid Fiverr account');
    }

    if (!fiverrAccount.isActive) {
      throw new BadRequestException('Fiverr account is not active');
    }

    // Verify manager if provided
    if (createDto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: createDto.managerId, role: UserRole.MANAGER },
      });
      if (!manager) {
        throw new BadRequestException('Invalid manager');
      }
    }

    // Verify designer if provided
    if (createDto.designerId) {
      const designer = await this.prisma.user.findFirst({
        where: { id: createDto.designerId, role: UserRole.DESIGNER },
      });
      if (!designer) {
        throw new BadRequestException('Invalid designer');
      }
    }

    // Get admin name for notification
    const admin = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const project = await this.prisma.project.create({
      data: {
        internalName: createDto.internalName,
        fiverrAccountId: createDto.fiverrAccountId,
        projectType: createDto.projectType,
        complexity: createDto.complexity,
        priority: createDto.priority,
        internalDeadline: createDto.internalDeadline
          ? new Date(createDto.internalDeadline)
          : null,
        fiverrDeadline: createDto.fiverrDeadline
          ? new Date(createDto.fiverrDeadline)
          : null,
        budget: createDto.budget,
        meetingLink: createDto.meetingLink,
        createdById: userId,
        managerId: createDto.managerId,
        designerId: createDto.designerId,
        status: ProjectStatus.NEW,
      },
      include: this.getBaseInclude(UserRole.ADMIN),
    });

    // Notify manager if assigned
    if (createDto.managerId) {
      await this.notificationsService.notifyProjectAssigned(
        project.id,
        project.internalName,
        createDto.managerId,
        'Manager',
        admin?.name || 'Admin',
      );
    }

    // Notify designer if assigned
    if (createDto.designerId) {
      await this.notificationsService.notifyProjectAssigned(
        project.id,
        project.internalName,
        createDto.designerId,
        'Designer',
        admin?.name || 'Admin',
      );
    }

    return project;
  }

  async findAll(query: QueryProjectsDto, userRole: UserRole, userId?: string) {
    const {
      status,
      priority,
      complexity,
      fiverrAccountId,
      managerId,
      teamLeadId,
      search,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.ProjectWhereInput = {};

    // Debug logging
    console.log('[PROJECTS] =========== DEBUG START ===========');
    console.log('[PROJECTS] User role:', userRole, '| User ID:', userId);

    // Role-based filtering
    if (userRole === UserRole.MANAGER && userId) {
      // Managers see all projects (as per requirements)
      console.log('[PROJECTS] Manager - showing all projects');
    } else if (userRole === UserRole.TEAM_LEAD && userId) {
      // Debug: Show all projects with their teamLeadIds for comparison
      const allProjectsDebug = await this.prisma.project.findMany({
        select: { id: true, internalName: true, teamLeadId: true },
      });
      console.log('[PROJECTS] ALL projects in DB:', JSON.stringify(allProjectsDebug, null, 2));
      console.log('[PROJECTS] Looking for teamLeadId:', userId);

      // Check exact match
      const matchCheck = allProjectsDebug.filter(p => p.teamLeadId === userId);
      console.log('[PROJECTS] Exact matches found:', matchCheck.length);

      if (allProjectsDebug.length > 0 && allProjectsDebug[0].teamLeadId) {
        console.log('[PROJECTS] First project teamLeadId:', allProjectsDebug[0].teamLeadId);
        console.log('[PROJECTS] Are they equal?:', allProjectsDebug[0].teamLeadId === userId);
        console.log('[PROJECTS] teamLeadId type:', typeof allProjectsDebug[0].teamLeadId);
        console.log('[PROJECTS] userId type:', typeof userId);
      }

      where.teamLeadId = userId;
    } else if (userRole === UserRole.DEVELOPER && userId) {
      where.tasks = { some: { assignedToId: userId } };
    } else if (userRole === UserRole.DESIGNER && userId) {
      where.designerId = userId;
    }

    // Additional filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (complexity) where.complexity = complexity;
    if (fiverrAccountId) where.fiverrAccountId = fiverrAccountId;
    if (managerId) where.managerId = managerId;
    if (teamLeadId) where.teamLeadId = teamLeadId;

    if (search) {
      where.internalName = { contains: search, mode: 'insensitive' };
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: this.getBaseInclude(userRole),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    // Remove budget for non-admin users
    const sanitizedProjects = projects.map((project) => {
      if (userRole !== UserRole.ADMIN) {
        const { budget, ...rest } = project;
        return rest;
      }
      return project;
    });

    // Debug info for Team Lead
    let debug = undefined;
    if (userRole === UserRole.TEAM_LEAD) {
      const allProjectsWithTeamLead = await this.prisma.project.findMany({
        where: { teamLeadId: { not: null } },
        select: { id: true, internalName: true, teamLeadId: true },
      });
      debug = {
        currentUserId: userId,
        currentUserRole: userRole,
        allProjectsWithTeamLead,
        queryWhere: where,
      };
    }

    return {
      data: sanitizedProjects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      debug,
    };
  }

  async findOne(id: string, userRole: UserRole) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...this.getBaseInclude(userRole),
        requirements: {
          where: { status: 'APPROVED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
        tasks: {
          include: {
            assignedTo: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Remove budget for non-admin users
    if (userRole !== UserRole.ADMIN) {
      const { budget, ...rest } = project;
      return rest;
    }

    return project;
  }

  async update(id: string, updateDto: UpdateProjectDto, userRole: UserRole) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Admin can update budget
    if (updateDto.budget && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can update budget');
    }

    // Only Admin can assign designer
    if (updateDto.designerId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can assign designer');
    }

    // Validate designer if provided
    if (updateDto.designerId) {
      const designer = await this.prisma.user.findUnique({
        where: { id: updateDto.designerId, role: UserRole.DESIGNER },
      });
      if (!designer) {
        throw new NotFoundException('Designer not found');
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...updateDto,
        internalDeadline: updateDto.internalDeadline
          ? new Date(updateDto.internalDeadline)
          : undefined,
        fiverrDeadline: updateDto.fiverrDeadline
          ? new Date(updateDto.fiverrDeadline)
          : undefined,
      },
      include: this.getBaseInclude(userRole),
    });

    return updated;
  }

  async assignTeamLead(
    projectId: string,
    assignDto: AssignTeamLeadDto,
    assignedBy: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify team lead exists and has correct role
    const teamLead = await this.prisma.user.findFirst({
      where: { id: assignDto.teamLeadId, role: UserRole.TEAM_LEAD },
    });

    if (!teamLead) {
      throw new BadRequestException('Invalid Team Lead');
    }

    // Get the assigner's name for the notification
    const assigner = await this.prisma.user.findUnique({
      where: { id: assignedBy },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        teamLeadId: assignDto.teamLeadId,
        status:
          project.status === ProjectStatus.NEW ||
          project.status === ProjectStatus.REQUIREMENTS_PENDING
            ? ProjectStatus.IN_PROGRESS
            : project.status,
      },
      include: this.getBaseInclude(UserRole.ADMIN),
    });

    // Send notification to Team Lead
    await this.notificationsService.notifyProjectAssigned(
      projectId,
      project.internalName,
      assignDto.teamLeadId,
      'Team Lead',
      assigner?.name || 'Manager',
    );

    return {
      project: updated,
      message: `Team Lead ${teamLead.name} has been assigned to the project`,
    };
  }

  async attachDesigner(projectId: string, attachDto: AttachDesignerDto, assignedById: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify designer exists and has correct role
    const designer = await this.prisma.user.findFirst({
      where: { id: attachDto.designerId, role: UserRole.DESIGNER },
    });

    if (!designer) {
      throw new BadRequestException('Invalid Designer');
    }

    // Get the assigner's name for notification
    const assigner = await this.prisma.user.findUnique({
      where: { id: assignedById },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { designerId: attachDto.designerId },
      include: this.getBaseInclude(UserRole.ADMIN),
    });

    // Notify the designer about the assignment
    await this.notificationsService.notifyDesignerAssigned(
      projectId,
      project.internalName,
      attachDto.designerId,
      assigner?.name || 'Admin',
    );

    return {
      project: updated,
      message: `Designer ${designer.name} has been attached to the project`,
    };
  }

  async getStats(fiverrAccountId?: string) {
    const where: Prisma.ProjectWhereInput = fiverrAccountId
      ? { fiverrAccountId }
      : {};

    const [total, byStatus, byPriority, byComplexity] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.project.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
      this.prisma.project.groupBy({
        by: ['complexity'],
        where,
        _count: { complexity: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, curr) => ({ ...acc, [curr.status]: curr._count.status }),
        {},
      ),
      byPriority: byPriority.reduce(
        (acc, curr) => ({ ...acc, [curr.priority]: curr._count.priority }),
        {},
      ),
      byComplexity: byComplexity.reduce(
        (acc, curr) => ({ ...acc, [curr.complexity]: curr._count.complexity }),
        {},
      ),
    };
  }

  async getManagerDashboard(managerId: string) {
    // Get unassigned projects (no team lead OR requirements not approved)
    const unassigned = await this.prisma.project.findMany({
      where: {
        OR: [
          { teamLeadId: null },
          {
            requirements: {
              none: { status: 'APPROVED' },
            },
          },
        ],
      },
      include: this.getBaseInclude(UserRole.MANAGER),
      orderBy: { createdAt: 'desc' },
    });

    // Get assigned/active projects
    const active = await this.prisma.project.findMany({
      where: {
        teamLeadId: { not: null },
        requirements: {
          some: { status: 'APPROVED' },
        },
        status: {
          in: [ProjectStatus.IN_PROGRESS, ProjectStatus.REVIEW],
        },
      },
      include: {
        ...this.getBaseInclude(UserRole.MANAGER),
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      unassigned,
      active,
    };
  }

  async markAsDelivered(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { select: { status: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Team Lead can mark as delivered
    if (project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the assigned Team Lead can mark this project as delivered');
    }

    // Check if all tasks are approved
    const allTasksApproved = project.tasks.length > 0 &&
      project.tasks.every((t) => t.status === 'APPROVED');

    if (!allTasksApproved) {
      throw new BadRequestException('All tasks must be approved before marking project as delivered');
    }

    // Get team lead name for notification
    const teamLead = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.REVIEW },
      include: this.getBaseInclude(UserRole.TEAM_LEAD),
    });

    // Notify manager that project has been delivered
    if (project.managerId) {
      await this.notificationsService.notifyProjectDelivered(
        projectId,
        project.internalName,
        project.managerId,
        teamLead?.name || 'Team Lead',
      );
    }

    return {
      project: updated,
      message: 'Project marked as delivered and ready for review',
    };
  }

  async markAsCompleted(projectId: string, userRole: UserRole, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Admin/Manager can mark as completed
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('Only Admin or Manager can mark project as completed');
    }

    // Get user name for notification
    const completedBy = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.COMPLETED },
      include: this.getBaseInclude(userRole),
    });

    // Notify team lead and other stakeholders about project completion
    const notifyUserIds: string[] = [];
    if (project.teamLeadId) notifyUserIds.push(project.teamLeadId);
    if (project.designerId) notifyUserIds.push(project.designerId);

    if (notifyUserIds.length > 0) {
      await this.notificationsService.notifyProjectStatusChanged(
        projectId,
        project.internalName,
        'COMPLETED',
        notifyUserIds,
        completedBy?.name || 'Manager',
      );
    }

    // Notify all Admins about project completion
    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const admin of admins) {
      // Skip if the Admin is the one who completed it (they already know)
      if (admin.id === userId) continue;

      await this.notificationsService.create({
        userId: admin.id,
        type: 'project_completed',
        title: 'Project Completed',
        message: `Project "${project.internalName}" has been completed by ${completedBy?.name || 'Manager'}.`,
        referenceType: 'project',
        referenceId: projectId,
      });
    }

    // Emit WebSocket event for real-time update
    this.notificationsGateway.server.emit('project:completed', {
      projectId: projectId,
      projectName: project.internalName,
      completedBy: completedBy?.name || 'Manager',
    });

    return {
      project: updated,
      message: 'Project marked as completed',
    };
  }

  async sendToClient(projectId: string, userRole: UserRole, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Admin/Manager can send to client
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('Only Admin or Manager can send project to client');
    }

    // Can only send to client if in REVIEW status
    if (project.status !== ProjectStatus.REVIEW) {
      throw new BadRequestException('Project must be in REVIEW status before sending to client');
    }

    // Get sender name for notification
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.CLIENT_REVIEW },
      include: this.getBaseInclude(userRole),
    });

    // Notify team lead that project was sent to client
    if (project.teamLeadId) {
      await this.notificationsService.notifyProjectSentToClient(
        projectId,
        project.internalName,
        project.teamLeadId,
        sender?.name || 'Manager',
      );
    }

    return {
      project: updated,
      message: 'Project sent to client for review',
    };
  }

  async clientRequestsChanges(projectId: string, userRole: UserRole, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Admin/Manager can handle client feedback
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
      throw new ForbiddenException('Only Admin or Manager can handle client feedback');
    }

    // Should be in CLIENT_REVIEW status
    if (project.status !== ProjectStatus.CLIENT_REVIEW) {
      throw new BadRequestException('Project is not awaiting client review');
    }

    // Get reporter name for notification
    const reporter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.IN_PROGRESS },
      include: this.getBaseInclude(userRole),
    });

    // Notify team lead about client requesting changes
    if (project.teamLeadId) {
      await this.notificationsService.notifyClientRequestedChanges(
        projectId,
        project.internalName,
        project.teamLeadId,
        reporter?.name || 'Manager',
      );
    }

    return {
      project: updated,
      message: 'Project status updated - Client requested changes',
    };
  }

  async delete(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: { select: { id: true } },
        requirements: { select: { id: true } },
        assets: { select: { id: true } },
        revisions: { select: { id: true } },
        chatMessages: { select: { id: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Delete related records in order (due to foreign key constraints)
    // Using transaction to ensure all-or-nothing deletion
    await this.prisma.$transaction(async (prisma) => {
      // Delete chat messages
      await prisma.chatMessage.deleteMany({
        where: { projectId: id },
      });

      // Delete tasks
      await prisma.task.deleteMany({
        where: { projectId: id },
      });

      // Delete requirements
      await prisma.requirement.deleteMany({
        where: { projectId: id },
      });

      // Delete design assets
      await prisma.designAsset.deleteMany({
        where: { projectId: id },
      });

      // Delete revisions
      await prisma.revision.deleteMany({
        where: { projectId: id },
      });

      // Finally delete the project
      await prisma.project.delete({
        where: { id },
      });
    });

    return {
      success: true,
      message: `Project "${project.internalName}" has been deleted successfully`,
      deletedCounts: {
        tasks: project.tasks.length,
        requirements: project.requirements.length,
        assets: project.assets.length,
        revisions: project.revisions.length,
        chatMessages: project.chatMessages.length,
      },
    };
  }
}
